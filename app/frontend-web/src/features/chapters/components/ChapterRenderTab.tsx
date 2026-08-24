"use client";

import { ArrowUpRight, Clapperboard } from "lucide-react";
import { RenderFailure } from "@/features/render/components/RenderFailure";
import { RenderPreview } from "@/features/render/components/RenderPreview";
import { RenderProgress } from "@/features/render/components/RenderProgress";
import { RenderSettings } from "@/features/render/components/RenderSettings";
import { RenderTimelineEditor } from "@/features/render/components/RenderTimelineEditor";
import type { UseChapterRenderResult } from "@/features/render/hooks/useChapterRender";

interface ChapterRenderTabProps {
  render: UseChapterRenderResult;
  resolution: "720p" | "1080p";
  onResolutionChange: (resolution: "720p" | "1080p") => void;
  onOpenProduction: () => void;
}

export function ChapterRenderTab({
  render,
  resolution,
  onResolutionChange,
  onOpenProduction,
}: Readonly<ChapterRenderTabProps>) {
  const isSubmitting = render.status === "SUBMITTING";
  const editorLocked =
    render.status === "SUBMITTING" ||
    render.status === "QUEUED" ||
    render.status === "RUNNING" ||
    render.status === "RESOLVING_ARTIFACT";

  return (
    <section className="space-y-5 rounded-2xl border border-border-dark bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
            Chapter preview &amp; render
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">IMAGE_MOTION chapter preview</h2>
          <p className="mt-1 text-sm text-slate-400">
            Chỉnh timing/motion và render riêng Chapter này để review. Final video của toàn project được
            dựng ở Production Timeline, nơi tất cả chapter dùng chung một global clock.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenProduction}
          className="flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3.5 py-2 text-sm font-semibold text-orange-200 transition hover:border-orange-400 hover:bg-orange-500/15 hover:text-white"
        >
          <Clapperboard className="h-4 w-4" />
          Open in Production
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      <RenderTimelineEditor
        storyboard={render.storyboard}
        loading={render.storyboardLoading}
        mediaDetails={render.mediaDetails}
        beatOverrides={render.beatOverrides}
        onOverrideChange={render.updateBeatOverride}
        onReset={render.resetBeatOverrides}
        disabled={editorLocked}
      />

      <RenderSettings
        resolution={resolution}
        onResolutionChange={onResolutionChange}
        onRender={() => render.render()}
        isLoading={isSubmitting}
        canRender={render.canRender}
        isReady={render.status === "READY"}
      />

      {render.mediaMessage ? <p className="text-sm text-slate-300">{render.mediaMessage}</p> : null}
      {render.status === "RUNNING" ||
      render.status === "QUEUED" ||
      render.status === "SUBMITTING" ||
      render.status === "RESOLVING_ARTIFACT" ? (
        render.job ? (
          <RenderProgress job={render.job} status={render.status} progress={render.progress} />
        ) : (
          <p className="text-sm text-slate-300" role="status">
            Đang xác nhận chapter render job…
          </p>
        )
      ) : null}
      {render.status === "FAILED" ? (
        <RenderFailure
          message={render.error ?? "Chapter render thất bại."}
          onRetry={render.retry}
          retryDisabled={isSubmitting}
        />
      ) : null}
      {render.status === "READY" && render.artifact ? (
        <RenderPreview artifact={render.artifact} />
      ) : null}
    </section>
  );
}
