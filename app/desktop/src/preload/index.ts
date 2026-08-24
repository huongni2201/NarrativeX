import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  DesktopApiRequest,
  DesktopApiResponse,
  LocalExecutionStatus,
  NarrativeXDesktopBridge,
} from "./types";

const bridge: NarrativeXDesktopBridge = {
  appVersion: () => ipcRenderer.invoke("desktop:app-version"),
  api: {
    request: (input: DesktopApiRequest) =>
      ipcRenderer.invoke("desktop:api:request", input) as Promise<DesktopApiResponse>,
  },
  auth: {
    login: () => ipcRenderer.invoke("desktop:auth:login"),
    onCallback: (listener: (code: string) => void) => {
      const handler = (_event: IpcRendererEvent, code: string) => listener(code);
      ipcRenderer.on("desktop:auth:callback", handler);
      void ipcRenderer.invoke("desktop:auth:consume-pending").then((code: unknown) => {
        if (typeof code === "string" && code) listener(code);
      });
      return () => ipcRenderer.removeListener("desktop:auth:callback", handler);
    },
  },
  localExecution: {
    status: () => ipcRenderer.invoke("desktop:local-execution:status"),
    pair: (pairingCode: string) =>
      ipcRenderer.invoke("desktop:local-execution:pair", pairingCode),
    unpair: () => ipcRenderer.invoke("desktop:local-execution:unpair"),
    onStatusChanged: (listener: (status: LocalExecutionStatus) => void) => {
      const handler = (_event: IpcRendererEvent, status: LocalExecutionStatus) => listener(status);
      ipcRenderer.on("desktop:local-execution:status-changed", handler);
      return () => ipcRenderer.removeListener("desktop:local-execution:status-changed", handler);
    },
  },
  localStorage: {
    ensureProject: (projectId: string) =>
      ipcRenderer.invoke("desktop:local-storage:ensure-project", projectId),
    importAsset: (input) => ipcRenderer.invoke("desktop:local-storage:import-asset", input),
    revealArtifact: (input) =>
      ipcRenderer.invoke("desktop:local-storage:reveal-artifact", input),
  },
  render: {
    status: () => ipcRenderer.invoke("desktop:render:status"),
    cancel: (jobId: string) => ipcRenderer.invoke("desktop:render:cancel", jobId),
  },
  system: {
    selectFiles: () => ipcRenderer.invoke("desktop:system:select-files"),
    selectFolder: () => ipcRenderer.invoke("desktop:system:select-folder"),
  },
};

contextBridge.exposeInMainWorld("narrativex", bridge);
