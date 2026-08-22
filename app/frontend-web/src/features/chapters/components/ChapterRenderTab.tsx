"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiErrorMessage } from "@/shared/api/client";
import { mediaApi } from "@/features/generation/api/media.api";
import { useMediaGeneration } from "@/features/generation/hooks/useMediaGeneration";

export function ChapterRenderTab({ projectId, chapterId }: Readonly<{ projectId: number; chapterId: number }>) {
  const media = useMediaGeneration(projectId, chapterId);
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ready = Boolean(media.details && media.details.totalItems > 0 && media.details.readyItems === media.details.totalItems && media.details.reviewItems === 0 && media.job?.mediaPlanId && media.job.mediaPlanRevision);
  const render = async () => {
    if (!ready || !media.job?.mediaPlanId || !media.job.mediaPlanRevision) return;
    setPending(true); setMessage(null);
    try { const job = await mediaApi.render(projectId, chapterId, { mediaPlanId: media.job.mediaPlanId, mediaPlanRevision: media.job.mediaPlanRevision, resolution, format: "mp4", maxAuthorizedCost: "0.500000" }, crypto.randomUUID()); setMessage(`Render job ${job.status.toLowerCase()}.`); } catch (error) { setMessage(apiErrorMessage(error, "Không thể bắt đầu render.")); } finally { setPending(false); }
  };
  return <section className="space-y-5 rounded-2xl border border-border-dark bg-surface p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Render & export</p><h2 className="mt-1 text-xl font-semibold text-slate-100">IMAGE_MOTION render</h2><p className="mt-1 text-sm text-slate-400">Render chỉ dùng đúng plan revision và các keyframe đã approve.</p></div><div className="flex flex-wrap items-end gap-3"><label className="text-sm text-slate-300">Resolution<select className="mt-2 block rounded-lg border border-border-dark bg-surface-panel px-3 py-2 text-slate-100" value={resolution} onChange={(event) => setResolution(event.target.value as "720p" | "1080p")}><option value="720p">720p</option><option value="1080p">1080p</option></select></label><Button onClick={render} isLoading={pending} disabled={!ready}>{pending ? "Đang xếp hàng…" : ready ? "Render Chapter" : "Approve toàn bộ keyframe để render"}</Button></div>{message && <p className="text-sm text-slate-300">{message}</p>}</section>;
}
