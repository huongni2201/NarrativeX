"use client";

import type { MediaJobDetails } from "@/features/generation/api/media.api";
import type {
  ApiChapterStoryboard,
  CameraMovement,
} from "@/features/storyboard/api/storyboard.api";
import type { RenderBeatOverrideDraft } from "../hooks/useChapterRender";

const MOVEMENTS: CameraMovement[] = [
  "NONE",
  "PAN",
  "TILT",
  "PUSH_IN",
  "PULL_OUT",
  "PARALLAX",
  "TRACK",
  "ZOOM_IN",
  "ZOOM_OUT",
];

interface RenderTimelineEditorProps {
  storyboard: ApiChapterStoryboard | null;
  loading: boolean;
  mediaDetails: MediaJobDetails | null;
  beatOverrides: Readonly<Record<string, RenderBeatOverrideDraft>>;
  onOverrideChange: (visualBeatId: string, patch: Partial<RenderBeatOverrideDraft>) => void;
  onReset: () => void;
  disabled?: boolean;
}

export function RenderTimelineEditor({
  storyboard,
  loading,
  mediaDetails,
  beatOverrides,
  onOverrideChange,
  onReset,
  disabled = false,
}: Readonly<RenderTimelineEditorProps>) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface-panel p-4 text-sm text-slate-400">
        Đang tải storyboard để chuẩn bị timeline…
      </div>
    );
  }
  if (!storyboard || storyboard.scenes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-panel p-4 text-sm text-slate-400">
        Chưa có Visual Beat để dựng timeline render.
      </div>
    );
  }

  const itemsByBeat = new Map(mediaDetails?.items.map((item) => [item.visualBeatId, item]) ?? []);
  const assetUseCount = new Map<string, number>();
  for (const item of mediaDetails?.items ?? []) {
    if (item.mediaAssetId) {
      assetUseCount.set(item.mediaAssetId, (assetUseCount.get(item.mediaAssetId) ?? 0) + 1);
    }
  }
  const beats = storyboard.scenes.flatMap((scene) => scene.visualBeats);
  const readyCount = beats.filter(
    (beat) => itemsByBeat.get(beat.id)?.executionStatus === "READY",
  ).length;
  const overrideCount = Object.keys(beatOverrides).length;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Render timeline</p>
          <p className="mt-1 text-xs text-slate-400">
            {beats.length} beats · {readyCount}/{beats.length} assets ready · {overrideCount} chỉnh sửa render
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Có thể chỉnh timing/motion ngay cả khi ảnh chưa generate. Duration là trọng số timing và sẽ được normalize theo audio thật.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={disabled || overrideCount === 0}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset chỉnh sửa
        </button>
      </div>

      <div className="max-h-[560px] space-y-4 overflow-y-auto pr-1">
        {storyboard.scenes.map((scene) => (
          <div key={scene.id} className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span>Scene {scene.orderIndex + 1}</span>
              <span className="h-px flex-1 bg-border" />
              <span>{scene.visualBeats.length} beats</span>
            </div>
            {scene.visualBeats.map((beat) => {
              const item = itemsByBeat.get(beat.id);
              const override = beatOverrides[beat.id];
              const movement = override?.cameraMovement ?? beat.cameraMovement;
              const isReused = Boolean(
                item?.mediaAssetId && (assetUseCount.get(item.mediaAssetId) ?? 0) > 1,
              );
              return (
                <div
                  key={beat.id}
                  className="grid gap-3 rounded-xl border border-border/80 bg-surface px-3 py-3 lg:grid-cols-[minmax(0,1fr)_130px_165px]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                        #{beat.orderIndex + 1}
                      </span>
                      <p className="truncate text-sm font-medium text-slate-100">{beat.title}</p>
                      <AssetStatus status={item?.executionStatus ?? null} reused={isReused} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {beat.visualIntent}
                    </p>
                  </div>

                  <label className="text-xs text-slate-400">
                    Duration (giây)
                    <input
                      type="number"
                      min={1}
                      max={120}
                      step={0.5}
                      value={override?.durationMs ? override.durationMs / 1000 : ""}
                      disabled={disabled}
                      placeholder="Auto"
                      onChange={(event) => {
                        if (!event.target.value) {
                          onOverrideChange(beat.id, { durationMs: null });
                          return;
                        }
                        const seconds = Number(event.target.value);
                        if (!Number.isFinite(seconds)) return;
                        onOverrideChange(beat.id, {
                          durationMs: Math.round(Math.min(120, Math.max(1, seconds)) * 1000),
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-orange-400 disabled:opacity-50"
                    />
                  </label>

                  <label className="text-xs text-slate-400">
                    Camera motion
                    <select
                      value={movement}
                      disabled={disabled}
                      onChange={(event) => {
                        const next = event.target.value as CameraMovement;
                        onOverrideChange(beat.id, {
                          cameraMovement: next === beat.cameraMovement ? null : next,
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-orange-400 disabled:opacity-50"
                    >
                      {MOVEMENTS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetStatus({ status, reused }: Readonly<{ status: string | null; reused: boolean }>) {
  const label =
    status === "READY"
      ? reused
        ? "REUSED"
        : "READY"
      : status === "RUNNING" || status === "VALIDATING"
        ? "GENERATING"
        : status === "FAILED"
          ? "FAILED"
          : status === "QUEUED"
            ? "QUEUED"
            : "NO ASSET";
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-slate-400">
      {label}
    </span>
  );
}
