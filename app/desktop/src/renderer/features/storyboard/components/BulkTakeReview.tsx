import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { TakeContentReviewChecklist } from "../../../../shared/api-types";
import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url";
import { runReviewBatch } from "../../../lib/review-batch";
import { videoProductionApi } from "../../production/api/video-production.api";
import { refreshProduction } from "../../production/queries/production-cache";
import { useChapterProduction } from "../../production/queries/video-production.queries";
import { bulkTakeCandidates, TAKE_REVIEW_ITEMS, takeReviewChecklist as emptyReview } from "../../production/model/take-review";
import { TakeQualityBadge } from "./TakeQualityPanel";

type Candidates = ReturnType<typeof bulkTakeCandidates>;

export function BulkTakeReview({ projectId, chapterId }: { projectId: string; chapterId: string }) {
  const production = useChapterProduction(projectId, chapterId);
  const [open, setOpen] = useState(false);
  const shots = production.data?.scenes.flatMap((scene) => scene.visualBeats.flatMap((beat) => beat.shotSequence?.shots ?? [])) ?? [];
  const candidates = bulkTakeCandidates(shots);
  return <section aria-label="Duyệt Take hàng loạt" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-panel p-3">
    <div className="text-label text-text-secondary">
      <p className="font-semibold text-foreground">Duyệt Take hàng loạt</p>
      <p>{production.isError ? "Không tải được danh sách Take." : production.isPending ? "Đang tải Take…" : `${candidates.length} Shot chưa chọn có Take đủ điều kiện kỹ thuật.`}</p>
      <p className="mt-1 text-text-muted">Xem ứng viên và chỉnh In/Out trước khi xác nhận chung. Giữ nguyên Take đã chọn.</p>
    </div>
    {production.isError && <Button type="button" variant="outline" disabled={production.isFetching} onClick={() => void production.refetch()}>{production.isFetching ? "Đang tải lại…" : "Tải lại danh sách Take"}</Button>}
    <Button type="button" variant="outline" disabled={production.isPending || production.isError || candidates.length === 0} onClick={() => setOpen(true)}>Duyệt tất cả Take ({candidates.length})</Button>
    {open && <BulkTakeReviewDialog projectId={projectId} chapterId={chapterId} candidates={candidates} onClose={() => setOpen(false)} />}
  </section>;
}

