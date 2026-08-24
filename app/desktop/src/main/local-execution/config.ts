export interface LocalExecutionConfig {
  backendBaseUrl: string;
  heartbeatIntervalMs: number;
  capabilities: string[];
  projectRenderEnabled: boolean;
}

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function backendUrl(): string {
  const runtimeOverride = process.env.NARRATIVEX_BACKEND_URL?.trim();
  const buildConfigured = import.meta.env.VITE_API_BASE_URL?.trim();
  return (runtimeOverride || buildConfigured || "http://localhost:8080").replace(/\/$/, "");
}

function heartbeatIntervalMs(): number {
  const configured =
    process.env.NARRATIVEX_DESKTOP_HEARTBEAT_MS ?? import.meta.env.VITE_DESKTOP_HEARTBEAT_MS;
  return Math.max(5_000, Number(configured ?? "15000") || 15_000);
}

export function loadLocalExecutionConfig(ffmpegAvailable = true): LocalExecutionConfig {
  const renderFlag =
    process.env.NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED ??
    import.meta.env.VITE_DESKTOP_PROJECT_RENDER_ENABLED;
  const projectRenderEnabled = ffmpegAvailable && enabled(renderFlag);
  return {
    backendBaseUrl: backendUrl(),
    heartbeatIntervalMs: heartbeatIntervalMs(),
    capabilities: ["DESKTOP_APP", ...(projectRenderEnabled ? ["PROJECT_RENDER"] : [])],
    projectRenderEnabled,
  };
}
