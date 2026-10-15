import { refreshAccessToken, OAuthError, type OAuthDependencies } from "./oauth-flow.ts";
import type { AccountVault } from "./account-vault.ts";
import type { ProfileResult } from "./oauth-profile.ts";
import { AnalysisError } from "./types.ts";

const REFRESH_MARGIN_MS = 90_000;

/** Supplies fresh access tokens per account. Refreshes are serialized per account, never shared across accounts. */
export class AccountSessions {
  private readonly refreshing = new Map<string, Promise<string>>();

  constructor(
    private readonly vault: AccountVault,
    private readonly profile: () => Promise<ProfileResult>,
    private readonly deps: OAuthDependencies,
  ) {}

  async accessToken(accountId: string, forceRefresh = false): Promise<string> {
    const secrets = await this.vault.secrets(accountId);
    if (!secrets) throw new AnalysisError("AUTH_REQUIRED", false);
    const now = (this.deps.now ?? Date.now)();
    if (!forceRefresh && secrets.expiresAt - now > REFRESH_MARGIN_MS) return secrets.accessToken;
    let pending = this.refreshing.get(accountId);
    if (!pending) {
      pending = this.refresh(accountId).finally(() => { this.refreshing.delete(accountId); });
      this.refreshing.set(accountId, pending);
    }
    return pending;
  }

  private async refresh(accountId: string): Promise<string> {
    const profile = await this.profile();
    if (!profile.ok) throw new AnalysisError("OAUTH_NOT_CONFIGURED", false);
    const secrets = await this.vault.secrets(accountId);
    if (!secrets) throw new AnalysisError("AUTH_REQUIRED", false);
    try {
      const tokens = await refreshAccessToken(profile.profile, this.deps, secrets.refreshToken);
      await this.vault.saveSecrets(accountId, tokens);
      return tokens.accessToken;
    } catch (error) {
      const diagnostic = { source: "GOOGLE_OAUTH" as const, httpStatus: error instanceof OAuthError ? error.httpStatus : null,
        reason: error instanceof OAuthError && error.code === "INVALID_GRANT" ? "INVALID_GRANT" as const : null };
      if (diagnostic.reason === "INVALID_GRANT") throw new AnalysisError("AUTH_REQUIRED", false, null, diagnostic);
      // Refresh is not an inference request; a transient failure is safe to retry later.
      throw new AnalysisError("PROVIDER_UNAVAILABLE", false, null, diagnostic);
    }
  }
}
