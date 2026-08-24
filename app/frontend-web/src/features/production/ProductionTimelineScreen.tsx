"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Film,
  Loader2,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { mediaApi } from "@/features/generation/api/media.api";
import { projectsApi } from "@/features/projects/api/projects.api";
import { apiErrorMessage } from "@/shared/api/client";
import { TERMINAL_JOB_STATUSES, type ProjectId } from "@/types/api";
import {
  productionApi,
  type ProductionTimeline,
  type ProductionTimelineBeat,
  type ProjectRenderBeatOverrideInput,
} from "./api/production.api";

interface ProductionTimelineScreenProps {
  projectId: string;
}

type RenderResolution = "720p" | "1080p";

interface BeatOverrideDraft {
  durationMs: number | null;
  cameraMovement: string | null;
}

interface RenderIntent {
  idempotencyKey: string;
  resolution: RenderResolution;
  overrideFingerprint: string;
  beatOverrides: ProjectRenderBeatOverrideInput[];
}

const ZOOM_LEVELS = [2, 4, 8, 16] as const;
const CAMERA_MOVEMENTS = [
  "NONE",
  "PAN",
  "TILT",
  "PUSH_IN",
  "PULL_OUT",
  "PARALLAX",
  "TRACK",
  "ZOOM_IN",
  "ZOOM_OUT",
] as const;

