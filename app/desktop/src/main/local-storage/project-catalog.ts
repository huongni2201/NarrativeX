import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DesktopProject } from "@narrativex/client-contracts";
import { ProjectStorage } from "./project-storage";

const CATALOG_SCHEMA_VERSION = 1 as const;
const PROJECT_SNAPSHOT_SCHEMA_VERSION = 1 as const;
const PROJECT_SNAPSHOT_FILENAME = "project.json";
const CATALOG_FILENAME = "project-registry.json";

type ProjectSyncStatus =
  | "LOCAL_ONLY"
  | "DIRTY"
  | "SYNCING"
  | "SYNCED"
  | "SYNC_FAILED";

export interface LocalProjectCatalogEntry {
  project: DesktopProject;
  workspacePath: string;
  ownerId: string | null;
  cloudProjectId: string | null;
  syncStatus: ProjectSyncStatus;
  registeredAt: string;
  lastOpenedAt: string;
}

export interface LocalProjectCatalogMetadata {
  ownerId?: string | null;
  cloudProjectId?: string | null;
  syncStatus?: ProjectSyncStatus;
}

interface PersistedProjectEntry {
  project: DesktopProject;
  ownerId: string | null;
  cloudProjectId: string | null;
  syncStatus: ProjectSyncStatus;
  registeredAt: string;
  lastOpenedAt: string;
}

interface PersistedProjectSnapshot extends PersistedProjectEntry {
  schemaVersion: typeof PROJECT_SNAPSHOT_SCHEMA_VERSION;
}

interface ProjectCatalogDocument {
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  lastProjectId: string | null;
  projects: Record<string, PersistedProjectEntry>;
}

export class ProjectCatalog {
  private readonly storage: ProjectStorage;
  private readonly registryPath: string;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(storage: ProjectStorage) {
    this.storage = storage;
    this.registryPath = join(storage.rootDirectory(), CATALOG_FILENAME);
  }

