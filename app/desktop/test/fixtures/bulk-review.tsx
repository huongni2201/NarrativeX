import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BulkTakeReview } from "../../src/renderer/features/storyboard/components/BulkTakeReview";
import { ChapterBulkReview } from "../../src/renderer/features/chapters/components/ChapterBulkReview";
import type { DesktopChapterStory, DesktopShot } from "../../src/shared/api-types";
import "../../src/renderer/styles.css";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const scenario = new URLSearchParams(location.search).get("scenario");
const take = (id: string, attemptNumber: number) => ({ id, shotId: "shot-a", attemptNumber, status: "PASSED", validationResult: { passed: true }, outputAssetId: `asset-${id}`, sourceDurationMs: 4000 });
const shots = [
  { id: "shot-a", narrativePurpose: "Lan mở cửa", takes: [take("take-a", 1), take("take-a-new", 2)] },
  { id: "shot-b", narrativePurpose: "Minh nhìn ra sân", takes: [{ ...take("take-b", 1), shotId: "shot-b" }] },
  { id: "selected", narrativePurpose: "Đã chọn", selectedTake: { takeId: "keep" }, takes: [take("keep", 1)] },
] as unknown as DesktopShot[];
if (scenario === "fatal" || scenario === "cancel") shots.push({ id: "shot-c", narrativePurpose: "Lan ra sân", takes: [take("take-c", 1)] } as unknown as DesktopShot);
const story = { scenes: [{ storyBeats: [
  { id: "story-a", persistenceState: "PERSISTED", reviewStatus: "NEEDS_REVIEW", rowVersion: 7, visualBeats: [{ id: "visual-a", sceneId: "scene", rowVersion: 3, reviewStatus: "NEEDS_REVIEW" }] },
  { id: "rejected", persistenceState: "PERSISTED", reviewStatus: "REJECTED", visualBeats: [] },
  { id: "synthetic", persistenceState: "SYNTHETIC", reviewStatus: "NEEDS_REVIEW", visualBeats: [] },
] }] } as unknown as DesktopChapterStory;
const calls: unknown[] = [];
let recovered = false;
window.addEventListener("restore-bulk-backend", () => { recovered = true; });
window.narrativex = { api: { request: async ({ method = "GET", path, body }: { method?: string; path: string; body?: string }) => {
  const response = (status: number, data: unknown, message = "OK") => ({ status, statusText: message, bodyText: JSON.stringify({ success: status === 200, message, timestamp: new Date().toISOString(), data }) });
  if (method === "GET") {
    if (scenario === "refresh" && calls.length > 0 && !recovered) return response(503, null, "Backend chưa sẵn sàng");
    return response(200, { scenes: [{ visualBeats: [{ shotSequence: { shots } }] }] });
  }
  calls.push({ path, input: JSON.parse(body!) });
  sessionStorage.setItem("bulk-calls", JSON.stringify(calls));
  if (scenario === "cancel" && calls.length === 1) await new Promise((resolve) => window.addEventListener("release-bulk-write", resolve, { once: true }));
  if (scenario === "fatal" && path.includes("shot-b")) return response(503, null, "Backend tạm ngừng");
  if (scenario === "partial" && path.includes("shot-b")) return response(409, null, "Shot đã được chọn ở cửa sổ khác");
  const shot = shots.find((item) => path.includes(item.id));
  if (shot) shot.selectedTake = { ...JSON.parse(body!), rowVersion: 1 };
  return response(200, {});
} } } as unknown as Window["narrativex"];

createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}>
  <main className="mx-auto max-w-4xl space-y-4 p-4">
    <p>Isolated fixture — deterministic test data</p>
    <ChapterBulkReview projectId="project" chapterId="chapter" story={story} />
    <BulkTakeReview projectId="project" chapterId="chapter" />
  </main>
</QueryClientProvider>);
