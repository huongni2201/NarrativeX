import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AutoEditStyle,
  DesktopRenderJob,
  DesktopTimeline,
  LocalRenderPreflight,
  RenderResolution,
} from "@narrativex/client-contracts";
import { useGenerationJob } from "../generation/queries/generation.queries";
import { productionApi } from "./api/production.api";
import { createAutoEditPlan } from "./auto-edit-planner";
import { buildRenderPreflightInput } from "./render-preflight";
import { getRenderReadinessBlockers } from "./render-readiness";

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
  const [autoEditStyle, setAutoEditStyle] = useState<AutoEditStyle>("AUTO");
  const [job, setJob] = useState<DesktopRenderJob | null>(null);
  const [preflight, setPreflight] = useState<LocalRenderPreflight | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [destinationDirectory, setDestinationDirectory] = useState<string | null>(null);
  const [destinationToken, setDestinationToken] = useState<string | null>(null);
  const [finalPath, setFinalPath] = useState<string | null>(null);
  const deliveringJobRef = useRef<string | null>(null);

  const trackedJob = useGenerationJob(job?.jobId ?? null);
  const liveJob = trackedJob.data ?? job;
  const autoEditPlan = useMemo(
    () => (timeline ? createAutoEditPlan(timeline, autoEditStyle) : null),
    [autoEditStyle, timeline],
  );
  const readinessBlockers = useMemo(() => getRenderReadinessBlockers(timeline), [timeline]);
  const canRender = readinessBlockers.length === 0 && Boolean(autoEditPlan);

  useEffect(() => {
    if (trackedJob.isError) {
      setNotice("Không thể tải trạng thái render job. NarrativeX sẽ tiếp tục thử lại bằng watchdog.");
    }
  }, [trackedJob.isError]);

  useEffect(() => {
    if (
      liveJob?.status !== "COMPLETED" ||
      !destinationToken ||
      deliveringJobRef.current === liveJob.jobId
    ) {
      return;
    }
    deliveringJobRef.current = liveJob.jobId;
    const token = destinationToken;
    void window.narrativex.render
      .deliverArtifact({ token, projectId, jobId: liveJob.jobId, projectName })
      .then(({ path }) => {
        setDestinationToken(null);
        setFinalPath(path);
        setNotice(`Render hoàn tất: ${path}`);
      })
      .catch((error: unknown) => {
        deliveringJobRef.current = null;
        setNotice(toMessage(error));
      });
  }, [destinationToken, liveJob, projectId, projectName]);

  async function startRender() {
    if (!timeline || !autoEditPlan || !canRender) {
      setNotice(readinessBlockers[0] ?? "Timeline chưa ready for render.");
      return;
    }

    const destination = await window.narrativex.render.chooseDestination();
    if (!destination) {
      setNotice("Đã hủy chọn thư mục. Chưa có render job nào được tạo.");
      return;
    }

    setBusy(true);
    setFinalPath(null);
    setDestinationDirectory(destination.directory);
    setNotice("Đang kiểm tra runtime, media local và dung lượng trước khi render…");
    try {
      const nextPreflight = await productionApi.preflight(
        buildRenderPreflightInput(projectId, timeline, resolution),
      );
      setPreflight(nextPreflight);
      if (!nextPreflight.ready) {
        setNotice(`Preflight blocked: ${nextPreflight.blockers.join(", ")}`);
        return;
      }

      const nextJob = await productionApi.startRender(
        projectId,
        autoEditPlan.renderOverrides,
        resolution,
      );
      deliveringJobRef.current = null;
      setDestinationToken(destination.token);
      setJob(nextJob);
      setNotice(
        `Render ${resolutionLabel(resolution)} đã được queue. File final sẽ lưu vào ${destination.directory}.`,
      );
    } catch (error) {
      setNotice(toMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return {
    resolution,
    setResolution,
    autoEditStyle,
    setAutoEditStyle,
    liveJob,
    preflight,
    notice,
    busy,
    destinationDirectory,
    finalPath,
    readinessBlockers,
    canRender,
    autoEditPlan,
    startRender,
  };
}

function resolutionLabel(resolution: RenderResolution): string {
  return resolution === "1440p" ? "2K QHD" : resolution;
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Render operation thất bại.";
}
