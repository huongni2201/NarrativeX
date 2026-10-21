import { AlertCircle, CheckCircle2, Clock, Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StoryboardVisualBeat } from "../api/storyboard.api";
import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url";
import {
  hasPendingVisualBeatImageAttempt,
  useCreateVisualBeatImageAttempt,
  useReviewVisualBeatImageAttempt,
  useSelectVisualBeatImageAttempt,
  useVisualBeatImageAttempts,
} from "../../generation/queries/generation.queries";

export function VisualBeatImageAttemptsPanel({
  projectId,
  chapterId,
  beat,
}: Readonly<{
  projectId: string;
  chapterId?: string | null;
  beat: StoryboardVisualBeat;
}>) {
  const attempts = useVisualBeatImageAttempts(projectId, chapterId ?? null, beat.id);
  const createAttempt = useCreateVisualBeatImageAttempt();
  const reviewAttempt = useReviewVisualBeatImageAttempt();
  const selectAttempt = useSelectVisualBeatImageAttempt();
  const hasPendingRequest = hasPendingVisualBeatImageAttempt(projectId, beat.id);

  const orderedAttempts = [...(attempts.data ?? [])].reverse();
  const canGenerate = beat.reviewStatus === "APPROVED" && Boolean(chapterId);
  const createOrReconcile = () => {
    if (!chapterId) return;
    createAttempt.mutate({
      projectId,
      chapterId,
      visualBeatId: beat.id,
      input: {},
      reconcile: hasPendingRequest,
    });
  };

  const hasActionableAttempt = orderedAttempts.some(
    (attempt) =>
      attempt.currentStoryboardRevision &&
      attempt.executionStatus === "READY" &&
      (attempt.reviewStatus === "NEEDS_REVIEW" ||
        (attempt.reviewStatus === "APPROVED" && attempt.mediaAssetId !== beat.previewMediaAssetId)),
  );

  return (
    <section className="rounded-md bg-surface-dark p-2.5" aria-label={`Ảnh cho ${beat.title}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h4
            className="text-label font-semibold text-foreground"
            title="Ảnh đang dùng chỉ đổi khi bạn chọn rõ ràng một ảnh ứng viên đã duyệt."
          >
            Ảnh Beat
          </h4>
          <span className="truncate text-caption text-text-muted">
            {orderedAttempts.length > 0 ? `${orderedAttempts.length} ứng viên` : "Chưa có ảnh"}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 text-caption"
          disabled={!canGenerate || createAttempt.isPending}
          onClick={createOrReconcile}
          title={canGenerate ? undefined : "Duyệt visual của Beat trước khi tạo ảnh."}
          aria-label={hasPendingRequest ? `Đối soát yêu cầu ảnh của ${beat.title}` : `${beat.previewMediaAssetId ? "Tạo lại ảnh" : "Tạo ảnh"} cho ${beat.title}`}
        >
          {createAttempt.isPending ? (
            <>
              <Loader2 size={13} className="mr-1.5 animate-spin" /> Đang gửi…
            </>
          ) : hasPendingRequest ? (
            "Đối soát yêu cầu ảnh"
          ) : beat.previewMediaAssetId ? (
            <>
              <RotateCcw size={13} className="mr-1.5" /> Tạo lại ảnh
            </>
          ) : (
            "Tạo ảnh"
          )}
        </Button>
      </div>

      {!canGenerate && (
        <p className="mt-1.5 text-caption text-warning" role="status">
          Duyệt visual của Beat (nút bên dưới) trước khi tạo ảnh.
        </p>
      )}
      {createAttempt.isError && (
        <p className="mt-2 flex items-start gap-1.5 text-caption text-destructive" role="alert">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {createAttempt.error instanceof Error
            ? createAttempt.error.message
            : "Yêu cầu ảnh chưa được xác nhận. Hãy đối soát trước khi thử lại."}
        </p>
      )}

      {attempts.isLoading ? (
        <p className="mt-3 inline-flex items-center gap-2 text-caption text-text-muted">
          <Loader2 size={13} className="animate-spin" /> Đang tải lịch sử ảnh…
        </p>
      ) : attempts.isError ? (
        <p className="mt-3 text-caption text-destructive" role="alert">
          Không tải được lịch sử ảnh cho Beat này.
        </p>
      ) : orderedAttempts.length === 0 ? null : (
        <details className="group mt-2" open={hasActionableAttempt}>
          <summary className="cursor-pointer text-caption text-text-dim hover:text-text-muted">
            Xem ảnh ứng viên
          </summary>
        <div className="mt-2 grid gap-2">
          {orderedAttempts.map((attempt, index) => {
            const isSelected = attempt.mediaAssetId === beat.previewMediaAssetId;
            const canReview =
              attempt.executionStatus === "READY" && attempt.reviewStatus === "NEEDS_REVIEW";
            const canSelect =
              attempt.executionStatus === "READY" &&
              attempt.reviewStatus === "APPROVED" &&
              attempt.currentStoryboardRevision &&
              Boolean(attempt.mediaAssetId);

            return (
              <article key={attempt.itemId} className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 rounded bg-surface-panel p-2">
                {attempt.mediaAssetId ? (
                  <img
                    src={localAssetPreviewUrl(projectId, attempt.mediaAssetId)}
                    alt={`Image candidate ${index + 1} for ${beat.title}`}
                    loading="lazy"
                    className="aspect-video w-full rounded border border-border-soft bg-black object-contain"
                  />
                ) : (
                  <div className="grid aspect-video place-items-center rounded border border-border-soft bg-black text-caption text-text-muted">
                    <Clock size={15} />
                  </div>
                )}
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-caption font-semibold text-foreground">Candidate {index + 1}</span>
                    <Badge
                      variant="outline"
                      className={`text-caption ${isSelected ? "border-success/30 bg-success-bg text-success" : "text-text-muted"}`}
                    >
                      {isSelected ? "ĐANG DÙNG" : attempt.reviewStatus}
                    </Badge>
                    <Badge variant="outline" className="text-caption">{attempt.executionStatus}</Badge>
                  </div>
                  {!attempt.currentStoryboardRevision && (
                    <p className="text-caption text-warning">Ảnh thuộc storyboard revision cũ; không thể chọn cho Beat hiện tại.</p>
                  )}
                  {attempt.errorCode && <p className="text-caption text-destructive">{attempt.errorCode}</p>}
                  <div className="mt-auto flex flex-wrap gap-2">
                    {canReview && attempt.currentStoryboardRevision && chapterId && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={reviewAttempt.isPending}
                          onClick={() =>
                            reviewAttempt.mutate({
                              projectId,
                              chapterId,
                              visualBeatId: beat.id,
                              itemId: attempt.itemId,
                              decision: "APPROVED",
                              rowVersion: attempt.rowVersion,
                            })
                          }
                        >
                          <CheckCircle2 size={13} className="mr-1.5" /> Duyệt ảnh
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={reviewAttempt.isPending}
                          onClick={() =>
                            reviewAttempt.mutate({
                              projectId,
                              chapterId,
                              visualBeatId: beat.id,
                              itemId: attempt.itemId,
                              decision: "REJECTED",
                              rowVersion: attempt.rowVersion,
                            })
                          }
                        >
                          Từ chối
                        </Button>
                      </>
                    )}
                    {canSelect && chapterId && !isSelected && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={selectAttempt.isPending}
                        onClick={() =>
                          selectAttempt.mutate({
                            projectId,
                            chapterId,
                            visualBeatId: beat.id,
                            itemId: attempt.itemId,
                            expectedVisualBeatRowVersion: beat.rowVersion,
                          })
                        }
                      >
                        Chọn ảnh này
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        </details>
      )}

      {(reviewAttempt.isError || selectAttempt.isError) && (
        <p className="mt-2 text-caption text-destructive" role="alert">
          {(reviewAttempt.error ?? selectAttempt.error) instanceof Error
            ? (reviewAttempt.error ?? selectAttempt.error)?.message
            : "Không thể lưu review ảnh. Tải lại rồi thử lại."}
        </p>
      )}
    </section>
  );
}
