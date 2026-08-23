export interface AgentConfig {
  backendBaseUrl: string;
  heartbeatIntervalMs: number;
}

export function loadConfig(): AgentConfig {
  return {
    backendBaseUrl: process.env.NARRATIVEX_BACKEND_URL?.replace(/\/$/, "") ?? "http://localhost:8080",
    heartbeatIntervalMs: Number(process.env.NARRATIVEX_AGENT_HEARTBEAT_MS ?? "15000"),
  };
}
