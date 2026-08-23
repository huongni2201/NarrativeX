import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import { BackendClient } from "./backend-client";
import { loadConfig } from "./config";
import { DeviceIdentityStore } from "./device-identity";

let tray: Tray | null = null;
let setupWindow: BrowserWindow | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let status: "UNPAIRED" | "CONNECTING" | "ONLINE" | "OFFLINE" = "UNPAIRED";

const config = loadConfig();
const backendClient = new BackendClient(config);

function createTrayImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#111827"/><path d="M9 23V9h3l8 9V9h3v14h-3l-8-9v9H9z" fill="#f97316"/></svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
  );
}

function refreshTray(): void {
  if (!tray) return;
  tray.setToolTip(`NarrativeX Agent — ${status}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Status: ${status}`, enabled: false },
      { type: "separator" },
      { label: "Open Agent", click: () => openSetupWindow() },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
}

function setStatus(next: typeof status): void {
  status = next;
  refreshTray();
  setupWindow?.webContents.send("agent:status-changed", status);
}

function openSetupWindow(): void {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.show();
    setupWindow.focus();
    return;
  }
  setupWindow = new BrowserWindow({
    width: 440,
    height: 520,
    resizable: false,
    title: "NarrativeX Agent",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void setupWindow.loadFile(path.join(app.getAppPath(), "src", "renderer", "index.html"));
  setupWindow.on("closed", () => {
    setupWindow = null;
  });
}

async function startHeartbeat(identityStore: DeviceIdentityStore): Promise<void> {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  const sendHeartbeat = async () => {
    const identity = await identityStore.load();
    if (!identity) {
      setStatus("UNPAIRED");
      return;
    }
    try {
      setStatus(status === "ONLINE" ? "ONLINE" : "CONNECTING");
      await backendClient.heartbeat(identity.deviceToken);
      setStatus("ONLINE");
    } catch (error) {
      console.error("Heartbeat failed", error);
      setStatus("OFFLINE");
    }
  };
  await sendHeartbeat();
  heartbeatTimer = setInterval(() => void sendHeartbeat(), config.heartbeatIntervalMs);
}

void app.whenReady().then(async () => {
  const identityStore = new DeviceIdentityStore();
  tray = new Tray(createTrayImage());
  tray.on("double-click", () => openSetupWindow());
  refreshTray();

  ipcMain.handle("agent:status", () => ({ status, backendBaseUrl: config.backendBaseUrl }));
  ipcMain.handle("agent:pair", async (_event, pairingCode: string) => {
    setStatus("CONNECTING");
    try {
      const paired = await backendClient.pair(pairingCode);
      await identityStore.save(paired.deviceId, paired.deviceToken);
      await startHeartbeat(identityStore);
      return { ok: true, deviceId: paired.deviceId };
    } catch (error) {
      setStatus("UNPAIRED");
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Pairing failed",
      };
    }
  });

  const identity = await identityStore.load();
  if (identity) {
    await startHeartbeat(identityStore);
  } else {
    setStatus("UNPAIRED");
    openSetupWindow();
  }
});

// Registering the listener suppresses Electron's default quit-on-last-window behavior.
app.on("window-all-closed", () => {});

app.on("before-quit", () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
});
