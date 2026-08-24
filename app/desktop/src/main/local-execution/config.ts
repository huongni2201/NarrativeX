export interface LocalExecutionConfig {
  backendBaseUrl: string;
  heartbeatIntervalMs: number;
  capabilities: string[];
  projectRenderEnabled: boolean;
}

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function loadLocalExecutionConfig(ffmpegAvailable = true): LocalExecutionConfig {
  const projectRenderEnabled = ffmpegAvailable && enabled(process.env.NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED);
  return {
    backendBaseUrl:
      process.env.NARRATIVEX_BACKEND_URL?.replace(/\/$/, "") ?? "http://localhost:8080",
    heartbeatIntervalMs: Math.max(
      5_000,
      Number(process.env.NARRATIVEX_DESKTOP_HEARTBEAT_MS ?? "15000") || 15_000,
    ),
    capabilities: ["DESKTOP_APP", ...(projectRenderEnabled ? ["PROJECT_RENDER"] : [])],
    projectRenderEnabled,
  };
}
