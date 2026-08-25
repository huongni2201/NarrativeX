import { ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron";
import { pathToFileURL } from "node:url";

export interface RendererTrustPolicy {
  productionEntryPath: string;
  developmentRendererUrl?: string;
}

export function isTrustedRendererUrl(
  value: string,
  policy: RendererTrustPolicy,
): boolean {
  try {
    const candidate = new URL(value);
    if (policy.developmentRendererUrl) {
      const expected = new URL(policy.developmentRendererUrl);
      return candidate.origin === expected.origin;
    }

    const expected = pathToFileURL(policy.productionEntryPath);
    return (
      candidate.protocol === "file:" &&
      candidate.host === expected.host &&
      candidate.pathname === expected.pathname
    );
  } catch {
    return false;
  }
}

export function hardenRendererWebContents(
  webContents: WebContents,
  policy: RendererTrustPolicy,
): void {
  webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  webContents.on("will-navigate", (event, navigationUrl) => {
    if (!isTrustedRendererUrl(navigationUrl, policy)) event.preventDefault();
  });
  webContents.on("will-attach-webview", (event) => event.preventDefault());
}

export function registerTrustedIpcHandler(
  channel: string,
  policy: RendererTrustPolicy,
  handler: (...args: unknown[]) => unknown,
): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedRendererUrl(event.sender.getURL(), policy)) {
      throw new Error(`Rejected IPC from an untrusted renderer on ${channel}.`);
    }
    return handler(...args);
  });
}

export function registerTrustedIpcHandlerWithEvent(
  channel: string,
  policy: RendererTrustPolicy,
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedRendererUrl(event.sender.getURL(), policy)) {
      throw new Error(`Rejected IPC from an untrusted renderer on ${channel}.`);
    }
    return handler(event, ...args);
  });
}
