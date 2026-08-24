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
  return normalizeBackendUrl(runtimeOverride || buildConfigured || "http://localhost:8080");
}

function normalizeBackendUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NarrativeX backend URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("NarrativeX backend URL must not contain credentials, query, or fragment.");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("NarrativeX backend URL must be an origin without a path.");
  }
  if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
    throw new Error("NarrativeX backend URL must use HTTPS outside localhost.");
  }
  return url.origin;
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]";
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
