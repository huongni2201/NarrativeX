import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ChapterProductionAudioCue,
  DesktopShot,
} from "../../../../shared/api-types";
import {
  useReplaceShotAudioCueAllocations,
  useShotAudioCueAllocations,
} from "../../production/queries/video-production.queries";

export function ShotAudioCueAllocationPanel({
  projectId,
  chapterId,
  sequenceId,
  shots,
  cues,
}: Readonly<{
  projectId: string;
  chapterId?: string | null;
  sequenceId: string;
  shots: DesktopShot[];
  cues: ChapterProductionAudioCue[];
}>) {
  const allocationQuery = useShotAudioCueAllocations(projectId, sequenceId);
  const replaceAllocations = useReplaceShotAudioCueAllocations(projectId, sequenceId, chapterId);
  const [draft, setDraft] = useState<{
    sequenceId: string;
    rowVersion: number;
    assignments: Record<string, string>;
  } | null>(null);

  if (shots.length === 0 || cues.length === 0) return null;

  const currentAllocations = allocationQuery.data?.allocations ?? [];
  const currentDraft = draft?.sequenceId === sequenceId ? draft : null;
  const automatic = shots.length === 1 && currentAllocations.length === 0;
  const shotByCueId =
    shots.length === 1
      ? Object.fromEntries(cues.map((cue) => [cue.id, shots[0].id]))
      : currentDraft?.assignments ??
        Object.fromEntries(currentAllocations.map((item) => [item.audioCueId, item.shotId]));
  const cueVersionIsStale = currentAllocations.some((allocation) => {
    const cue = cues.find((item) => item.id === allocation.audioCueId);
    return !cue || cue.rowVersion !== allocation.audioCueRowVersion;
  });
  const isComplete = cues.every((cue) => shots.some((shot) => shot.id === shotByCueId[cue.id]));
  const hasSavedAssignments =
    currentAllocations.length === cues.length &&
    cues.every((cue) => {
      const saved = currentAllocations.find((allocation) => allocation.audioCueId === cue.id);
      return saved?.shotId === shotByCueId[cue.id] && saved.audioCueRowVersion === cue.rowVersion;
    });

  const save = async () => {
    if (!allocationQuery.data || !isComplete) return;
    try {
      await replaceAllocations.mutateAsync({
        expectedRowVersion: currentDraft?.rowVersion ?? allocationQuery.data.rowVersion,
        allocations: cues.map((cue) => ({ audioCueId: cue.id, shotId: shotByCueId[cue.id] })),
      });
      setDraft(null);
    } catch {
      // Keep the draft and its original version; a refetch must not overwrite another editor.
    }
  };

  return (
    <section
      className="rounded-md bg-surface-dark p-2.5"
      aria-label="Phân bổ AudioCue cho Shot"
      aria-busy={replaceAllocations.isPending}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-label font-semibold text-foreground">Âm thanh của beat · {cues.length} cue</h3>
          <p className="mt-1 text-caption text-text-muted">
            {shots.length === 1
              ? "Beat có một Shot nên toàn bộ cue được dùng cho Shot này. Mỗi cue giữ vai trò và người nói của nó."
              : "Chọn Shot phát từng cue, rồi lưu phân bổ trước khi tạo video. Mỗi cue được phát một lần, trọn câu."}
          </p>
        </div>
        {hasSavedAssignments && !cueVersionIsStale && (
          <span className="inline-flex shrink-0 items-center gap-1 text-caption text-success">
            <CheckCircle2 size={13} /> Đã lưu
          </span>
        )}
      </div>

      {allocationQuery.isLoading ? (
        <p className="mt-3 inline-flex items-center gap-2 text-caption text-text-muted">
          <Loader2 size={13} className="animate-spin" /> Đang tải phân bổ cue…
        </p>
      ) : allocationQuery.isError ? (
        <div className="mt-3 text-caption text-destructive" role="alert">
          Không tải được phân bổ cue.
          <Button type="button" size="sm" variant="outline" onClick={() => void allocationQuery.refetch()}>Thử tải lại</Button>
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          {cues.map((cue) => (
            <div
              key={cue.id}
              className="grid gap-1.5 rounded bg-surface-panel p-2"
            >
              <div className="min-w-0 break-words text-caption text-text-secondary">
                <div>
                  <span className="font-semibold text-foreground">{cue.cueType}</span>
                  {cue.speakerName ? ` · ${cue.speakerName}` : cue.cueType === "DIALOGUE" || cue.cueType === "INNER_MONOLOGUE" ? " · Chưa xác định người nói" : " · Giọng ngoài hình"}
                </div>
                {cue.adaptedText?.trim() ? (
                  <div className="mt-1">
                    {cue.status !== "APPROVED" && (
                      <span className="text-warning">
                        {cue.status === "REJECTED" ? "Văn bản bị từ chối · " : "Văn bản chưa duyệt · "}
                      </span>
                    )}
                    {cue.adaptedText.length > 140 ? (
                      <details className="min-w-0">
                        <summary className="cursor-pointer break-words text-text-secondary">
                          <span className="line-clamp-2 break-words">{cue.adaptedText}</span>
                          <span className="text-primary">Xem toàn câu</span>
                        </summary>
                        <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded bg-surface-dark p-2">
                          {cue.adaptedText}
                        </p>
                      </details>
                    ) : (
                      <span className="break-words">{cue.adaptedText}</span>
                    )}
                  </div>
                ) : (
                  <span className="mt-1 block text-text-muted">
                    {cue.status === "APPROVED"
                      ? "Đã duyệt nhưng chưa có văn bản cue"
                      : cue.status === "REJECTED"
                        ? "Văn bản cue bị từ chối"
                        : "Chưa có văn bản cue"}
                  </span>
                )}
              </div>
              {shots.length > 1 && (
              <select
                aria-label={`Shot phát cue ${cue.orderIndex + 1}`}
                value={shotByCueId[cue.id] ?? ""}
                disabled={replaceAllocations.isPending || shots.length === 1}
                onChange={(event) => {
                  if (!allocationQuery.data) return;
                  replaceAllocations.reset();
                  setDraft({
                    sequenceId,
                    rowVersion: currentDraft?.rowVersion ?? allocationQuery.data.rowVersion,
                    assignments: { ...shotByCueId, [cue.id]: event.target.value },
                  });
                }}
                className="min-h-9 w-full rounded border border-border-subtle bg-surface-input px-2 text-caption text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Chọn Shot sở hữu cue</option>
                {shots.map((shot) => (
                  <option key={shot.id} value={shot.id}>
                    Shot {shot.orderIndex + 1} · {shot.narrativePurpose || "Chưa đặt mục đích"}
                  </option>
                ))}
              </select>
              )}
            </div>
          ))}
        </div>
      )}

      {(cueVersionIsStale || replaceAllocations.isError) && (
        <p className="mt-2 flex items-start gap-1.5 text-caption text-warning" role="alert">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {replaceAllocations.isError
            ? replaceAllocations.error instanceof Error
              ? replaceAllocations.error.message
              : "Lưu phân bổ thất bại hoặc có cửa sổ khác vừa thay đổi. Tải lại rồi thử lại."
            : "AudioCue đã đổi sau lần phân bổ trước. Lưu lại để ghim phiên bản mới."}
        </p>
      )}

      {allocationQuery.data && !allocationQuery.isError && (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-caption text-text-muted">
          {automatic ? "Tự động dùng toàn bộ cue" : hasSavedAssignments ? `${cues.length} cue đã lưu` : isComplete ? `${cues.length} cue đã chọn · Chưa lưu` : `Còn ${cues.filter((cue) => !shots.some((shot) => shot.id === shotByCueId[cue.id])).length} cue chưa gán`}
        </span>
        {currentDraft && (
          <Button type="button" size="sm" variant="outline" disabled={replaceAllocations.isPending || allocationQuery.isFetching}
            onClick={async () => {
              const result = await allocationQuery.refetch();
              if (result.isSuccess) {
                setDraft(null);
                replaceAllocations.reset();
              }
            }}>
            Bỏ thay đổi và tải lại
          </Button>
        )}
        {!automatic && (
        <Button
          type="button"
          size="sm"
          disabled={
            allocationQuery.isLoading ||
            allocationQuery.isError ||
            replaceAllocations.isPending ||
            !isComplete ||
            (hasSavedAssignments && !cueVersionIsStale)
          }
          onClick={() => void save()}
        >
          {replaceAllocations.isPending ? "Đang lưu…" : "Lưu phân bổ"}
        </Button>
        )}
      </div>
      )}
    </section>
  );
}