  async list(): Promise<LocalProjectCatalogEntry[]> {
    const catalog = await this.readCatalogWithRecovery();
    return Object.values(catalog.projects)
      .map((entry) => this.toPublicEntry(entry))
      .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt));
  }

  async lastOpened(): Promise<LocalProjectCatalogEntry | null> {
    const catalog = await this.readCatalogWithRecovery();
    const selected = catalog.lastProjectId ? catalog.projects[catalog.lastProjectId] : undefined;
    if (selected) return this.toPublicEntry(selected);
    const projects = Object.values(catalog.projects).sort((left, right) =>
      right.lastOpenedAt.localeCompare(left.lastOpenedAt),
    );
    return projects[0] ? this.toPublicEntry(projects[0]) : null;
  }

  async upsert(
    project: DesktopProject,
    metadata: LocalProjectCatalogMetadata = {},
  ): Promise<LocalProjectCatalogEntry> {
    assertProject(project);
    await this.storage.ensureProject(project.id);
    return this.withWriteLock(async () => {
      const catalog = await this.readCatalogWithRecovery();
      const existing = catalog.projects[project.id];
      const now = new Date().toISOString();
      const entry: PersistedProjectEntry = {
        project: cloneProject(project),
        ownerId: metadata.ownerId !== undefined ? metadata.ownerId : existing?.ownerId ?? null,
        cloudProjectId:
          metadata.cloudProjectId !== undefined
            ? metadata.cloudProjectId
            : existing?.cloudProjectId ?? null,
        syncStatus: metadata.syncStatus ?? existing?.syncStatus ?? "LOCAL_ONLY",
        registeredAt: existing?.registeredAt ?? now,
        lastOpenedAt: existing?.lastOpenedAt ?? now,
      };
      catalog.projects[project.id] = entry;
      await this.persistEntry(project.id, entry);
      await this.writeCatalog(catalog);
      return this.toPublicEntry(entry);
    });
  }

  async reconcile(
    projects: DesktopProject[],
    metadata: LocalProjectCatalogMetadata = {},
  ): Promise<LocalProjectCatalogEntry[]> {
    for (const project of projects) assertProject(project);
    for (const project of projects) await this.storage.ensureProject(project.id);

    return this.withWriteLock(async () => {
      const catalog = await this.readCatalogWithRecovery();
      const now = new Date().toISOString();
      for (const project of projects) {
        const existing = catalog.projects[project.id];
        const entry: PersistedProjectEntry = {
          project: cloneProject(project),
          ownerId: metadata.ownerId !== undefined ? metadata.ownerId : existing?.ownerId ?? null,
          cloudProjectId:
            metadata.cloudProjectId !== undefined
              ? metadata.cloudProjectId
              : existing?.cloudProjectId ?? null,
          syncStatus: metadata.syncStatus ?? existing?.syncStatus ?? "LOCAL_ONLY",
          registeredAt: existing?.registeredAt ?? now,
          lastOpenedAt: existing?.lastOpenedAt ?? now,
        };
        catalog.projects[project.id] = entry;
        await this.persistEntry(project.id, entry);
      }
      await this.writeCatalog(catalog);
      return Object.values(catalog.projects)
        .map((entry) => this.toPublicEntry(entry))
        .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt));
    });
  }

  async touch(projectId: string): Promise<LocalProjectCatalogEntry> {
    await this.storage.ensureProject(projectId);
    return this.withWriteLock(async () => {
      const catalog = await this.readCatalogWithRecovery();
      const existing = catalog.projects[projectId];
      if (!existing) {
        throw new Error(`Local project ${projectId} is not registered.`);
      }
      existing.lastOpenedAt = new Date().toISOString();
      catalog.lastProjectId = projectId;
      await this.persistEntry(projectId, existing);
      await this.writeCatalog(catalog);
      return this.toPublicEntry(existing);
    });
  }

  private toPublicEntry(entry: PersistedProjectEntry): LocalProjectCatalogEntry {
    return {
      ...clonePersistedEntry(entry),
      workspacePath: this.storage.projectDirectory(entry.project.id),
    };
  }

  private async readCatalogWithRecovery(): Promise<ProjectCatalogDocument> {
    await mkdir(this.storage.rootDirectory(), { recursive: true });
    try {
      const raw = await readFile(this.registryPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!isCatalogDocument(parsed)) throw new Error("Invalid local project registry.");
      return parsed;
    } catch (error) {
      if (!isMissingFile(error)) await this.quarantineCorruptRegistry();
      return this.rebuildCatalogFromSnapshots();
    }
  }

  private async rebuildCatalogFromSnapshots(): Promise<ProjectCatalogDocument> {
    const catalog = emptyCatalog();
    let directories;
    try {
      directories = await readdir(this.storage.rootDirectory(), { withFileTypes: true });
    } catch (error) {
      if (isMissingFile(error)) return catalog;
      throw error;
    }

    for (const directory of directories) {
      if (!directory.isDirectory()) continue;
      try {
        const raw = await readFile(
          join(this.storage.rootDirectory(), directory.name, PROJECT_SNAPSHOT_FILENAME),
          "utf8",
        );
        const snapshot = JSON.parse(raw) as unknown;
        if (!isProjectSnapshot(snapshot) || snapshot.project.id.toLowerCase() !== directory.name.toLowerCase()) {
          continue;
        }
        catalog.projects[snapshot.project.id] = snapshotToEntry(snapshot);
      } catch (error) {
        if (!isMissingFile(error) && !(error instanceof SyntaxError)) throw error;
      }
    }

    const latest = Object.values(catalog.projects).sort((left, right) =>
      right.lastOpenedAt.localeCompare(left.lastOpenedAt),
    )[0];
    catalog.lastProjectId = latest?.project.id ?? null;
    await this.writeCatalog(catalog);
    return catalog;
  }

  private async persistEntry(projectId: string, entry: PersistedProjectEntry): Promise<void> {
    const snapshot: PersistedProjectSnapshot = {
      schemaVersion: PROJECT_SNAPSHOT_SCHEMA_VERSION,
      ...clonePersistedEntry(entry),
    };
    await atomicJsonWrite(
      join(this.storage.projectDirectory(projectId), PROJECT_SNAPSHOT_FILENAME),
      snapshot,
    );
  }

  private async writeCatalog(catalog: ProjectCatalogDocument): Promise<void> {
    await atomicJsonWrite(this.registryPath, catalog);
  }

  private async quarantineCorruptRegistry(): Promise<void> {
    try {
      await rename(this.registryPath, `${this.registryPath}.corrupt-${Date.now()}`);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }

  private async withWriteLock<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.writeLock;
    let release!: () => void;
    this.writeLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }
}

