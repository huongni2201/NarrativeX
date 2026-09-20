import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DesktopProject } from "@narrativex/client-contracts";
import { ProjectStorage } from "./project-storage.ts";

const CATALOG_SCHEMA_VERSION = 3 as const;
const PROJECT_SNAPSHOT_SCHEMA_VERSION = 3 as const;
const LEGACY_OWNERSHIP_KEY = ["owner", "Id"].join("");
const PROJECT_SNAPSHOT_FILENAME = "project.json";
const CATALOG_FILENAME = "project-registry.json";

export interface LocalProjectCatalogEntry {
  project: DesktopProject;
  workspacePath: string;
  registeredAt: string;
  lastOpenedAt: string;
}

interface PersistedProjectEntry {
  project: DesktopProject;
  archived: boolean;
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
    return this.visibleEntries(catalog);
  }

  async lastOpened(): Promise<LocalProjectCatalogEntry | null> {
    const catalog = await this.readCatalogWithRecovery();
    const selected = catalog.lastProjectId ? catalog.projects[catalog.lastProjectId] : undefined;
    if (selected && !selected.archived) return this.toPublicEntry(selected);
    const projects = this.visibleEntries(catalog);
    return projects[0] ?? null;
  }

  async upsert(
    project: DesktopProject,
  ): Promise<LocalProjectCatalogEntry> {
    assertProject(project);
    await this.storage.ensureProject(project.id);
    return this.withWriteLock(async () => {
      const catalog = await this.readCatalogWithRecovery();
      const existing = catalog.projects[project.id];
      const now = new Date().toISOString();
      const entry: PersistedProjectEntry = {
        project: cloneProject(project),
        archived: false,
        registeredAt: existing?.registeredAt ?? now,
        lastOpenedAt: existing?.lastOpenedAt ?? now,
      };
      catalog.projects[project.id] = entry;
      await this.persistEntry(project.id, entry);
      await this.writeCatalog(catalog);
      return this.toPublicEntry(entry);
    });
  }

  async touch(projectId: string): Promise<LocalProjectCatalogEntry> {
    return this.withWriteLock(async () => {
      const catalog = await this.readCatalogWithRecovery();
      const existing = catalog.projects[projectId];
      if (!existing || existing.archived) {
        throw new Error(`Local project ${projectId} is not registered.`);
      }
      await this.storage.ensureProject(projectId);
      existing.lastOpenedAt = new Date().toISOString();
      catalog.lastProjectId = projectId;
      await this.persistEntry(projectId, existing);
      await this.writeCatalog(catalog);
      return this.toPublicEntry(existing);
    });
  }

  async setFavorite(projectId: string, isStarred: boolean): Promise<LocalProjectCatalogEntry> {
    return this.withWriteLock(async () => {
      const catalog = await this.readCatalogWithRecovery();
      const existing = catalog.projects[projectId];
      if (!existing || existing.archived) {
        throw new Error(`Local project ${projectId} is not registered.`);
      }
      existing.project = { ...existing.project, isStarred };
      await this.persistEntry(projectId, existing);
      await this.writeCatalog(catalog);
      return this.toPublicEntry(existing);
    });
  }

  async markArchived(projectId: string): Promise<void> {
    return this.withWriteLock(async () => {
      const catalog = await this.readCatalogWithRecovery();
      const existing = catalog.projects[projectId];
      if (!existing) return;

      existing.archived = true;
      if (catalog.lastProjectId === projectId) catalog.lastProjectId = null;
      await this.persistEntry(projectId, existing);
      await this.writeCatalog(catalog);
    });
  }

  private visibleEntries(catalog: ProjectCatalogDocument): LocalProjectCatalogEntry[] {
    return Object.values(catalog.projects)
      .filter((entry) => !entry.archived)
      .map((entry) => this.toPublicEntry(entry))
      .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt));
  }

  private toPublicEntry(entry: PersistedProjectEntry): LocalProjectCatalogEntry {
    return {
      project: cloneProject(entry.project),
      registeredAt: entry.registeredAt,
      lastOpenedAt: entry.lastOpenedAt,
      workspacePath: this.storage.projectDirectory(entry.project.id),
    };
  }

  private async readCatalogWithRecovery(): Promise<ProjectCatalogDocument> {
    await mkdir(this.storage.rootDirectory(), { recursive: true });
    try {
      const raw = await readFile(this.registryPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const migrated = migrateCatalog(parsed);
      if (!migrated) throw new Error("Invalid local project registry.");
      if (migrated.migrated) {
        for (const [projectId, entry] of Object.entries(migrated.catalog.projects)) {
          await this.persistEntry(projectId, entry);
        }
        await this.writeCatalog(migrated.catalog);
      }
      return migrated.catalog;
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
        const snapshot = parseProjectSnapshot(JSON.parse(raw) as unknown);
        if (!snapshot || snapshot.project.id.toLowerCase() !== directory.name.toLowerCase()) {
          continue;
        }
        catalog.projects[snapshot.project.id] = snapshot.entry;
        await this.persistEntry(snapshot.project.id, snapshot.entry);
      } catch (error) {
        if (!isMissingFile(error) && !(error instanceof SyntaxError)) throw error;
      }
    }

    const latest = Object.values(catalog.projects)
      .filter((entry) => !entry.archived)
      .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt))[0];
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

function clonePersistedEntry(entry: PersistedProjectEntry): PersistedProjectEntry {
  return {
    project: cloneProject(entry.project),
    archived: entry.archived,
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

function migrateCatalog(value: unknown): {
  catalog: ProjectCatalogDocument;
  migrated: boolean;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const schemaVersion = candidate.schemaVersion;
  if (schemaVersion !== CATALOG_SCHEMA_VERSION && schemaVersion !== 2) return null;
  if (
    candidate.lastProjectId !== null &&
    typeof candidate.lastProjectId !== "string"
  ) return null;
  if (!candidate.projects || typeof candidate.projects !== "object" || Array.isArray(candidate.projects)) {
    return null;
  }

  const projects: Record<string, PersistedProjectEntry> = {};
  for (const [projectId, valueEntry] of Object.entries(candidate.projects)) {
    const entry = normalizePersistedEntry(valueEntry);
    if (!entry || entry.project.id !== projectId) return null;
    projects[projectId] = entry;
  }
  return {
    catalog: {
      schemaVersion: CATALOG_SCHEMA_VERSION,
      lastProjectId: candidate.lastProjectId as string | null,
      projects,
    },
    migrated: schemaVersion !== CATALOG_SCHEMA_VERSION,
  };
}

function parseProjectSnapshot(value: unknown): {
  project: DesktopProject;
  entry: PersistedProjectEntry;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, unknown>;
  if (
    snapshot.schemaVersion !== PROJECT_SNAPSHOT_SCHEMA_VERSION &&
    snapshot.schemaVersion !== 2
  ) return null;
  const entry = normalizePersistedEntry(snapshot);
  return entry ? { project: entry.project, entry } : null;
}

function normalizePersistedEntry(value: unknown): PersistedProjectEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  if (
    !isProject(entry.project) ||
    typeof entry.archived !== "boolean" ||
    typeof entry.registeredAt !== "string" ||
    typeof entry.lastOpenedAt !== "string"
  ) return null;
  // Legacy ownership is intentionally ignored while the project metadata is retained.
  void entry[LEGACY_OWNERSHIP_KEY];
  return {
    project: cloneProject(entry.project),
    archived: entry.archived,
    registeredAt: entry.registeredAt,
    lastOpenedAt: entry.lastOpenedAt,
  };
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
