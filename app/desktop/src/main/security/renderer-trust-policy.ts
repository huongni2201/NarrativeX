import { join, win32 } from "node:path";
import type { RendererTrustPolicy } from "./renderer-security";

function rendererEntryPath(mainBundleDirectory: string): string {
  const pathApi = win32.isAbsolute(mainBundleDirectory) ? win32 : { join };
  return pathApi.join(mainBundleDirectory, "../renderer/index.html");
}

export function createRendererTrustPolicy(
  mainBundleDirectory: string,
  isPackaged: boolean,
  developmentRendererUrl?: string,
): RendererTrustPolicy {
  return {
    productionEntryPath: rendererEntryPath(mainBundleDirectory),
    developmentRendererUrl: isPackaged ? undefined : developmentRendererUrl,
  };
}
