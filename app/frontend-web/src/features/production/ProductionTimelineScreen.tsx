"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Film, Loader2, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { mediaApi } from "@/features/generation/api/media.api";
import { projectsApi } from "@/features/projects/api/projects.api";
import { apiErrorMessage } from "@/shared/api/client";
import { TERMINAL_JOB_STATUSES, type ProjectId } from "@/types/api";
import {
  productionApi,
  type ProductionTimeline,
  type ProductionTimelineBeat,
} from "./api/production.api";

interface ProductionTimelineScreenProps {
  projectId: string;
}

const ZOOM_LEVELS = [2, 4, 8, 16] as const;

export function ProductionTimelineScreen({ projectId }: Readonly<ProductionTimelineScreenProps>) {
  const typedProjectId = projectId as ProjectId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusChapterId = searchParams.get("focusChapter");
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [zoomIndex, setZoomIndex] = useState(1);
  const [jobId, setJobId] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const projectQuery = useQuery({
    queryKey: ["projects", typedProjectId, "overview"],
    queryFn: () => projectsApi.getOverview(typedProjectId),
  });
  const timelineQuery = useQuery({
    queryKey: ["projects", typedProjectId, "production", "timeline"],
    queryFn: () => productionApi.getTimeline(typedProjectId),
  });

  const timeline = timelineQuery.data ?? null;
  useEffect(() => {
    if (!timeline) return;
    const durationMinutes = timeline.totalDurationMs / 60_000;
    setZoomIndex(durationMinutes >= 30 ? 0 : durationMinutes >= 10 ? 1 : 2);
  }, [timeline?.totalDurationMs]);

  const renderMutation = useMutation({
    mutationFn: () => {
      idempotencyKeyRef.current ??= crypto.randomUUID();
      return productionApi.render(
        typedProjectId,
        { resolution, format: "mp4" },
        idempotencyKeyRef.current,
      );
    },
    onSuccess: (job) => setJobId(job.jobId),
    onError: () => {
      idempotencyKeyRef.current = null;
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
  const timelineWidth = Math.max(1200, ((timeline?.totalDurationMs ?? 0) / 1000) * pixelsPerSecond);
  const focusChapter = timeline?.chapters.find((chapter) => chapter.chapterId === focusChapterId) ?? null;

  useEffect(() => {
    if (!focusChapter || !timelineScrollRef.current || !timeline) return;
    const left = (focusChapter.startMs / Math.max(1, timeline.totalDurationMs)) * timelineWidth;
    timelineScrollRef.current.scrollTo({ left: Math.max(0, left - 160), behavior: "smooth" });
  }, [focusChapter?.chapterId, timeline, timelineWidth]);

  const error =
    timelineQuery.error ?? projectQuery.error ?? renderMutation.error ?? jobQuery.error ?? null;
  const renderBusy =
    renderMutation.isPending ||
    job?.status === "QUEUED" ||
    job?.status === "RUNNING" ||
    job?.status === "STALLED";

  return (
    <div className="flex min-h-screen flex-col bg-[#080b10] text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-[#0b1017] px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/projects/${projectId}`)}
            className="rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:border-orange-400 hover:text-white"
            aria-label="Quay lại project"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              Project Production
            </p>
            <h1 className="truncate text-xl font-semibold">
              {projectQuery.data?.project.name ?? "Production Timeline"}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {timeline ? (
            <>
              <SummaryPill label="Duration" value={formatTime(timeline.totalDurationMs)} />
              <SummaryPill label="Chapters" value={String(timeline.chapters.length)} />
              <SummaryPill label="Visual beats" value={String(timeline.beats.length)} />
              <SummaryPill
                label="Ready"
                value={timeline.readyForRender ? "YES" : "NOT YET"}
                emphasis={timeline.readyForRender}
              />
            </>
          ) : null}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:p-6">
        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {apiErrorMessage(error, "Không thể tải Production Timeline.")}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-800 bg-black/40">
            {artifactQuery.data?.webViewLink ? (
              <a
                href={artifactQuery.data.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-3 text-center text-slate-200 hover:text-white"
              >
                <Film className="h-10 w-10 text-orange-300" />
                <span className="font-medium">Final video đã sẵn sàng</span>
                <span className="text-sm text-slate-400">Mở video trong storage</span>
              </a>
            ) : (
              <div className="max-w-md px-6 text-center">
                <Film className="mx-auto h-10 w-10 text-slate-600" />
                <h2 className="mt-3 font-semibold text-slate-200">Production Preview</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Timeline dùng audio làm master clock. Bạn có thể kiểm tra chapter, visual và motion
                  trước khi tất cả ảnh sẵn sàng; chỉ Final Render mới yêu cầu toàn bộ input READY.
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-4 rounded-2xl border border-slate-800 bg-[#0d1219] p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Final render
              </p>
              <h2 className="mt-1 font-semibold">Project video</h2>
            </div>
            <label className="block text-sm text-slate-300">
              Resolution
              <select
                value={resolution}
                onChange={(event) => setResolution(event.target.value as "720p" | "1080p")}
                disabled={renderBusy}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-[#090d13] px-3 py-2 text-slate-100"
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => renderMutation.mutate()}
              disabled={!timeline?.readyForRender || renderBusy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {renderBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
              Render Final Video
            </button>
            {!timeline?.readyForRender && timeline ? (
              <p className="text-xs leading-5 text-amber-300/90">
                Final render đang khóa vì còn chapter thiếu audio hoặc beat chưa có READY image. Timeline
                vẫn mở để kiểm tra timing.
              </p>
            ) : null}
            {job ? (
              <div className="rounded-lg border border-slate-800 bg-black/20 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Render status</span>
                  <span className="font-medium text-slate-100">{job.status}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-orange-400 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, job.progress ?? 0))}%` }}
                  />
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => timelineQuery.refetch()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500"
            >
              <RefreshCw className="h-4 w-4" /> Refresh timeline
            </button>
          </aside>
        </section>

        <section className="min-h-[390px] overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1017]">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <h2 className="font-semibold">Global Production Timeline</h2>
              <p className="text-xs text-slate-500">
                startMs/endMs chạy liên tục qua tất cả chapter; audio là master duration.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomIndex((value) => Math.max(0, value - 1))}
                disabled={zoomIndex === 0}
                className="rounded-lg border border-slate-700 p-2 text-slate-300 disabled:opacity-30"
                aria-label="Thu nhỏ timeline"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-16 text-center text-xs text-slate-400">
                {pixelsPerSecond}px/s
              </span>
              <button
                type="button"
                onClick={() => setZoomIndex((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1))}
                disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                className="rounded-lg border border-slate-700 p-2 text-slate-300 disabled:opacity-30"
                aria-label="Phóng to timeline"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>

          {timelineQuery.isPending ? (
            <div className="flex h-72 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang dựng global timeline…
            </div>
          ) : timeline ? (
            <TimelineCanvas
              timeline={timeline}
              width={timelineWidth}
              focusChapterId={focusChapterId}
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
  scrollRef,
}: Readonly<{
  timeline: ProductionTimeline;
  width: number;
  focusChapterId: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}>) {
  const ticks = useMemo(() => buildTicks(timeline.totalDurationMs), [timeline.totalDurationMs]);
  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <div className="grid min-w-full grid-cols-[112px_auto]" style={{ width: width + 112 }}>
        <div className="sticky left-0 z-20 border-r border-slate-800 bg-[#0b1017]" />
        <div className="relative h-10 border-b border-slate-800" style={{ width }}>
          {ticks.map((tick) => (
            <div
              key={tick.ms}
              className="absolute inset-y-0 border-l border-slate-700/70"
              style={{ left: `${(tick.ms / Math.max(1, timeline.totalDurationMs)) * 100}%` }}
            >
              <span className="ml-1 text-[10px] text-slate-500">{tick.label}</span>
            </div>
          ))}
        </div>
        <TrackLabel>CHAPTER</TrackLabel>
        <div className="relative h-14 border-b border-slate-800/80" style={{ width }}>
          {timeline.chapters.map((chapter) => (
            <TimelineBlock
              key={chapter.chapterId}
              startMs={chapter.startMs}
              endMs={chapter.endMs}
              totalMs={timeline.totalDurationMs}
              highlighted={chapter.chapterId === focusChapterId}
              className={chapter.readyForRender ? "bg-indigo-500/40" : "bg-amber-500/25"}
              title={`Ch ${chapter.orderIndex + 1} · ${chapter.title}`}
            />
          ))}
        </div>
        <TrackLabel>VISUAL</TrackLabel>
        <div className="relative h-20 border-b border-slate-800/80" style={{ width }}>
          {timeline.beats.map((beat) => (
            <BeatBlock key={beat.visualBeatId} beat={beat} totalMs={timeline.totalDurationMs} />
          ))}
        </div>
        <TrackLabel>MOTION</TrackLabel>
        <div className="relative h-11 border-b border-slate-800/80" style={{ width }}>
          {timeline.beats.map((beat) => (
            <TimelineBlock
              key={beat.visualBeatId}
              startMs={beat.startMs}
              endMs={beat.endMs}
              totalMs={timeline.totalDurationMs}
              className="bg-violet-500/20"
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
              className={chapter.audioReady ? "bg-emerald-500/25" : "bg-red-500/20"}
              title={chapter.audioReady ? `Audio · ${formatTime(chapter.audioDurationMs ?? 0)}` : "NO AUDIO"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TrackLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="sticky left-0 z-20 flex items-center border-r border-b border-slate-800 bg-[#0b1017] px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-500">
      {children}
    </div>
  );
}

function BeatBlock({ beat, totalMs }: Readonly<{ beat: ProductionTimelineBeat; totalMs: number }>) {
  return (
    <TimelineBlock
      startMs={beat.startMs}
      endMs={beat.endMs}
      totalMs={totalMs}
      className={beat.assetReady ? "bg-orange-500/35" : "bg-slate-700/55"}
      title={beat.assetReady ? beat.title : `NO ASSET · ${beat.title}`}
      subtitle={`${formatTime(beat.startMs)}–${formatTime(beat.endMs)}`}
    />
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
      className={`absolute inset-y-1 overflow-hidden rounded border border-white/10 px-2 ${className} ${
        highlighted ? "ring-2 ring-orange-300" : ""
      }`}
      style={{ left: `${left}%`, width: `${width}%`, minWidth: compact ? 3 : 5 }}
      title={`${title} · ${formatTime(startMs)} → ${formatTime(endMs)}`}
    >
      <p className={`truncate font-medium text-slate-100 ${compact ? "text-[9px]" : "text-[10px]"}`}>
        {title}
      </p>
      {!compact && subtitle ? <p className="truncate text-[9px] text-slate-400">{subtitle}</p> : null}
    </div>
  );
}

function SummaryPill({
  label,
  value,
  emphasis = false,
}: Readonly<{ label: string; value: string; emphasis?: boolean }>) {
  return (
    <div className={`rounded-lg border px-3 py-1.5 ${emphasis ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-800 bg-black/20"}`}>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="ml-2 font-mono text-xs text-slate-200">{value}</span>
    </div>
  );
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