function BulkTakeReviewDialog({ projectId, chapterId, candidates, onClose }: {
  projectId: string; chapterId: string; candidates: Candidates; onClose: () => void;
}) {
  const client = useQueryClient();
  // Snapshot the displayed choices; polling must not change a choice during review.
  const [rows, setRows] = useState(() => candidates.map(({ shot, takes }) => ({
    id: shot.id, title: shot.narrativePurpose, takes, takeId: takes[0].id,
    sourceInMs: 0, sourceOutMs: takes[0].sourceDurationMs!, included: true,
  })));
  const [checklist, setChecklist] = useState<TakeContentReviewChecklist>(() => emptyReview());
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof runReviewBatch>> | null>(null);
  const [refreshError, setRefreshError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const requestStop = () => { controller.current?.abort(); setCancelRequested(true); };
  const reload = async () => {
    setRefreshing(true);
    try {
      await refreshProduction(client, projectId, chapterId, { throwOnError: true });
      setRefreshError(false);
    } catch { setRefreshError(true); }
    finally { setRefreshing(false); }
  };
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const selected = rows.filter((row) => row.included);
  const valid = selected.length > 0 && selected.every((row) => {
    const take = row.takes.find((item) => item.id === row.takeId)!;
    return Number.isSafeInteger(row.sourceInMs) && Number.isSafeInteger(row.sourceOutMs) &&
      row.sourceInMs >= 0 && row.sourceOutMs > row.sourceInMs && row.sourceOutMs <= take.sourceDurationMs!;
  });
  const reviewed = TAKE_REVIEW_ITEMS.every(({ key }) => checklist[key]);
  const updateRow = (id: string, patch: Partial<typeof rows[number]>) => {
    setRows((previous) => previous.map((row) => row.id === id ? { ...row, ...patch } : row));
    setChecklist(emptyReview());
  };
  const save = async () => {
    if (busy || result || !valid || !reviewed) return;
    setBusy(true);
    controller.current = new AbortController();
    const outcome = await runReviewBatch(selected, (row) => videoProductionApi.selectTake(projectId, row.id, {
      takeId: row.takeId, sourceInMs: row.sourceInMs, sourceOutMs: row.sourceOutMs,
      expectedRowVersion: 0, contentReview: checklist,
    }), setCompleted, controller.current.signal);
    setResult(outcome);
    setBusy(false);
    await reload();
  };

  return <Dialog open onOpenChange={(open) => { if (!open) { if (busy) requestStop(); else onClose(); } }}>
    <DialogContent className="w-[min(900px,calc(100vw-32px))]">
      <DialogTitle>Duyệt và chọn Take hàng loạt</DialogTitle>
      <DialogDescription>Mỗi Shot đề xuất Take mới nhất đạt kỹ thuật. Kiểm tra ứng viên, bỏ chọn Shot không muốn duyệt và xác nhận checklist cho toàn bộ mục đã đánh dấu. Các thay đổi chỉ được lưu khi bấm nút bên dưới.</DialogDescription>
      <fieldset disabled={busy || Boolean(result)} className="min-w-0 space-y-3">
        {rows.map((row, index) => {
          const take = row.takes.find((item) => item.id === row.takeId)!;
          return <article key={row.id} className="rounded-lg border border-border-subtle bg-surface-panel p-3">
            <label className="flex items-start gap-2 text-body font-semibold"><input type="checkbox" className="accent-primary" checked={row.included} onChange={(event) => updateRow(row.id, { included: event.target.checked })} />Shot {index + 1}: {row.title}</label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <video key={take.id} src={localAssetPreviewUrl(projectId, take.outputAssetId!)} controls preload="none" className="aspect-video w-full rounded bg-surface-dark" onError={() => setPreviewErrors((previous) => previous.includes(take.id) ? previous : [...previous, take.id])} aria-label={`Xem trước Shot ${index + 1}`} />
              <div className="min-w-0 space-y-2 text-label">
                <label className="block">Take cho Shot {index + 1}<select className="nx-inspector-input mt-1 w-full" value={row.takeId} onChange={(event) => {
                  const next = row.takes.find((item) => item.id === event.target.value)!;
                  updateRow(row.id, { takeId: next.id, sourceInMs: 0, sourceOutMs: next.sourceDurationMs! });
                }}>{row.takes.map((item) => <option key={item.id} value={item.id}>Take #{item.attemptNumber} · {item.sourceDurationMs} ms</option>)}</select></label>
                <TakeQualityBadge quality={take.quality} />
                <div className="flex gap-2">
                  <label className="min-w-0 flex-1">In (ms)<input type="number" className="nx-inspector-input mt-1 w-full" min={0} step={1} value={row.sourceInMs} onChange={(event) => updateRow(row.id, { sourceInMs: event.target.valueAsNumber })} /></label>
                  <label className="min-w-0 flex-1">Out (ms)<input type="number" className="nx-inspector-input mt-1 w-full" max={take.sourceDurationMs!} step={1} value={row.sourceOutMs} onChange={(event) => updateRow(row.id, { sourceOutMs: event.target.valueAsNumber })} /></label>
                </div>
                {previewErrors.includes(take.id) && <p role="alert" className="text-danger">Không mở được preview. Hãy kiểm tra media trước khi xác nhận duyệt.</p>}
              </div>
            </div>
          </article>;
        })}
        <div className="rounded-lg border border-border-subtle p-3 text-label">
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="accent-primary" checked={reviewed} onChange={(event) => setChecklist(emptyReview(event.target.checked))} />Tôi đã kiểm tra tất cả tiêu chí cho {selected.length} Take được đánh dấu</label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{TAKE_REVIEW_ITEMS.map(({ key, label }) => <label key={key} className="flex items-center gap-2"><input type="checkbox" className="accent-primary" checked={checklist[key]} onChange={(event) => setChecklist((previous) => ({ ...previous, [key]: event.target.checked }))} />{label}</label>)}</div>
          <p className="mt-2 text-text-muted">Đổi Take, In/Out hoặc phạm vi sẽ yêu cầu xác nhận lại. QC tự động chỉ tham khảo.</p>
        </div>
      </fieldset>
      {result && <div role="status" className="text-label">
        <p>Đã chọn {result.succeeded.length} Take · {result.failed.length} mục chưa xác nhận · {result.unattempted.length} mục chưa gửi.</p>
        {result.stopReason === "unavailable" && <p className="text-warning">Đã dừng do lỗi kết nối hoặc dịch vụ. Không tự gửi lại các mục chưa xác nhận.</p>}
        {result.stopReason === "cancelled" && <p>Đã dừng theo yêu cầu; giữ nguyên các Take đã chọn.</p>}
        {result.failed.map((failure) => <p key={failure.id} className="text-danger">Shot {rows.findIndex((row) => row.id === failure.id) + 1}: {failure.message}</p>)}
        {(result.failed.length > 0 || refreshError) && <p>Đóng và tải lại danh sách để kiểm tra trạng thái mới nhất trước khi duyệt tiếp.</p>}
      </div>}
      {refreshError && <div role="alert" className="text-label text-danger">Không tải lại được trạng thái. Kết quả lưu ở trên được giữ lại; danh sách có thể đã cũ. <Button type="button" variant="outline" disabled={refreshing} onClick={() => void reload()}>{refreshing ? "Đang tải lại…" : "Tải lại trạng thái"}</Button></div>}
      {!valid && !result && <p role="status" className="text-label text-warning">Chọn ít nhất một Shot và đặt 0 ≤ In &lt; Out ≤ thời lượng nguồn.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {busy && <Button type="button" variant="outline" disabled={cancelRequested} onClick={requestStop}>{cancelRequested ? "Đang dừng sau yêu cầu hiện tại…" : "Dừng các mục chưa gửi"}</Button>}
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Đóng</Button>
        <Button type="button" disabled={busy || Boolean(result) || !valid || !reviewed} onClick={() => void save()}>{busy ? `Đang lưu ${completed}/${selected.length}…` : `Duyệt và chọn ${selected.length} Take`}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
