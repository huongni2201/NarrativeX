import type { DesktopProject } from "@narrativex/client-contracts";
import { dialog } from "electron";
import { dirname } from "node:path";
import { deliverRenderArtifact } from "../rendering/render-destination";
import { RenderDeliveryTaskStore } from "../rendering/render-delivery-task-store";
import {
  registerTrustedIpcHandler,
  registerTrustedIpcHandlerWithEvent,
  type RendererTrustPolicy,
} from "../security/renderer-security";
import { SelectionTokenStore } from "../security/selection-token-store";
import {
  ProjectCatalog,
  type LocalProjectCatalogMetadata,
} from "./project-catalog";
import { ProjectStorage } from "./project-storage";

const pendingRenderDestinations = new SelectionTokenStore<{ directory: string }>();
const renderDeliveryTasks = new RenderDeliveryTaskStore();

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
  registerTrustedIpcHandler("desktop:projects-local:mark-archived", trustPolicy, (projectId) => {
    if (typeof projectId !== "string") throw new Error("projectId must be a string.");
    return catalog.markArchived(projectId);
  });
  registerTrustedIpcHandler("desktop:projects-local:upsert", trustPolicy, (input) => {
    if (!isCatalogUpsertInput(input)) throw new Error("Invalid local project catalog input.");
    return catalog.upsert(input.project, input.metadata);
  });

  registerTrustedIpcHandlerWithEvent(
    "desktop:render:choose-destination",
    trustPolicy,
    async (event) => {
      const selected = await dialog.showOpenDialog({
        title: "Choose final video folder",
        properties: ["openDirectory", "createDirectory"],
      });
      const directory = selected.filePaths[0];
      if (selected.canceled || !directory) return null;
      return {
        token: pendingRenderDestinations.create(
          event.sender.id,
          "render-delivery",
          { directory },
          60 * 60_000,
        ),
        directory,
      };
    },
  );

  registerTrustedIpcHandlerWithEvent(
    "desktop:render:bind-destination",
    trustPolicy,
    (event, input) => {
      if (!isRenderDestinationBindingInput(input)) {
        throw new Error("Invalid render destination binding request.");
      }
      const existing = renderDeliveryTasks.find(input.projectId, input.jobId, event.sender.id);
      if (existing) return { directory: existing.directory };

      const destination = pendingRenderDestinations.peek(
        input.token,
        event.sender.id,
        "render-delivery",
      );
      const task = renderDeliveryTasks.bind({
        projectId: input.projectId,
        jobId: input.jobId,
        senderId: event.sender.id,
        directory: destination.directory,
      });
      pendingRenderDestinations.consume(input.token, event.sender.id, "render-delivery");
      return { directory: task.directory };
    },
  );

  registerTrustedIpcHandlerWithEvent(
    "desktop:render:deliver-artifact",
    trustPolicy,
    async (event, input) => {
      if (!isRenderDeliveryInput(input)) throw new Error("Invalid render delivery request.");
      const task = renderDeliveryTasks.begin(input.projectId, input.jobId, event.sender.id);
      if (task.state === "DELIVERED" && task.finalPath) return { path: task.finalPath };

      try {
        const project = (await catalog.list()).find((entry) => entry.project.id === input.projectId);
        if (!project) throw new Error("Local project is not available for render delivery.");

        const storage = new ProjectStorage(dirname(project.workspacePath));
        const sourcePath = await storage.resolveArtifact(input.projectId, input.jobId);
        const path = await deliverRenderArtifact({
          sourcePath,
          destinationDirectory: task.directory,
          projectName: input.projectName ?? project.project.name,
        });
        renderDeliveryTasks.complete(input.projectId, input.jobId, event.sender.id, path);
        return { path };
      } catch (error) {
        renderDeliveryTasks.fail(input.projectId, input.jobId, event.sender.id, error);
        throw error;
      }
    },
  );
}

function isCatalogUpsertInput(value: unknown): value is {
  project: DesktopProject;
  metadata?: LocalProjectCatalogMetadata;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return isProject(input.project) && isMetadata(input.metadata);
}

function isRenderDestinationBindingInput(value: unknown): value is {
  token: string;
  projectId: string;
  jobId: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.token === "string" &&
    input.token.length > 0 &&
    typeof input.projectId === "string" &&
    input.projectId.length > 0 &&
    typeof input.jobId === "string" &&
    input.jobId.length > 0
  );
}

function isRenderDeliveryInput(value: unknown): value is {
  projectId: string;
  jobId: string;
  projectName?: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.projectId === "string" &&
    input.projectId.length > 0 &&
    typeof input.jobId === "string" &&
    input.jobId.length > 0 &&
    (input.projectName === undefined || typeof input.projectName === "string")
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
    Object.keys(metadata).every((key) => key === "ownerId") &&
    optionalNullableString(metadata.ownerId)
  );
}

function optionalNullableString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}
