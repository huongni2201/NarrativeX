import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("narrativex", {
  appVersion: () => ipcRenderer.invoke("desktop:app-version"),
});
