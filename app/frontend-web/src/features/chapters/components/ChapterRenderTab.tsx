"use client";

import { RenderFailure } from "@/features/render/components/RenderFailure";
import { RenderPreview } from "@/features/render/components/RenderPreview";
import { RenderProgress } from "@/features/render/components/RenderProgress";
import { RenderSettings } from "@/features/render/components/RenderSettings";
import type { UseChapterRenderResult } from "@/features/render/hooks/useChapterRender";

interface ChapterRenderTabProps {
  render: UseChapterRenderResult;
  resolution: "720p" | "1080p";
  onResolutionChange: (resolution: "720p" | "1080p") => void;
}

export function ChapterRenderTab({ render, resolution, onResolutionChange }: Readonly<ChapterRenderTabProps>) {
  const isSubmitting = render.status === "SUBMITTING";

  return (
    <section className="space-y-5 rounded-2xl border border-border-dark bg-surface p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Render &amp; export</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-100">IMAGE_MOTION render</h2>
        <p className="mt-1 text-sm text-slate-400">Render chỉ dùng đúng plan revision và các keyframe đã approve.</p>
      </div>

      <RenderSettings
        resolution={resolution}
        onResolutionChange={onResolutionChange}
        onRender={() => render.render()}
        isLoading={isSubmitting}
        canRender={render.canRender}
        isReady={render.status === "READY"}
      />

      {render.mediaMessage ? <p className="text-sm text-slate-300">{render.mediaMessage}</p> : null}
      {render.status === "RUNNING" || render.status === "QUEUED" || render.status === "SUBMITTING" || render.status === "RESOLVING_ARTIFACT" ? (
        render.job ? <RenderProgress job={render.job} status={render.status} progress={render.progress} /> : <p className="text-sm text-slate-300" role="status">Đang xác nhận render job…</p>
      ) : null}
      {render.status === "FAILED" ? <RenderFailure message={render.error ?? "Render thất bại."} onRetry={render.retry} retryDisabled={isSubmitting} /> : null}
      {render.status === "READY" && render.artifact ? <RenderPreview artifact={render.artifact} /> : null}
    </section>
  );
}
