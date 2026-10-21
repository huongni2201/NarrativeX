import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShotAudioCueAllocationPanel } from "../../src/renderer/features/storyboard/components/ShotAudioCueAllocationPanel";
import type { ChapterProductionAudioCue, DesktopShot, ShotAudioCueAllocationSet } from "../../src/shared/api-types";
import "../../src/renderer/styles.css";

const scenario = new URLSearchParams(location.search).get("scenario");
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
let state: ShotAudioCueAllocationSet = { sequenceId: "sequence", rowVersion: 0, allocations: [] };
if (scenario === "stale") state = { ...state, rowVersion: 1, allocations: [
  { audioCueId: "cue-0", shotId: "removed-shot", audioCueRowVersion: -1 },
  { audioCueId: "cue-1", shotId: "removed-shot", audioCueRowVersion: -1 },
] };
let failLoad = scenario === "error";
const cues: ChapterProductionAudioCue[] = ["Lan", "Nam"].map((speakerName, index) => ({
  id: `cue-${index}`, storyBeatId: "beat", orderIndex: index, cueType: "DIALOGUE", speakerName,
  adaptedText: index === 0 ? "Bạn đã tìm được chiếc chìa khóa chưa?" : "Tôi tìm thấy nó ở bên cửa sổ.",
  status: "APPROVED", voiceReady: true, rowVersion: 0,
}));
const shots = Array.from({ length: scenario === "single" || scenario === "stale" ? 1 : 2 }, (_, orderIndex) => ({
  id: `shot-${orderIndex}`, sequenceId: "sequence", orderIndex, narrativePurpose: `Góc quay ${orderIndex + 1}`,
})) as DesktopShot[];

window.narrativex = { api: { request: async ({ method = "GET", body }: { method?: string; body?: string }) => {
  const response = (status: number, data: unknown, message = "OK") => ({ status, statusText: message,
    bodyText: JSON.stringify({ success: status === 200, message, timestamp: new Date().toISOString(), data }) });
  if (method === "GET") {
    if (failLoad) { failLoad = false; return response(503, null, "Không tải được phân bổ"); }
    return response(200, state);
  }
  const input = JSON.parse(body!);
  sessionStorage.setItem("allocation-input", body!);
  if (input.expectedRowVersion !== state.rowVersion) return response(409, null, "Phân bổ đã thay đổi ở cửa sổ khác. Hãy tải lại.");
  state = { ...state, rowVersion: state.rowVersion + 1,
    allocations: input.allocations.map((item: object) => ({ ...item, audioCueRowVersion: 0 })) };
  return response(200, state);
} } } as unknown as Window["narrativex"];

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <main className="mx-auto max-w-2xl p-4">
      <button onClick={() => {
        state = { ...state, rowVersion: state.rowVersion + 1, allocations: cues.map((cue) => ({ audioCueId: cue.id, shotId: "shot-1", audioCueRowVersion: 0 })) };
        void client.invalidateQueries();
      }}>Cập nhật từ cửa sổ khác</button>
      <ShotAudioCueAllocationPanel projectId="project" sequenceId="sequence" shots={shots} cues={cues} />
    </main>
  </QueryClientProvider>,
);