export function ProductionTimelineScreen({ projectId }: Readonly<ProductionTimelineScreenProps>) {
  const typedProjectId = projectId as ProjectId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusChapterId = searchParams.get("focusChapter");
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const [resolution, setResolution] = useState<RenderResolution>("1080p");
  const [zoomIndex, setZoomIndex] = useState(1);
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [beatOverrides, setBeatOverrides] = useState<Record<string, BeatOverrideDraft>>({});
  const renderIntentRef = useRef<RenderIntent | null>(null);

  const projectQuery = useQuery({
    queryKey: ["projects", typedProjectId, "overview"],
    queryFn: () => projectsApi.getOverview(typedProjectId),
  });
  const timelineQuery = useQuery({
    queryKey: ["projects", typedProjectId, "production", "timeline"],
    queryFn: () => productionApi.getTimeline(typedProjectId),
  });

  const timeline = timelineQuery.data ?? null;
  const editedTimeline = useMemo(
    () => (timeline ? applyTimelineOverrides(timeline, beatOverrides) : null),
    [timeline, beatOverrides],
  );
  const activeBeatIds = useMemo(
    () => new Set(timeline?.beats.map((beat) => beat.visualBeatId) ?? []),
    [timeline],
  );
  const beatOverridesPayload = useMemo<ProjectRenderBeatOverrideInput[]>(
    () =>
      Object.entries(beatOverrides)
        .filter(([visualBeatId, override]) => {
          return (
            activeBeatIds.has(visualBeatId) &&
            (override.durationMs !== null || override.cameraMovement !== null)
          );
        })
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([visualBeatId, override]) => ({
          visualBeatId,
          durationMs: override.durationMs,
          cameraMovement: override.cameraMovement,
        })),
    [activeBeatIds, beatOverrides],
  );

  useEffect(() => {
    if (!timeline) return;
    const durationMinutes = timeline.totalDurationMs / 60_000;
    setZoomIndex(durationMinutes >= 30 ? 0 : durationMinutes >= 10 ? 1 : 2);
  }, [timeline]);

  useEffect(() => {
    setBeatOverrides({});
    setSelectedBeatId(null);
    setJobId(null);
    renderIntentRef.current = null;
  }, [timeline?.storyVersionId]);

  const renderMutation = useMutation({
    mutationFn: (intent: RenderIntent) =>
      productionApi.render(
        typedProjectId,
        {
          resolution: intent.resolution,
          format: "mp4",
          beatOverrides: intent.beatOverrides,
        },
        intent.idempotencyKey,
      ),
    onSuccess: (job) => {
      setJobId(job.jobId);
      renderIntentRef.current = null;
    },
  });

  const jobQuery = useQuery({
    queryKey: jobId ? ["project-render-jobs", jobId] : ["project-render-jobs", "none"],
    queryFn: () => mediaApi.getJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_JOB_STATUSES.has(status) ? false : 1500;
    },
  });
  const job = jobQuery.data ?? null;
  const artifactQuery = useQuery({
    queryKey: jobId
      ? ["projects", typedProjectId, "production", "artifact", jobId]
      : ["project-render-artifact", "none"],
    queryFn: () => productionApi.getArtifactByJob(typedProjectId, jobId!),
    enabled: Boolean(jobId && job?.status === "COMPLETED"),
    retry: 3,
  });

  const pixelsPerSecond = ZOOM_LEVELS[zoomIndex];
  const timelineWidth = Math.max(
    1200,
    ((editedTimeline?.totalDurationMs ?? 0) / 1000) * pixelsPerSecond,
  );
  const focusChapter =
    editedTimeline?.chapters.find((chapter) => chapter.chapterId === focusChapterId) ?? null;
  const selectedBeat =
    editedTimeline?.beats.find((beat) => beat.visualBeatId === selectedBeatId) ?? null;
  const selectedSourceBeat =
    timeline?.beats.find((beat) => beat.visualBeatId === selectedBeatId) ?? null;
  const selectedOverride = selectedBeatId ? beatOverrides[selectedBeatId] : undefined;

  useEffect(() => {
    if (!focusChapter || !timelineScrollRef.current || !editedTimeline) return;
    const left =
      (focusChapter.startMs / Math.max(1, editedTimeline.totalDurationMs)) * timelineWidth;
    timelineScrollRef.current.scrollTo({ left: Math.max(0, left - 160), behavior: "smooth" });
  }, [focusChapter, editedTimeline, timelineWidth]);

  const error =
    timelineQuery.error ??
    projectQuery.error ??
    renderMutation.error ??
    jobQuery.error ??
    artifactQuery.error ??
    null;
  const renderBusy =
    renderMutation.isPending ||
    job?.status === "QUEUED" ||
    job?.status === "RUNNING" ||
    job?.status === "STALLED";

  const invalidateRenderIntent = () => {
    renderIntentRef.current = null;
    setJobId(null);
  };

  const updateBeatOverride = (visualBeatId: string, patch: Partial<BeatOverrideDraft>) => {
    setBeatOverrides((current) => {
      const previous = current[visualBeatId] ?? { durationMs: null, cameraMovement: null };
      const next = { ...previous, ...patch };
      if (next.durationMs === null && next.cameraMovement === null) {
        const copy = { ...current };
        delete copy[visualBeatId];
        return copy;
      }
      return { ...current, [visualBeatId]: next };
    });
    invalidateRenderIntent();
  };

  const resetBeatOverrides = () => {
    setBeatOverrides({});
    invalidateRenderIntent();
  };

  const submitRender = () => {
    const overrideFingerprint = JSON.stringify(beatOverridesPayload);
    let intent = renderIntentRef.current;
    if (
      !intent ||
      intent.resolution !== resolution ||
      intent.overrideFingerprint !== overrideFingerprint
    ) {
      intent = {
        idempotencyKey: crypto.randomUUID(),
        resolution,
        overrideFingerprint,
        beatOverrides: beatOverridesPayload,
      };
      renderIntentRef.current = intent;
    }
    renderMutation.mutate(intent);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-text-primary">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border-dark bg-surface-dark px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/projects/${projectId}`)}
            className="rounded-lg border border-border p-2 text-text-secondary transition hover:border-primary hover:text-text-primary"
            aria-label="Quay lại project"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-light">
              Project Production
            </p>
            <h1 className="truncate text-xl font-semibold text-text-primary">
              {projectQuery.data?.name ?? "Production Timeline"}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {editedTimeline ? (
            <>
              <SummaryPill label="Duration" value={formatTime(editedTimeline.totalDurationMs)} />
              <SummaryPill label="Chapters" value={String(editedTimeline.chapters.length)} />
              <SummaryPill label="Visual beats" value={String(editedTimeline.beats.length)} />
              <SummaryPill label="Edits" value={String(beatOverridesPayload.length)} />
              <SummaryPill
                label="Ready"
                value={editedTimeline.readyForRender ? "YES" : "NOT YET"}
                emphasis={editedTimeline.readyForRender}
              />
            </>
          ) : null}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:p-6">
        {error ? (
          <div className="rounded-xl border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">
            {apiErrorMessage(error, "Không thể tải Production Timeline.")}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-border-dark bg-surface-panel">
            {artifactQuery.data?.webViewLink ? (
              <a
                href={artifactQuery.data.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-3 text-center text-text-secondary hover:text-text-primary"
              >
                <Film className="h-10 w-10 text-primary-light" />
                <span className="font-medium">Final video đã sẵn sàng</span>
                <span className="text-sm text-text-muted">Mở video trong storage</span>
              </a>
            ) : (
              <div className="max-w-md px-6 text-center">
                <Film className="mx-auto h-10 w-10 text-text-dim" />
                <h2 className="mt-3 font-semibold text-text-primary">Production Preview</h2>
                <p className="mt-1 text-sm leading-6 text-text-muted">
                  Timeline dùng audio làm master clock. Chọn một Visual Beat để chỉnh timing/motion;
                  Final Render chỉ mở khi toàn bộ audio và ảnh READY.
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-4 rounded-2xl border border-border-dark bg-surface p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                Final render
              </p>
              <h2 className="mt-1 font-semibold text-text-primary">Project video</h2>
            </div>
            <label className="block text-sm text-text-secondary">
              Resolution
              <select
                value={resolution}
                onChange={(event) => {
                  setResolution(event.target.value as RenderResolution);
                  invalidateRenderIntent();
                }}
                disabled={renderBusy}
                className="mt-2 w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-text-primary"
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </label>
            <button
              type="button"
              onClick={submitRender}
              disabled={!editedTimeline?.readyForRender || renderBusy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {renderBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
              Render Final Video
            </button>
            {!editedTimeline?.readyForRender && editedTimeline ? (
              <p className="text-xs leading-5 text-warning">
                Final render đang khóa vì còn chapter thiếu audio hoặc beat chưa có READY image. Timeline
                vẫn mở để chỉnh timing/motion trước.
              </p>
            ) : null}
            {job ? (
              <div className="rounded-lg border border-border-dark bg-surface-panel p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Render status</span>
                  <span className="font-medium text-text-primary">{job.status}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full bg-primary-light transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, job.progress ?? 0))}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="border-t border-border-dark pt-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Beat inspector
                  </p>
                  <p className="mt-1 text-sm font-medium text-text-primary">
                    {selectedBeat ? selectedBeat.title : "Chọn một Visual Beat"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetBeatOverrides}
                  disabled={renderBusy || beatOverridesPayload.length === 0}
                  className="rounded-lg border border-border p-2 text-text-muted transition hover:text-text-primary disabled:opacity-30"
                  aria-label="Reset toàn bộ timeline edits"
                  title="Reset toàn bộ edits"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>

              {selectedBeat && selectedSourceBeat ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-border-dark bg-surface-panel p-3 text-xs text-text-muted">
                    <div className="flex justify-between gap-3">
                      <span>Result timing</span>
                      <span className="font-mono text-text-primary">
                        {formatTime(selectedBeat.startMs)} → {formatTime(selectedBeat.endMs)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between gap-3">
                      <span>Result duration</span>
                      <span className="font-mono text-text-primary">
                        {(selectedBeat.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                  </div>

                  <label className="block text-xs text-text-muted">
                    Timing weight (giây)
                    <input
                      type="number"
                      min={1}
                      max={120}
                      step={0.5}
                      value={
                        selectedOverride?.durationMs != null
                          ? selectedOverride.durationMs / 1000
                          : ""
                      }
                      placeholder="Auto"
                      disabled={renderBusy}
                      onChange={(event) => {
                        if (!selectedBeatId) return;
                        if (!event.target.value) {
                          updateBeatOverride(selectedBeatId, { durationMs: null });
                          return;
                        }
                        const seconds = Number(event.target.value);
                        if (!Number.isFinite(seconds)) return;
                        updateBeatOverride(selectedBeatId, {
                          durationMs: Math.round(Math.min(120, Math.max(1, seconds)) * 1000),
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-primary disabled:opacity-50"
                    />
                    <span className="mt-1 block leading-5 text-text-dim">
                      Đây là trọng số; backend sẽ normalize lại để Chapter vẫn khớp audio thật.
                    </span>
                  </label>

                  <label className="block text-xs text-text-muted">
                    Camera motion
                    <select
                      value={
                        selectedOverride?.cameraMovement ?? selectedSourceBeat.cameraMovement ?? "NONE"
                      }
                      disabled={renderBusy}
                      onChange={(event) => {
                        if (!selectedBeatId) return;
                        const movement = event.target.value;
                        updateBeatOverride(selectedBeatId, {
                          cameraMovement:
                            movement === selectedSourceBeat.cameraMovement ? null : movement,
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-primary disabled:opacity-50"
                    >
                      {CAMERA_MOVEMENTS.map((movement) => (
                        <option key={movement} value={movement}>
                          {movement}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBeatId) {
                        updateBeatOverride(selectedBeatId, {
                          durationMs: null,
                          cameraMovement: null,
                        });
                      }
                    }}
                    disabled={renderBusy || !selectedOverride}
                    className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-border-glow hover:text-text-primary disabled:opacity-30"
                  >
                    Reset beat này
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs leading-5 text-text-muted">
                  Click một block ở track VISUAL để chỉnh duration/motion mà không cần ảnh đã generate.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => timelineQuery.refetch()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition hover:border-border-glow"
            >
              <RefreshCw className="h-4 w-4" /> Refresh timeline
            </button>
          </aside>
        </section>

        <section className="min-h-[390px] overflow-hidden rounded-2xl border border-border-dark bg-surface-dark">
          <div className="flex items-center justify-between border-b border-border-dark px-4 py-3">
            <div>
              <h2 className="font-semibold text-text-primary">Global Production Timeline</h2>
              <p className="text-xs text-text-muted">
                startMs/endMs chạy liên tục qua tất cả chapter; audio là master duration. Click VISUAL
                để edit.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomIndex((value) => Math.max(0, value - 1))}
                disabled={zoomIndex === 0}
                className="rounded-lg border border-border p-2 text-text-secondary disabled:opacity-30"
                aria-label="Thu nhỏ timeline"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-16 text-center text-xs text-text-muted">
                {pixelsPerSecond}px/s
              </span>
              <button
                type="button"
                onClick={() => setZoomIndex((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1))}
                disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                className="rounded-lg border border-border p-2 text-text-secondary disabled:opacity-30"
                aria-label="Phóng to timeline"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>

          {timelineQuery.isPending ? (
            <div className="flex h-72 items-center justify-center text-sm text-text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang dựng global timeline…
            </div>
          ) : editedTimeline ? (
            <TimelineCanvas
              timeline={editedTimeline}
              width={timelineWidth}
              focusChapterId={focusChapterId}
              selectedBeatId={selectedBeatId}
              onSelectBeat={setSelectedBeatId}
              scrollRef={timelineScrollRef}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}

function TimelineCanvas({
  timeline,
  width,
  focusChapterId,
  selectedBeatId,
  onSelectBeat,
  scrollRef,
}: Readonly<{
  timeline: ProductionTimeline;
  width: number;
  focusChapterId: string | null;
  selectedBeatId: string | null;
  onSelectBeat: (visualBeatId: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}>) {
  const ticks = useMemo(() => buildTicks(timeline.totalDurationMs), [timeline.totalDurationMs]);
  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <div className="grid min-w-full grid-cols-[112px_auto]" style={{ width: width + 112 }}>
        <div className="sticky left-0 z-20 border-r border-border-dark bg-surface-dark" />
        <div className="relative h-10 border-b border-border-dark" style={{ width }}>
          {ticks.map((tick) => (
            <div
              key={tick.ms}
              className="absolute inset-y-0 border-l border-border"
              style={{ left: `${(tick.ms / Math.max(1, timeline.totalDurationMs)) * 100}%` }}
            >
              <span className="ml-1 text-[10px] text-text-muted">{tick.label}</span>
            </div>
          ))}
        </div>
        <TrackLabel>CHAPTER</TrackLabel>
        <div className="relative h-14 border-b border-border-dark" style={{ width }}>
          {timeline.chapters.map((chapter) => (
            <TimelineBlock
              key={chapter.chapterId}
              startMs={chapter.startMs}
              endMs={chapter.endMs}
              totalMs={timeline.totalDurationMs}
              highlighted={chapter.chapterId === focusChapterId}
              className={chapter.readyForRender ? "bg-badge-blue-bg" : "bg-warning-bg"}
              title={`Ch ${chapter.orderIndex + 1} · ${chapter.title}`}
            />
          ))}
        </div>
        <TrackLabel>VISUAL</TrackLabel>
        <div className="relative h-20 border-b border-border-dark" style={{ width }}>
          {timeline.beats.map((beat) => (
            <BeatBlock
              key={beat.visualBeatId}
              beat={beat}
              totalMs={timeline.totalDurationMs}
              selected={beat.visualBeatId === selectedBeatId}
              onSelect={() => onSelectBeat(beat.visualBeatId)}
            />
          ))}
        </div>
        <TrackLabel>MOTION</TrackLabel>
        <div className="relative h-11 border-b border-border-dark" style={{ width }}>
          {timeline.beats.map((beat) => (
            <TimelineBlock
              key={beat.visualBeatId}
              startMs={beat.startMs}
              endMs={beat.endMs}
              totalMs={timeline.totalDurationMs}
              className="bg-primary-muted"
              title={beat.cameraMovement || "NONE"}
              compact
            />
          ))}
        </div>
        <TrackLabel>AUDIO</TrackLabel>
        <div className="relative h-14" style={{ width }}>
          {timeline.chapters.map((chapter) => (
            <TimelineBlock
              key={chapter.chapterId}
              startMs={chapter.startMs}
              endMs={chapter.endMs}
              totalMs={timeline.totalDurationMs}
              className={chapter.audioReady ? "bg-success-bg" : "bg-danger-bg"}
              title={
                chapter.audioReady
                  ? `Audio · ${formatTime(chapter.audioDurationMs ?? 0)}`
                  : "NO AUDIO"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TrackLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="sticky left-0 z-20 flex items-center border-r border-b border-border-dark bg-surface-dark px-3 text-[10px] font-semibold tracking-[0.16em] text-text-muted">
      {children}
    </div>
  );
}

function BeatBlock({
  beat,
  totalMs,
  selected,
  onSelect,
}: Readonly<{
  beat: ProductionTimelineBeat;
  totalMs: number;
  selected: boolean;
  onSelect: () => void;
}>) {
  const left = (beat.startMs / Math.max(1, totalMs)) * 100;
  const width = ((beat.endMs - beat.startMs) / Math.max(1, totalMs)) * 100;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`absolute inset-y-1 overflow-hidden rounded border px-2 text-left transition ${
        beat.assetReady ? "bg-badge-orange-bg" : "bg-badge-slate-bg"
      } ${
        selected
          ? "border-primary-light ring-2 ring-primary-light"
          : "border-border hover:border-primary"
      }`}
      style={{ left: `${left}%`, width: `${width}%`, minWidth: 8 }}
      title={`${beat.assetReady ? beat.title : `NO ASSET · ${beat.title}`} · ${formatTime(beat.startMs)} → ${formatTime(beat.endMs)}`}
    >
      <p className="truncate text-[10px] font-medium text-text-primary">
        {beat.assetReady ? beat.title : `NO ASSET · ${beat.title}`}
      </p>
      <p className="truncate text-[9px] text-text-muted">
        {formatTime(beat.startMs)}–{formatTime(beat.endMs)}
      </p>
    </button>
  );
}

function TimelineBlock({
  startMs,
  endMs,
  totalMs,
  title,
  subtitle,
  className,
  highlighted = false,
  compact = false,
}: Readonly<{
  startMs: number;
  endMs: number;
  totalMs: number;
  title: string;
  subtitle?: string;
  className: string;
  highlighted?: boolean;
  compact?: boolean;
}>) {
  const left = (startMs / Math.max(1, totalMs)) * 100;
  const width = ((endMs - startMs) / Math.max(1, totalMs)) * 100;
  return (
    <div
      className={`absolute inset-y-1 overflow-hidden rounded border border-border px-2 ${className} ${
        highlighted ? "ring-2 ring-primary-light" : ""
      }`}
      style={{ left: `${left}%`, width: `${width}%`, minWidth: compact ? 3 : 5 }}
      title={`${title} · ${formatTime(startMs)} → ${formatTime(endMs)}`}
    >
      <p
        className={`truncate font-medium text-text-primary ${compact ? "text-[9px]" : "text-[10px]"}`}
      >
        {title}
      </p>
      {!compact && subtitle ? (
        <p className="truncate text-[9px] text-text-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}

function SummaryPill({
  label,
  value,
  emphasis = false,
}: Readonly<{ label: string; value: string; emphasis?: boolean }>) {
  return (
    <div
      className={`rounded-lg border px-3 py-1.5 ${
        emphasis ? "border-success bg-success-bg" : "border-border-dark bg-surface-panel"
      }`}
    >
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <span className="ml-2 font-mono text-xs text-text-primary">{value}</span>
    </div>
  );
}

function applyTimelineOverrides(
  timeline: ProductionTimeline,
  overrides: Readonly<Record<string, BeatOverrideDraft>>,
): ProductionTimeline {
  if (Object.keys(overrides).length === 0) return timeline;

  const adjustedBeats: ProductionTimelineBeat[] = [];
  for (const chapter of timeline.chapters) {
    const chapterBeats = timeline.beats.filter((beat) => beat.chapterId === chapter.chapterId);
    if (chapterBeats.length === 0) continue;
    const chapterDurationMs = chapter.endMs - chapter.startMs;
    const weights = chapterBeats.map(
      (beat) => overrides[beat.visualBeatId]?.durationMs ?? beat.durationMs,
    );
    const totalWeight = weights.reduce((total, weight) => total + weight, 0);
    let previousRelativeEnd = 0;
    let cumulativeWeight = 0;

    chapterBeats.forEach((beat, index) => {
      cumulativeWeight += weights[index];
      let relativeEnd: number;
      if (index === chapterBeats.length - 1) {
        relativeEnd = chapterDurationMs;
      } else {
        relativeEnd = Math.round(
          (chapterDurationMs * cumulativeWeight) / Math.max(1, totalWeight),
        );
        const minimumEnd = previousRelativeEnd + 1;
        const latestEnd = chapterDurationMs - (chapterBeats.length - index - 1);
        relativeEnd = Math.max(minimumEnd, Math.min(relativeEnd, latestEnd));
      }
      const startMs = chapter.startMs + previousRelativeEnd;
      const endMs = chapter.startMs + relativeEnd;
      adjustedBeats.push({
        ...beat,
        cameraMovement: overrides[beat.visualBeatId]?.cameraMovement ?? beat.cameraMovement,
        startMs,
        endMs,
        durationMs: endMs - startMs,
      });
      previousRelativeEnd = relativeEnd;
    });
  }

  return adjustedBeats.length === timeline.beats.length
    ? { ...timeline, beats: adjustedBeats }
    : timeline;
}

function buildTicks(totalMs: number) {
  if (totalMs <= 0) return [{ ms: 0, label: "00:00" }];
  const count = 10;
  return Array.from({ length: count + 1 }, (_, index) => {
    const ms = Math.round((totalMs * index) / count);
    return { ms, label: formatTime(ms) };
  });
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
