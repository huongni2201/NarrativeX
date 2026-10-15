import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AutoEditStyle,
  DesktopRenderJob,
  DesktopTimeline,
  LocalRenderPreflight,
  RenderFrameRate,
  RenderResolution,
} from "../../../shared/api-types";
import { useGenerationJob } from "../generation/queries/generation.queries";
import { productionApi } from "./api/production.api";
import { createAutoEditPlan } from "./auto-edit-planner";
import { buildRenderPreflightInput } from "./render-preflight";
import { getNativeSubtitleTimingWarning, getRenderReadinessBlockers } from "./render-readiness";
import { isActiveRenderJob, isTerminalRenderJob } from "./render-job-state";
import { useProjectSubtitleSettings } from "./useProjectSubtitleSettings";

type SelectedDestination = { token: string; directory: string };
export type RenderController = ReturnType<typeof useRenderController>;

export function useRenderController({
  projectId,
  timeline,
  projectName,
}: Readonly<{
  projectId: string;
  timeline: DesktopTimeline | null;
  projectName?: string;
}>) {
  const [resolution, setResolution] = useState<RenderResolution>("1080p");
  const [frameRate, setFrameRate] = useState<RenderFrameRate>(24);
  const [autoEditStyle, setAutoEditStyle] = useState<AutoEditStyle>("AUTO");
  const subtitleSettings = useProjectSubtitleSettings(projectId);
  const { subtitlesEnabled } = subtitleSettings;
  const [job, setJob] = useState<DesktopRenderJob | null>(null);
  const [preflight, setPreflight] = useState<LocalRenderPreflight | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [destinationDirectory, setDestinationDirectory] = useState<string | null>(null);
  const [destinationToken, setDestinationToken] = useState<string | null>(null);
  const [destinationBoundJobId, setDestinationBoundJobId] = useState<string | null>(null);
  const [finalPath, setFinalPath] = useState<string | null>(null);
  const deliveringJobRef = useRef<string | null>(null);
  const submissionInFlightRef = useRef(false);
  const recoveredSubmissionRef = useRef(false);

  const trackedJob = useGenerationJob(job?.jobId ?? null);
  const liveJob = trackedJob.data ?? job;
  const autoEditPlan = useMemo(
    () => (timeline ? createAutoEditPlan(timeline, autoEditStyle) : null),
    [autoEditStyle, timeline],
  );
  const readinessBlockers = useMemo(() => getRenderReadinessBlockers(timeline), [timeline]);
  const nativeSubtitleTimingWarning = useMemo(
    () => getNativeSubtitleTimingWarning(timeline, subtitlesEnabled),
    [subtitlesEnabled, timeline],
  );
  const canRender = readinessBlockers.length === 0 && Boolean(autoEditPlan) && subtitleSettings.subtitleSettingsReady;

  useEffect(() => {
    if (trackedJob.isError) {
      setNotice("Không thể tải trạng thái render job. NarrativeX sẽ tiếp tục thử lại bằng watchdog.");
    }
  }, [trackedJob.isError]);

  useEffect(() => {
    if (
      liveJob?.status !== "COMPLETED" ||
      destinationBoundJobId !== liveJob.jobId ||
      finalPath ||
      deliveringJobRef.current === liveJob.jobId
    ) {
      return;
    }
    void deliverCompletedJob(liveJob.jobId);
  }, [destinationBoundJobId, finalPath, liveJob, projectId, projectName]);

  async function deliverCompletedJob(jobId: string) {
    if (deliveringJobRef.current === jobId) return;
    deliveringJobRef.current = jobId;
    setDeliveryBusy(true);
    try {
      const { path } = await window.narrativex.render.deliverArtifact({
        projectId,
        jobId,
        projectName,
      });
      if (deliveringJobRef.current !== jobId) return;
      setDestinationToken(null);
      setDestinationDirectory(null);
      setFinalPath(path);
      setNotice(`Render hoàn tất: ${path}${recoveredSubmissionRef.current ? ". Đã khôi phục yêu cầu trước bằng cấu hình đã chốt; tùy chỉnh mới sẽ áp dụng cho lần xuất tiếp theo." : ""}`);
    } catch (error: unknown) {
      if (deliveringJobRef.current !== jobId) return;
      deliveringJobRef.current = null;
      setNotice(toMessage(error));
    } finally {
      setDeliveryBusy(false);
    }
  }

  async function chooseDestination(): Promise<SelectedDestination | null> {
    const destination = await window.narrativex.render.chooseDestination();
    if (!destination) {
      setNotice("Đã hủy chọn thư mục.");
      return null;
    }
    setDestinationDirectory(destination.directory);
    setDestinationToken(destination.token);
    setFinalPath(null);
    if (isTerminalRenderJob(liveJob?.status)) {
      setJob(null);
      setDestinationBoundJobId(null);
      deliveringJobRef.current = null;
      recoveredSubmissionRef.current = false;
    }
    setNotice(`Video final sẽ được lưu vào ${destination.directory}.`);
    return destination;
  }

  async function bindDestination(jobId: string, destination: SelectedDestination) {
    const bound = await window.narrativex.render.bindDestination({
      token: destination.token,
      projectId,
      jobId,
    });
    setDestinationDirectory(bound.directory);
    setDestinationToken(null);
    setDestinationBoundJobId(jobId);
  }

  async function chooseDestinationAndStartRender() {
    const destination = await chooseDestination();
    if (!destination) return;
    await startRender(destination);
  }

  async function startRender(destination?: SelectedDestination) {
    if (liveJob?.status === "COMPLETED" && destinationBoundJobId === liveJob.jobId && !finalPath && !destination && !destinationToken) {
      await deliverCompletedJob(liveJob.jobId);
      return;
    }
    if (
      liveJob &&
      destinationBoundJobId === liveJob.jobId &&
      isActiveRenderJob(liveJob.status)
    ) {
      setNotice(`Render ${liveJob.jobId} đang ở trạng thái ${liveJob.status}.`);
      return;
    }

    const selectedDestination =
      destination ??
      (destinationDirectory && destinationToken
        ? { directory: destinationDirectory, token: destinationToken }
        : null);

    if (job && destinationBoundJobId !== job.jobId && !finalPath) {
      if (!selectedDestination) {
        setNotice("Render đã được queue nhưng chưa có thư mục xuất. Hãy chọn lại thư mục lưu video.");
        return;
      }
      setBusy(true);
      try {
        await bindDestination(job.jobId, selectedDestination);
        setNotice(`Đã gắn thư mục xuất cho render ${job.jobId}.`);
        if (liveJob?.status === "COMPLETED") await deliverCompletedJob(job.jobId);
      } catch (error) {
        setNotice(toMessage(error));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!timeline || !autoEditPlan || !canRender) {
      setNotice(readinessBlockers[0] ?? "Timeline chưa ready for render.");
      return;
    }
    if (!selectedDestination) {
      setNotice("Hãy chọn thư mục lưu video trước khi render.");
      return;
    }

    if (submissionInFlightRef.current) return;
    submissionInFlightRef.current = true;
    setBusy(true);
    setFinalPath(null);
    setNotice("Đang kiểm tra runtime, media local và dung lượng trước khi render…");
    try {
      const nextPreflight = await productionApi.preflight(
        buildRenderPreflightInput(projectId, timeline, resolution, frameRate),
      );
      setPreflight(nextPreflight);
      if (!nextPreflight.ready) {
        setNotice(`Preflight blocked: ${nextPreflight.blockers.join(", ")}`);
        return;
      }

      await subtitleSettings.saveSubtitleSettings();
      const nextJob = await productionApi.startRender(
        projectId,
        autoEditPlan.renderOverrides,
        resolution,
        frameRate,
        subtitlesEnabled,
        subtitleSettings.subtitleStyle,
      );
      deliveringJobRef.current = null;
      recoveredSubmissionRef.current = nextJob.recoveredSubmission;
      setDestinationBoundJobId(null);
      setJob(nextJob);
      try {
        await bindDestination(nextJob.jobId, selectedDestination);
        setNotice(
          nextJob.recoveredSubmission
            ? "Đã khôi phục yêu cầu render trước bằng cấu hình đã chốt. Sau khi hoàn tất, bạn có thể xuất thêm bản dùng tùy chỉnh mới."
            : `Render ${resolutionLabel(resolution)} · ${frameRate} FPS đã được queue. File final sẽ lưu vào ${selectedDestination.directory}.`,
        );
      } catch (error) {
        setDestinationDirectory(selectedDestination.directory);
        setDestinationToken(selectedDestination.token);
        setNotice(
          `Render đã được queue nhưng chưa gắn được thư mục xuất. ${toMessage(error)}`,
        );
      }
    } catch (error) {
      setNotice(toMessage(error));
    } finally {
      submissionInFlightRef.current = false;
      setBusy(false);
    }
  }

  return {
    resolution,
    setResolution,
    frameRate,
    setFrameRate,
    autoEditStyle,
    setAutoEditStyle,
    ...subtitleSettings,
    liveJob,
    preflight,
    notice,
    busy: busy || deliveryBusy,
    destinationDirectory,
    finalPath,
    readinessBlockers,
    nativeSubtitleTimingWarning,
    canRender,
    autoEditPlan,
    chooseDestination,
    chooseDestinationAndStartRender,
    startRender,
  };
}

function resolutionLabel(resolution: RenderResolution): string {
  return resolution === "1440p" ? "2K QHD" : resolution;
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Render operation thất bại.";
}
