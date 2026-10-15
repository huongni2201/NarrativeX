import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DesktopTimeline, DesktopRenderJob, ProjectSubtitleSettings } from "@narrativex/client-contracts";
import { RenderDialog } from "../../src/renderer/features/production/components/RenderDialog";
import { SubtitleSettingsPanel } from "../../src/renderer/features/production/components/SubtitleSettingsPanel";
import { useRenderController } from "../../src/renderer/features/production/useRenderController";
import { DEFAULT_SUBTITLE_STYLE } from "../../src/shared/subtitle-style";
import "../../src/renderer/styles.css";

const projectId = "10000000-0000-4000-8000-000000000001";
const deviceId = "10000000-0000-4000-8000-000000000002";
const chapterId = "10000000-0000-4000-8000-000000000003";
const timeline: DesktopTimeline = {
  projectId, storyVersionId: "10000000-0000-4000-8000-000000000004", totalDurationMs: 2000,
  aspectRatio: "16:9", readyForRender: true,
  chapters: [{ chapterId, orderIndex: 0, title: "Ready fixture chapter", startMs: 0, endMs: 2000,
    audioReady: true, readyForRender: true, narrationAssetId: "10000000-0000-4000-8000-000000000005",
    audioSizeBytes: 1000, audioChecksum: "a".repeat(64), subtitleText: "Câu chuyện", subtitleWordsJson: "[]" }],
  beats: [{ chapterId, sceneIndex: 0, storyBeatId: null, beatIndex: 0,
    visualBeatId: "10000000-0000-4000-8000-000000000006", shotId: null, takeId: null,
    title: "Ready fixture video", visualIntent: "Quiet conversation", cameraMovement: "NONE", assetStrategy: "GENERATED",
    mediaAssetId: "10000000-0000-4000-8000-000000000007", mediaType: "VIDEO", sourceDurationMs: 2000,
    fitMode: "TRIM", trimStartMs: 0, mediaSelectionActive: true, startMs: 0, endMs: 2000, durationMs: 2000, assetReady: true }],
};

type Accepted = { body: string; job: DesktopRenderJob };
type FixtureState = {
  settings: ProjectSubtitleSettings; accepted: Record<string, Accepted>;
  requests: { key: string; body: string; jobId: string }[]; deliveries: { jobId: string; path: string }[]; deliveryStarted: string[];
  folders: number; directories: Record<string, string>; bound: Record<string, string>; dropped: boolean; boundaryErrors: string[];
};
const storageKey = "render-dialog-fixture-server";
const state: FixtureState = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") ?? {
  settings: { enabled: true, style: { ...DEFAULT_SUBTITLE_STYLE } }, accepted: {}, requests: [], deliveries: [], deliveryStarted: [],
  folders: 0, directories: {}, bound: {}, dropped: false, boundaryErrors: [],
};
const persist = () => sessionStorage.setItem(storageKey, JSON.stringify(state));
const unexpected = (message: string): never => { state.boundaryErrors.push(message); persist(); throw new Error(message); };
const envelope = (data: unknown) => ({ status: 200, statusText: "OK", bodyText: JSON.stringify({
  success: true, message: "Success", timestamp: "2026-10-11T00:00:00Z", data,
}) });
let releaseFirstDelivery: (() => void) | null = null;
const firstDeliveryGate = new Promise<void>((resolve) => { releaseFirstDelivery = resolve; });
(window as unknown as { releaseRenderDialogDelivery: () => void }).releaseRenderDialogDelivery = () => releaseFirstDelivery?.();

