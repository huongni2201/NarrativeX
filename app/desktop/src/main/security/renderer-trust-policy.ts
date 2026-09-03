import { join } from "node:path";
import type { RendererTrustPolicy } from "./renderer-security";

export function createRendererTrustPolicy(
  mainBundleDirectory: string,
  isPackaged: boolean,
  developmentRendererUrl?: string,
): RendererTrustPolicy {
  return {
    productionEntryPath: join(mainBundleDirectory, "../renderer/index.html"),
    developmentRendererUrl: isPackaged ? undefined : developmentRendererUrl,
  };
}