function emptyCatalog(): ProjectCatalogDocument {
  return { schemaVersion: CATALOG_SCHEMA_VERSION, lastProjectId: null, projects: {} };
}

function snapshotToEntry(snapshot: PersistedProjectSnapshot): PersistedProjectEntry {
  return {
    project: cloneProject(snapshot.project),
    ownerId: snapshot.ownerId,
    cloudProjectId: snapshot.cloudProjectId,
    syncStatus: snapshot.syncStatus,
    registeredAt: snapshot.registeredAt,
    lastOpenedAt: snapshot.lastOpenedAt,
  };
}

function clonePersistedEntry(entry: PersistedProjectEntry): PersistedProjectEntry {
  return {
    project: cloneProject(entry.project),
    ownerId: entry.ownerId,
    cloudProjectId: entry.cloudProjectId,
    syncStatus: entry.syncStatus,
    registeredAt: entry.registeredAt,
    lastOpenedAt: entry.lastOpenedAt,
  };
}

function cloneProject(project: DesktopProject): DesktopProject {
  return {
    ...project,
    metrics: project.metrics ? { ...project.metrics } : undefined,
  };
}

function assertProject(value: DesktopProject): void {
  if (!isProject(value)) throw new Error("Invalid local project metadata.");
}

function isProject(value: unknown): value is DesktopProject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const project = value as Partial<DesktopProject>;
  return (
    typeof project.id === "string" &&
    typeof project.name === "string" &&
    (project.description === null || typeof project.description === "string") &&
    (project.coverImageUrl === null || typeof project.coverImageUrl === "string") &&
    typeof project.status === "string"
  );
}

function isProjectSnapshot(value: unknown): value is PersistedProjectSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<PersistedProjectSnapshot>;
  return (
    snapshot.schemaVersion === PROJECT_SNAPSHOT_SCHEMA_VERSION &&
    isPersistedEntry(snapshot)
  );
}

function isCatalogDocument(value: unknown): value is ProjectCatalogDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const catalog = value as Partial<ProjectCatalogDocument>;
  if (
    catalog.schemaVersion !== CATALOG_SCHEMA_VERSION ||
    (catalog.lastProjectId !== null && typeof catalog.lastProjectId !== "string") ||
    !catalog.projects ||
    typeof catalog.projects !== "object" ||
    Array.isArray(catalog.projects)
  ) {
    return false;
  }
  return Object.entries(catalog.projects).every(
    ([projectId, entry]) => isPersistedEntry(entry) && entry.project.id === projectId,
  );
}

function isPersistedEntry(value: unknown): value is PersistedProjectEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<PersistedProjectEntry>;
  return (
    isProject(entry.project) &&
    (entry.ownerId === null || typeof entry.ownerId === "string") &&
    (entry.cloudProjectId === null || typeof entry.cloudProjectId === "string") &&
    isSyncStatus(entry.syncStatus) &&
    typeof entry.registeredAt === "string" &&
    typeof entry.lastOpenedAt === "string"
  );
}

function isSyncStatus(value: unknown): value is ProjectSyncStatus {
  return ["LOCAL_ONLY", "DIRTY", "SYNCING", "SYNCED", "SYNC_FAILED"].includes(String(value));
}

async function atomicJsonWrite(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
