import { useEffect, useRef, useState } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DesktopChapterStory } from "../../../../shared/api-types";
import { runReviewBatch } from "../../../lib/review-batch";
import { storyApi } from "../../story/api/story.api";
import { storyboardApi } from "../../storyboard/api/storyboard.api";
import { invalidateVisualBeatReviewQueries } from "../../storyboard/queries/storyboard.queries";

export function ChapterBulkReview({ projectId, chapterId, story, onProceed }: {
  projectId: string;
  chapterId: string;
  story: DesktopChapterStory;
  onProceed?: () => void;
}) {
  const client = useQueryClient();
  const mutationKey = ["chapter-bulk-review", projectId, chapterId];
  const batchBusy = useIsMutating({ mutationKey }) > 0;
  const [completed, setCompleted] = useState(0);
  const [submitted, setSubmitted] = useState<Array<{ id: string; label: string }>>([]);
  const controller = useRef<AbortController | null>(null);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);
  const reload = async () => {
    setRefreshing(true);
    try {
      await invalidateVisualBeatReviewQueries(client, projectId, chapterId, { throwOnError: true });
      setRefreshError(false);
    } catch { setRefreshError(true); }
    finally { setRefreshing(false); }
  };
  const beats = story.scenes.flatMap((scene) => scene.storyBeats);
  const pendingStory = beats.filter((beat) => beat.persistenceState === "PERSISTED" && beat.reviewStatus === "NEEDS_REVIEW");
  const pendingVisual = beats.flatMap((beat) => beat.visualBeats).filter((beat) => beat.reviewStatus === "NEEDS_REVIEW");
  const targets = [
    ...pendingStory.map((beat) => ({ id: beat.id, label: beat.title || beat.summary, write: () => storyApi.updateStoryBeatReviewStatus(projectId, chapterId, beat.id, "APPROVED", beat.rowVersion) })),
    ...pendingVisual.map((beat) => ({ id: beat.id, label: beat.title, write: () => storyboardApi.updateReviewStatus(projectId, chapterId, beat.sceneId, beat.id, beat.rowVersion, "APPROVED") })),
  ];
  const mutation = useMutation({
    mutationKey,
    mutationFn: () => {
      setCompleted(0);
      setSubmitted(targets);
      setCancelRequested(false);
      controller.current = new AbortController();
      return runReviewBatch(targets, (target) => target.write(), setCompleted, controller.current.signal);
    },
    onSettled: reload,
  });

  return <section aria-label="Duyệt kịch bản và cảnh" className="rounded-lg border border-border-subtle bg-surface-panel p-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-label text-text-secondary">
        <p className="font-semibold text-foreground">Duyệt kịch bản và cảnh</p>
        <p>{pendingStory.length} nhịp kịch bản · {pendingVisual.length} cảnh chờ duyệt</p>
        <p className="mt-1 text-text-muted">Áp dụng cho các mục chờ duyệt của chương; giữ nguyên mục đã duyệt, bị từ chối hoặc chưa sẵn sàng.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={batchBusy || refreshing || refreshError || targets.length === 0} onClick={() => mutation.mutate()}>
          <CheckCheck size={14} aria-hidden="true" />
          {mutation.isPending ? `Đang duyệt ${completed}/${submitted.length}…` : batchBusy ? "Đang duyệt…" : `Duyệt tất cả (${targets.length})`}
        </Button>
        {mutation.isPending && <Button type="button" variant="outline" disabled={cancelRequested || refreshing} onClick={() => { controller.current?.abort(); setCancelRequested(true); }}>{cancelRequested ? "Đang dừng sau yêu cầu hiện tại…" : "Dừng các mục chưa gửi"}</Button>}
        {onProceed && <Button type="button" disabled={batchBusy} onClick={onProceed}>Sang sản xuất</Button>}
      </div>
    </div>
    {mutation.data && <div role="status" className="mt-2 text-label text-text-secondary">
      Đã lưu {mutation.data.succeeded.length} mục · {mutation.data.failed.length} mục chưa xác nhận · {mutation.data.unattempted.length} mục chưa gửi.
      {mutation.data.stopReason === "unavailable" && <p className="text-warning">Đã dừng do lỗi kết nối hoặc dịch vụ. Kiểm tra trạng thái mới nhất trước khi duyệt tiếp.</p>}
      {mutation.data.stopReason === "cancelled" && <p>Đã dừng theo yêu cầu; giữ nguyên các mục đã lưu.</p>}
      {mutation.data.failed.length > 0 && <details className="mt-1 text-danger"><summary>Xem các mục chưa lưu</summary>
        {mutation.data.failed.map((failure) => <p key={failure.id}>{submitted.find((item) => item.id === failure.id)?.label || failure.id}: {failure.message}</p>)}
        <p>Hãy kiểm tra dữ liệu mới nhất trước khi duyệt lại.</p>
      </details>}
    </div>}
    {refreshError && <div role="alert" className="mt-2 text-label text-danger">Không tải lại được trạng thái. Kết quả lưu ở trên được giữ lại; dữ liệu danh sách có thể đã cũ. <Button type="button" variant="outline" disabled={refreshing} onClick={() => void reload()}>{refreshing ? "Đang tải lại…" : "Tải lại trạng thái"}</Button></div>}
    {mutation.error && <p role="alert" className="mt-2 text-label text-danger">Không hoàn tất được lượt duyệt. Hãy tải lại chương để kiểm tra trạng thái đã lưu.</p>}
  </section>;
}
