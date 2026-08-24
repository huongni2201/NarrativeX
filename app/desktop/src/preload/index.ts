import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { LocalExecutionStatus, NarrativeXDesktopBridge } from "./types";

const bridge: NarrativeXDesktopBridge = {
  appVersion: () => ipcRenderer.invoke("desktop:app-version"),
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
};

contextBridge.exposeInMainWorld("narrativex", bridge);
