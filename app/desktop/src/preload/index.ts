import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  DesktopApiRequest,
  DesktopApiResponse,
  DesktopSseEvent,
  DesktopSseHandlers,
  GeminiWebGenerateImageInput,
  LocalExecutionStatus,
  NarrativeXDesktopBridge,
  VoiceReferenceUploadResult,
} from "./types";

const SSE_EVENT_CHANNEL = "desktop:api:sse:event";
const SSE_ERROR_CHANNEL = "desktop:api:sse:error";

const bridge: NarrativeXDesktopBridge = {
  appVersion: () => ipcRenderer.invoke("desktop:app-version"),
  api: {
    request: (input: DesktopApiRequest) =>
      ipcRenderer.invoke("desktop:api:request", input) as Promise<DesktopApiResponse>,
    subscribe: subscribeBackendEvents,
    uploadVoiceReference: () =>
      ipcRenderer.invoke("desktop:api:upload-voice-reference") as Promise<VoiceReferenceUploadResult | null>,
  },
  auth: {
    login: () => ipcRenderer.invoke("desktop:auth:login"),
    logout: () => ipcRenderer.invoke("desktop:auth:logout") as Promise<DesktopApiResponse>,
    onCallback: (listener: (response: DesktopApiResponse) => void) => {
      const handler = (_event: IpcRendererEvent, response: DesktopApiResponse) => listener(response);
      ipcRenderer.on("desktop:auth:callback", handler);
      void ipcRenderer
        .invoke("desktop:auth:consume-pending")
        .then((response: unknown) => {
          if (isDesktopApiResponse(response)) listener(response);
        })
        .catch(() => undefined);
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
    markArchived: (projectId: string) =>
      ipcRenderer.invoke("desktop:projects-local:mark-archived", projectId),
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
  geminiWeb: {
    generateImage: (input: GeminiWebGenerateImageInput) =>
      ipcRenderer.invoke("desktop:gemini-web:generate-image", input),
    commitImage: (input) => ipcRenderer.invoke("desktop:gemini-web:commit-image", input),
  },
  render: {
    status: () => ipcRenderer.invoke("desktop:render:status"),
    preflight: (input) => ipcRenderer.invoke("desktop:render:preflight", input),
    recoveryStatus: () => ipcRenderer.invoke("desktop:render:recovery-status"),
    cancel: (jobId: string) => ipcRenderer.invoke("desktop:render:cancel", jobId),
    chooseDestination: () => ipcRenderer.invoke("desktop:render:choose-destination"),
    deliverArtifact: (input) => ipcRenderer.invoke("desktop:render:deliver-artifact", input),
  },
  system: {
    copyText: (text: string) =>
      ipcRenderer.invoke("desktop:system:clipboard-write", text) as Promise<void>,
  },
  windowControls: {
    minimize: () => ipcRenderer.invoke("desktop:window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("desktop:window:toggle-maximize"),
    close: () => ipcRenderer.invoke("desktop:window:close"),
  },
};

function createSubscriptionId(): string {
  return crypto.randomUUID();
}

function subscribeBackendEvents(path: string, handlers: DesktopSseHandlers): () => void {
  const subscriptionId = createSubscriptionId();
  let closed = false;

  const eventHandler = (
    _event: IpcRendererEvent,
    payload: { subscriptionId?: unknown; event?: unknown },
  ) => {
    if (payload?.subscriptionId !== subscriptionId || !isDesktopSseEvent(payload.event)) return;
    handlers.onEvent(payload.event);
  };
  const errorHandler = (
    _event: IpcRendererEvent,
    payload: { subscriptionId?: unknown; message?: unknown },
  ) => {
    if (payload?.subscriptionId !== subscriptionId || typeof payload.message !== "string") return;
    handlers.onError?.(payload.message);
  };

  ipcRenderer.on(SSE_EVENT_CHANNEL, eventHandler);
  ipcRenderer.on(SSE_ERROR_CHANNEL, errorHandler);
  void ipcRenderer
    .invoke("desktop:api:sse:start", { subscriptionId, path })
    .then(() => {
      if (closed) void ipcRenderer.invoke("desktop:api:sse:stop", { subscriptionId });
    })
    .catch((error: unknown) => {
      if (!closed) {
        handlers.onError?.(error instanceof Error ? error.message : "Unable to start backend event stream.");
      }
    });

  return () => {
    if (closed) return;
    closed = true;
    ipcRenderer.removeListener(SSE_EVENT_CHANNEL, eventHandler);
    ipcRenderer.removeListener(SSE_ERROR_CHANNEL, errorHandler);
    void ipcRenderer.invoke("desktop:api:sse:stop", { subscriptionId }).catch(() => undefined);
  };
}

function isDesktopApiResponse(value: unknown): value is DesktopApiResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<DesktopApiResponse>;
  return (
    typeof response.status === "number" &&
    typeof response.statusText === "string" &&
    typeof response.bodyText === "string"
  );
}

function isDesktopSseEvent(value: unknown): value is DesktopSseEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<DesktopSseEvent>;
  return (
    typeof event.event === "string" &&
    typeof event.data === "string" &&
    (event.id === null || typeof event.id === "string") &&
    (event.retry === null || typeof event.retry === "number")
  );
}

contextBridge.exposeInMainWorld("narrativex", bridge);