// The fake transport and native boundary exist only in this isolated fixture.
window.narrativex = {
  api: {
    request: async ({ path, method = "GET", headers = {}, body }: { path: string; method?: string; headers?: Record<string, string>; body?: string }) => {
      if (path.endsWith("/production/subtitle-settings")) {
        if (method === "PUT") { state.settings = JSON.parse(body!); persist(); }
        return envelope(state.settings);
      }
      if (path.endsWith("/production/render") && method === "POST") {
        const key = new Headers(headers).get("Idempotency-Key");
        if (!key || !body) return unexpected("Missing frozen render body or idempotency key");
        let accepted = state.accepted[key];
        if (accepted && accepted.body !== body) return unexpected("Retry changed an already accepted render body");
        if (!accepted) {
          accepted = { body, job: { jobId: `20000000-0000-4000-8000-${String(Object.keys(state.accepted).length + 1).padStart(12, "0")}`,
            type: "PROJECT_RENDER", status: "QUEUED", progress: 0, currentStep: null, errorCode: null } };
          state.accepted[key] = accepted;
        }
        state.requests.push({ key, body, jobId: accepted.job.jobId }); persist();
        if (new URLSearchParams(location.search).get("mode") === "ambiguous" && !state.dropped) {
          state.dropped = true; persist(); throw new Error("Fixture response lost after server accepted render");
        }
        return envelope(accepted.job);
      }
      if (path.startsWith("/api/v1/generation-jobs/")) {
        const jobId = path.split("/").at(-1);
        const accepted = Object.values(state.accepted).find(({ job }) => job.jobId === jobId);
        if (!accepted) return unexpected(`Unknown generation job: ${path}`);
        return envelope({ ...accepted.job, status: "COMPLETED", progress: 100, currentStep: "COMPLETED" });
      }
      return unexpected(`Unexpected fixture API request: ${method} ${path}`);
    },
    subscribe: () => () => {},
  },
  localExecution: { status: async () => ({ state: "ONLINE", backendBaseUrl: "http://fixture.invalid", deviceId,
    capabilities: ["project.render"], projectRenderEnabled: true, unfinishedRenderCount: 0, lastError: null }) },
  render: {
    preflight: async (input: { assetIds: string[]; estimatedOutputBytes: number; requiredTemporaryBytes: number }) => ({
      ready: true, blockers: [], warnings: [], assets: input.assetIds.map((assetId) => ({ assetId, state: "AVAILABLE", message: null })),
      diskFreeBytes: 10_000_000_000, estimatedOutputBytes: input.estimatedOutputBytes, requiredTemporaryBytes: input.requiredTemporaryBytes,
    }),
    chooseDestination: async () => {
      const token = `destination-${++state.folders}`; const directory = `D:/fixture/export-${state.folders}`;
      state.directories[token] = directory; persist(); return { token, directory };
    },
    bindDestination: async ({ token, jobId }: { token: string; jobId: string }) => {
      const directory = state.directories[token];
      if (!directory || !Object.values(state.accepted).some(({ job }) => job.jobId === jobId)) return unexpected("Binding unknown destination/job");
      state.bound[jobId] = directory; delete state.directories[token]; persist(); return { directory };
    },
    deliverArtifact: async ({ jobId }: { jobId: string }) => {
      const directory = state.bound[jobId]; if (!directory) return unexpected("Delivery without bound destination");
      state.deliveryStarted.push(jobId); persist();
      if (new URLSearchParams(location.search).get("mode") === "deferred" && state.deliveryStarted.length === 1) {
        await firstDeliveryGate;
      }
      const path = new URLSearchParams(location.search).get("mode") === "longpath"
        ? `${directory.replaceAll("/", "\\")}\\${"SubtitleRenderRegression".repeat(8)}${jobId}.mp4`
        : `${directory}/${jobId}.mp4`;
      state.deliveries.push({ jobId, path }); persist(); return { path };
    },
  },
} as unknown as typeof window.narrativex;
(window as unknown as { renderDialogFixture: FixtureState }).renderDialogFixture = state;

function Fixture() {
  const [open, setOpen] = useState(true);
  const controller = useRenderController({ projectId, timeline, projectName: "Render regression fixture" });
  return <><button onClick={() => setOpen(true)}>Open render dialog</button>
    <aside aria-label="Inspector subtitle fixture" style={{ width: 320, padding: 12 }}>
      <SubtitleSettingsPanel controller={controller} variant="inspector" />
    </aside>
    <RenderDialog open={open} onClose={() => setOpen(false)} controller={controller} /></>;
}
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
