import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnalysisAccounts } from "../../src/renderer/features/accounts/components/AnalysisAccounts";
import type { StoryAnalysisStatus } from "../../src/shared/story-analysis";
import "../../src/renderer/styles.css";

const query = new URLSearchParams(location.search);
let scenario = query.get("scenario") ?? "403";
document.documentElement.dataset.theme = query.get("theme") ?? "dark";
const status = (): StoryAnalysisStatus => ({
  configured: true, profileIssue: null, deviceReady: true, loginInProgress: false, lastError: null,
  accounts: scenario === "empty" ? [] : [{
    accountId: "10000000-0000-4000-8000-000000000001", label: "f***@example.test", credentialRef: "fixture-ref",
    connectionState: ["401", "invalid_grant"].includes(scenario) ? "AUTH_REQUIRED" : "CONNECTED",
    quotaState: "UNKNOWN", nextEligibleAt: null, activeJobId: null, addedAt: "2026-10-15T00:00:00Z",
    lastError: scenario === "403" ? "PROVIDER_REFUSAL" : scenario === "healthy" ? null : "AUTH_REQUIRED",
    lastDiagnostic: scenario === "healthy" ? null : { source: scenario === "invalid_grant" ? "GOOGLE_OAUTH" : "ANTIGRAVITY",
      httpStatus: scenario === "invalid_grant" ? 400 : Number(scenario), reason: scenario === "invalid_grant" ? "INVALID_GRANT" : null },
  }],
});
const envelope = (data: unknown) => ({ status: 200, statusText: "OK", bodyText: JSON.stringify({
  success: true, message: "Success", timestamp: "2026-10-15T00:00:00Z", data,
}) });

// Fake credentials and API transport are confined to this isolated renderer fixture.
window.narrativex = {
  api: { request: async ({ path }: { path: string }) => {
    if (path.endsWith("/configuration")) return envelope({ executionMode: "ANTIGRAVITY_API", model: "gemini-3.1-pro-high", effort: "HIGH", maxConcurrentAnalyses: 1, rowVersion: 1 });
    if (path.endsWith("/credentials")) return envelope([]);
    throw new Error(`Unexpected fixture request: ${path}`);
  } },
  storyAnalysis: {
    status: async () => status(),
    addAccount: async () => { scenario = "healthy"; return status(); },
    removeAccount: async () => { scenario = "empty"; return status(); },
    cancelLogin: async () => {}, openTerms: async () => {},
  },
} as unknown as NonNullable<Window["narrativex"]>;

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <main className="min-h-screen bg-background p-4 text-foreground"><AnalysisAccounts /></main>
  </QueryClientProvider>,
);
