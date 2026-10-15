import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface VaultCrypto { encrypt(value: string): Buffer; decrypt(value: Buffer): string }

/** Non-secret account metadata. `fingerprint` is a one-way hash of the Google subject. */
export interface StoredAccount {
  accountId: string;
  label: string;
  fingerprint: string;
  credentialRef: string | null;
  projectId: string | null;
  addedAt: string;
}

export interface AccountSecrets { refreshToken: string; accessToken: string; expiresAt: number; scope: string }

const ID_PATTERN = /^[0-9a-f-]{36}$/u;

/**
 * Accounts live in `accounts.json` (no secrets) and one OS-encrypted file per account.
 * Tokens are never written in plaintext, never sent to the renderer and never stored in PostgreSQL.
 */
export class AccountVault {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly directory: string, private readonly crypto: VaultCrypto) {}

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.chain.then(work, work);
    this.chain = next.catch(() => undefined);
    return next;
  }

  private get indexPath() { return join(this.directory, "accounts.json"); }
  private secretPath(accountId: string) {
    if (!ID_PATTERN.test(accountId)) throw new Error("Invalid account id");
    return join(this.directory, "secrets", `${accountId}.encrypted`);
  }

  private async readIndex(): Promise<StoredAccount[]> {
    try {
      const value = JSON.parse(await readFile(this.indexPath, "utf8"));
      return Array.isArray(value) ? value as StoredAccount[] : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async writeAtomic(path: string, data: string | Buffer): Promise<void> {
    await mkdir(join(path, ".."), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, data, { mode: 0o600 });
    await rename(temporary, path);
  }

  list(): Promise<StoredAccount[]> { return this.serial(() => this.readIndex()); }

  /** Adds an account, or replaces the secrets of the same Google identity (re-login). */
  upsert(account: Omit<StoredAccount, "accountId" | "addedAt" | "credentialRef" | "projectId">, secrets: AccountSecrets): Promise<StoredAccount> {
    return this.serial(async () => {
      const accounts = await this.readIndex();
      const existing = accounts.find(a => a.fingerprint === account.fingerprint);
      const stored: StoredAccount = existing
        ? { ...existing, label: account.label }
        : { ...account, accountId: randomUUID(), credentialRef: null, projectId: null, addedAt: new Date().toISOString() };
      await this.writeAtomic(this.secretPath(stored.accountId), this.crypto.encrypt(JSON.stringify(secrets)));
      await this.writeAtomic(this.indexPath, JSON.stringify(existing ? accounts.map(a => a.accountId === stored.accountId ? stored : a) : [...accounts, stored]));
      return stored;
    });
  }

  secrets(accountId: string): Promise<AccountSecrets | null> {
    return this.serial(async () => {
      try { return JSON.parse(this.crypto.decrypt(await readFile(this.secretPath(accountId)))) as AccountSecrets; }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
    });
  }

  saveSecrets(accountId: string, secrets: AccountSecrets): Promise<void> {
    return this.serial(async () => { await this.writeAtomic(this.secretPath(accountId), this.crypto.encrypt(JSON.stringify(secrets))); });
  }

  patch(accountId: string, change: Partial<Pick<StoredAccount, "credentialRef" | "projectId" | "label">>): Promise<StoredAccount | null> {
    return this.serial(async () => {
      const accounts = await this.readIndex();
      const current = accounts.find(a => a.accountId === accountId);
      if (!current) return null;
      const next = { ...current, ...change };
      await this.writeAtomic(this.indexPath, JSON.stringify(accounts.map(a => a.accountId === accountId ? next : a)));
      return next;
    });
  }

  remove(accountId: string): Promise<boolean> {
    return this.serial(async () => {
      const accounts = await this.readIndex();
      if (!accounts.some(a => a.accountId === accountId)) return false;
      await this.writeAtomic(this.indexPath, JSON.stringify(accounts.filter(a => a.accountId !== accountId)));
      await rm(this.secretPath(accountId), { force: true });
      return true;
    });
  }
}
