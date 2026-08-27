import type { DesktopProject } from "@narrativex/client-contracts";
import {
  registerTrustedIpcHandler,
  type RendererTrustPolicy,
} from "../security/renderer-security";
import {
  ProjectCatalog,
  type LocalProjectCatalogMetadata,
} from "./project-catalog";

export function registerProjectCatalogIpc(
  trustPolicy: RendererTrustPolicy,
  catalog: ProjectCatalog,
): void {
  registerTrustedIpcHandler("desktop:projects-local:list", trustPolicy, () => catalog.list());
  registerTrustedIpcHandler("desktop:projects-local:last-opened", trustPolicy, () =>
    catalog.lastOpened(),
  );
  registerTrustedIpcHandler("desktop:projects-local:touch", trustPolicy, (projectId) => {
    if (typeof projectId !== "string") throw new Error("projectId must be a string.");
    return catalog.touch(projectId);
  });
  registerTrustedIpcHandler("desktop:projects-local:upsert", trustPolicy, (input) => {
    if (!isCatalogUpsertInput(input)) throw new Error("Invalid local project catalog input.");
    return catalog.upsert(input.project, input.metadata);
  });
  registerTrustedIpcHandler("desktop:projects-local:reconcile", trustPolicy, (input) => {
    if (!isCatalogReconcileInput(input)) {
      throw new Error("Invalid local project catalog reconcile input.");
    }
    return catalog.reconcile(input.projects, input.metadata);
  });
}

function isCatalogUpsertInput(value: unknown): value is {
  project: DesktopProject;
  metadata?: LocalProjectCatalogMetadata;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return isProject(input.project) && isMetadata(input.metadata);
}

function isCatalogReconcileInput(value: unknown): value is {
  projects: DesktopProject[];
  metadata?: LocalProjectCatalogMetadata;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return (
    Array.isArray(input.projects) &&
    input.projects.every(isProject) &&
    isMetadata(input.metadata)
  );
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

function isMetadata(value: unknown): value is LocalProjectCatalogMetadata | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  return (
    optionalNullableString(metadata.ownerId) &&
    optionalNullableString(metadata.cloudProjectId) &&
    (metadata.syncStatus === undefined ||
      ["LOCAL_ONLY", "DIRTY", "SYNCING", "SYNCED", "SYNC_FAILED", "ORPHANED"].includes(
        String(metadata.syncStatus),
      ))
  );
}

function optionalNullableString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}
