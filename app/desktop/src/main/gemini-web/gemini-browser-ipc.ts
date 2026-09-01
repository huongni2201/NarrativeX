import type { GeminiBrowserPool } from "./gemini-browser-pool";
import {
  registerTrustedIpcHandler,
  type RendererTrustPolicy,
} from "../security/renderer-security";

const BROWSER_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function parseBrowserId(value: unknown): string {
  if (typeof value !== "string" || !BROWSER_ID_PATTERN.test(value)) {
    throw new Error("Invalid Gemini browser id.");
  }
  return value;
}

export function registerGeminiBrowserIpc(
  policy: RendererTrustPolicy,
  browsers: GeminiBrowserPool,
): void {
  registerTrustedIpcHandler("desktop:gemini-web:browsers:list", policy, () => browsers.list());
  registerTrustedIpcHandler("desktop:gemini-web:browsers:add", policy, () => browsers.add());
  registerTrustedIpcHandler("desktop:gemini-web:browsers:open", policy, (browserId) =>
    browsers.open(parseBrowserId(browserId)),
  );
  registerTrustedIpcHandler("desktop:gemini-web:browsers:login", policy, (browserId) =>
    browsers.login(parseBrowserId(browserId)),
  );
  registerTrustedIpcHandler("desktop:gemini-web:browsers:reset-login", policy, (browserId) =>
    browsers.resetLogin(parseBrowserId(browserId)),
  );
  registerTrustedIpcHandler("desktop:gemini-web:browsers:remove", policy, (browserId) =>
    browsers.remove(parseBrowserId(browserId)),
  );
}
