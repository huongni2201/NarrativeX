import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("narrativeXAgent", {
  pair: (pairingCode: string) => ipcRenderer.invoke("agent:pair", pairingCode),
  status: () => ipcRenderer.invoke("agent:status"),
});
