import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { randomUUID } from "node:crypto";
import type {
  DesktopApiRequest,
  DesktopApiResponse,
  DesktopApiStreamEvent,
  LocalExecutionStatus,
  NarrativeXDesktopBridge,
} from "./types";

const API_STREAM_EVENT_CHANNEL = "desktop:api:stream:event";

const bridge: NarrativeXDesktopBridge = {
  appVersion: () => ipcRenderer.invoke("desktop:app-version"),
  api: {
    request: (input: DesktopApiRequest) =>
      ipcRenderer.invoke("desktop:api:request", input) as Promise<DesktopApiResponse>,
    subscribe: (path: string, listener: (event: DesktopApiStreamEvent) => void) => {
      const subscriptionId = randomUUID();
      const handler = (_event: IpcRendererEvent, message: DesktopApiStreamEvent) => {
        if (message.subscriptionId === subscriptionId) listener(message);
      };
      ipcRenderer.on(API_STREAM_EVENT_CHANNEL, handler);
      void ipcRenderer
        .invoke("desktop:api:stream:start", { subscriptionId, path })
        .catch((error: unknown) => {
          listener({
            subscriptionId,
            event: "error",
            data: error instanceof Error ? error.message : String(error),
          });
        });
      return () => {
        ipcRenderer.removeListener(API_STREAM_EVENT_CHANNEL, handler);
        void ipcRenderer.invoke("desktop:api:stream:stop", subscriptionId).catch(() => undefined);
      };
    },
  },
  auth: {
    login: () => ipcRenderer.invoke("desktop:auth:login"),
    logout: () => ipcRenderer.invoke("desktop:auth:logout") as Promise<DesktopApiResponse>,
    onCallback: (listener: (response: DesktopApiResponse) => void) => {
      const handler = (_event: IpcRendererEvent, response: DesktopApiResponse) => listener(response);
      ipcRenderer.on("desktop:auth:callback", handler);
      void ipcRenderer.invoke("desktop:auth:consume-pending").then((response: unknown) => {
        if (isDesktopApiResponse(response)) listener(response);
      });
      return () => ipcRenderer.removeListener("desktop:auth:callback", handler);
    },
  },
  localExecution: {
    status: () => ipcRenderer.invoke("desktop:local-execution:status"),
    setUser: (userId: string | null) =>
      ipcRenderer.invoke("desktop:local-execution:set-user", userId),
    pair: (pairingCode: string) =>
      ipcRenderer.invoke("desktop:local-execution:pair", pairingCode),
    unpair: () => ipcRenderer.invoke("desktop:local-execution:unpair"),
    onStatusChanged: (listener: (status: LocalExecutionStatus) => void) => {
      const handler = (_event: IpcRendererEvent, status: LocalExecutionStatus) => listener(status);
      ipcRenderer.on("desktop:local-execution:status-changed", handler);
      return () => ipcRenderer.removeListener("desktop:local-execution:status-changed", handler);
    },
  },
  localProjects: {
    list: () => ipcRenderer.invoke("desktop:projects-local:list"),
    lastOpened: () => ipcRenderer.invoke("desktop:projects-local:last-opened"),
    upsert: (project, metadata) =>
      ipcRenderer.invoke("desktop:projects-local:upsert", { project, metadata }),
    reconcile: (projects, metadata) =>
      ipcRenderer.invoke("desktop:projects-local:reconcile", { projects, metadata }),
    touch: (projectId: string) => ipcRenderer.invoke("desktop:projects-local:touch", projectId),
  },
  localStorage: {
    ensureProject: (projectId: string) =>
      ipcRenderer.invoke("desktop:local-storage:ensure-project", projectId),
    summary: (projectId: string) => ipcRenderer.invoke("desktop:local-storage:summary", projectId),
    deleteManagedSnapshot: (input) => ipcRenderer.invoke("desktop:local-storage:delete-managed-snapshot", input),
    verifyProject: (projectId: string) => ipcRenderer.invoke("desktop:local-storage:verify-project", projectId),
    cleanupCompletedWork: (projectId: string) => ipcRenderer.invoke("desktop:local-storage:cleanup-completed-work", projectId),
    createBackup: (projectId) => ipcRenderer.invoke("desktop:local-storage:create-backup", projectId),
    restoreBackup: () => ipcRenderer.invoke("desktop:local-storage:restore-backup"),
    archiveProject: (projectId) => ipcRenderer.invoke("desktop:local-storage:archive-project", projectId),
    materializeRemoteAsset: (input) => ipcRenderer.invoke("desktop:local-storage:materialize-remote-asset", input),
    repairSelectedAsset: (input) => ipcRenderer.invoke("desktop:local-storage:repair-selected-asset", input),
    selectAsset: () => ipcRenderer.invoke("desktop:local-storage:select-asset"),
    commitSelectedAsset: (input) => ipcRenderer.invoke("desktop:local-storage:commit-selected-asset", input),
    revealArtifact: (input) =>
      ipcRenderer.invoke("desktop:local-storage:reveal-artifact", input),
  },
  render: {
    status: () => ipcRenderer.invoke("desktop:render:status"),
    preflight: (input) => ipcRenderer.invoke("desktop:render:preflight", input),
    recoveryStatus: () => ipcRenderer.invoke("desktop:render:recovery-status"),
    cancel: (jobId: string) => ipcRenderer.invoke("desktop:render:cancel", jobId),
  },
  system: {},
  windowControls: {
    minimize: () => ipcRenderer.invoke("desktop:window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("desktop:window:toggle-maximize"),
    close: () => ipcRenderer.invoke("desktop:window:close"),
  },
};

function isDesktopApiResponse(value: unknown): value is DesktopApiResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<DesktopApiResponse>;
  return (
    typeof response.status === "number" &&
    typeof response.statusText === "string" &&
    typeof response.bodyText === "string"
  );
}

contextBridge.exposeInMainWorld("narrativex", bridge);
