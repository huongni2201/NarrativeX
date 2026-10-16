import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnalysisAccounts } from "../../src/renderer/features/accounts/components/AnalysisAccounts";
import "../../src/renderer/styles.css";

const models = [
  { slug: "gemini-3.8-flash-high", family: "gemini" },
  { slug: "claude-sonnet-4-6", family: "third-party" },
];
const config = JSON.parse(sessionStorage.getItem("analysis-config") ?? "null") ?? {
  executionMode: "ANTIGRAVITY_CLI", model: models[0].slug, effort: "HIGH", maxConcurrentAnalyses: 2, rowVersion: 1,
};
const status = { cliReady: true, cliVersion: "1.3.5", loggedIn: true, connectionState: "CONNECTED",
  deviceReady: true, isolationVerified: true, usage: [], runningJobs: 0, maxParallel: 2 };
window.narrativex = {
  api: { request: async ({ path, method = "GET", body }: { path: string; method?: string; body?: string }) => {
    if (path !== "/api/v1/story-analysis/configuration") throw new Error(`Unexpected API: ${path}`);
    if (method === "PUT") {
      Object.assign(config, JSON.parse(body!), { rowVersion: config.rowVersion + 1 });
      sessionStorage.setItem("analysis-config", JSON.stringify(config));
    }
    return { status: 200, statusText: "OK", bodyText: JSON.stringify({ success: true, message: "OK", timestamp: "2026-10-15T00:00:00Z", data: config }) };
  } },
  storyAnalysis: { status: async () => status, models: async () => models, refresh: async () => status },
} as unknown as typeof window.narrativex;
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: false } } });
client.setQueryData(["story-analysis", "local-status"], status);
client.setQueryData(["story-analysis", "models"], models);
function Fixture() {
  const [visible, setVisible] = useState(true);
  return <><button onClick={() => setVisible(!visible)}>Toggle account</button>{visible && <AnalysisAccounts />}</>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={client}><Fixture /></QueryClientProvider></StrictMode>);
