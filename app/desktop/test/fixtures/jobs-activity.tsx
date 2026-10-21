import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobsScreen } from "../../src/renderer/features/jobs/screens/JobsScreen";
import "../../src/renderer/styles.css";

// Isolated fixture: ?scenario=alive | starting | missing | dead decides what the Desktop reports for the RUNNING job.
const scenario = new URLSearchParams(location.search).get("scenario") ?? "alive";
if (scenario === "light") document.documentElement.dataset.theme = "light";
const startedAt = new Date(Date.now() - 272_000).toISOString();
const activity = {
  alive: [{ jobId: "job-running", startedAt, pid: 28224, processAlive: true }],
  starting: [{ jobId: "job-running", startedAt, pid: null, processAlive: true }],
  missing: [],
  dead: [{ jobId: "job-running", startedAt, pid: 28224, processAlive: false }],
}[scenario] ?? [];
const job = (jobId: string, status: string, extra = {}) => ({
  jobId, projectId: "p", projectName: "Demo", jobType: "CHAPTER_ANALYZE", status, progress: 10, currentStep: "ANTIGRAVITY_ANALYSIS",
  errorCode: null, createdAt: "2026-10-16T00:55:11.000Z", completedAt: null, ...extra,
});
const page = { content: [job("job-running", "RUNNING"), job("job-failed", "FAILED", { errorCode: "APP_INTERRUPTED", currentStep: "Desktop closed before the analysis finished; run it again" })], limit: 50, hasNext: false };
window.narrativex = {
  api: { request: async ({ path }: { path: string }) => {
    if (!path.startsWith("/api/v1/jobs/history")) throw new Error(`Unexpected API: ${path}`);
    return { status: 200, statusText: "OK", bodyText: JSON.stringify({ success: true, message: "OK", timestamp: "2026-10-16T00:00:00Z", data: page }) };
  } },
  storyAnalysis: { activity: async () => activity, diagnostics: async () => {
    if (scenario === "log-error") throw new Error("Cannot read log");
    if (scenario === "empty") return [];
    return [{ at: "2026-10-17T09:14:15Z", code: "ANALYSIS_TIMEOUT", exitCode: 1, reason: "CLI_PRINT_TIMEOUT", stage: "STORY", windowNumber: 2, windowCount: 3,
      ...(scenario === "legacy" ? {} : { jobId: "job-failed" }),
      excerpt: "[agy] print timeout after 10m0s with turn in progress; returning partial output\nexceeded the output token limit\n" + "detail ".repeat(1500) + "FINAL ERROR LINE" },
      { at: "2026-10-17T09:15:15Z", jobId: "another-job", code: "PROCESS_FAILED", exitCode: 1, reason: "OTHER", excerpt: "OTHER JOB PRIVATE DETAIL" }];
  } },
  system: { copyText: async (text: string) => { sessionStorage.setItem("copied-job-error", text); } },
} as unknown as typeof window.narrativex;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={client}>
  <div style={{ height: "100vh" }}><JobsScreen projectId="p" workspace={{} as never} /></div></QueryClientProvider></StrictMode>);
