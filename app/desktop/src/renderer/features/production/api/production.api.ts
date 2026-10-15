import type {
  DesktopRenderJob,
  ProjectSubtitleSettings,
  SubtitleStyle,
  DesktopTimeline,
  LocalRenderPreflight,
  ProjectRenderBeatOverride,
  RenderFrameRate,
  RenderResolution,
  UpdateBeatMediaInput,
} from "@narrativex/client-contracts";
import type { LocalRenderPreflightInput } from "../../../../preload/types";
import { apiCommand, apiRequest, DesktopApiError } from "../../../api/client";
import { assertContract, isRecord, isString } from "../../../api/guards";
import { parseProjectSubtitleSettings, DEFAULT_SUBTITLE_STYLE } from "../../../../shared/subtitle-style";
import { RenderSubmissionIntents } from "../render-submission-intents";
import {
  prepareLocalRenderExecutor,
  runLocalRenderPreflight,
} from "../local-render-executor";

function isTimeline(value: unknown): value is DesktopTimeline {
  return (
    isRecord(value) &&
    isString(value.projectId) &&
    typeof value.totalDurationMs === "number" &&
    Array.isArray(value.beats) &&
    Array.isArray(value.chapters)
  );
}

function isRenderJob(value: unknown): value is DesktopRenderJob {
  return (
    isRecord(value) &&
    isString(value.jobId) &&
    isString(value.type) &&
    isString(value.status) &&
    typeof value.progress === "number"
  );
}

export const productionApi = {
  getSubtitleSettings: (projectId: string): Promise<ProjectSubtitleSettings> =>
    apiRequest<unknown>(`/api/v1/projects/${encodeURIComponent(projectId)}/production/subtitle-settings`)
      .then(parseProjectSubtitleSettings),

  saveSubtitleSettings: (projectId: string, settings: ProjectSubtitleSettings): Promise<ProjectSubtitleSettings> =>
    apiRequest<unknown>(`/api/v1/projects/${encodeURIComponent(projectId)}/production/subtitle-settings`,
      { method: "PUT", body: JSON.stringify(parseProjectSubtitleSettings(settings)) })
      .then(parseProjectSubtitleSettings),

  getTimeline: (projectId: string) =>
    apiRequest<unknown>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/production/timeline`,
    ).then((value) => {
      assertContract(isTimeline(value), "Production timeline response không đúng contract.");
      return value;
    }),

  updateBeatMedia: (projectId: string, visualBeatId: string, input: UpdateBeatMediaInput) =>
    apiCommand(
      `/api/v1/projects/${encodeURIComponent(projectId)}/production/beats/${encodeURIComponent(visualBeatId)}/media`,
      { method: "PUT", body: JSON.stringify(input) },
    ),

  resetBeatMedia: (projectId: string, visualBeatId: string) =>
    apiCommand(
      `/api/v1/projects/${encodeURIComponent(projectId)}/production/beats/${encodeURIComponent(visualBeatId)}/media`,
      { method: "DELETE" },
    ),

  startRender: async (
    projectId: string,
    beatOverrides: ProjectRenderBeatOverride[] = [],
    resolution: RenderResolution = "1080p",
    frameRate: RenderFrameRate = 24,
    subtitlesEnabled = true,
    subtitleStyle: SubtitleStyle = DEFAULT_SUBTITLE_STYLE,
  ) => {
    const status = await prepareLocalRenderExecutor(localRenderExecutorDependencies());
    if (!status.projectRenderEnabled) {
      throw new Error("Local FFmpeg rendering is not enabled.");
    }
    const localDeviceId = status.deviceId;
    if (!localDeviceId) throw new Error("Local render device is not available.");

    const intents = new RenderSubmissionIntents(window.localStorage);
    const submission = intents.prepare({ projectId, resolution, fps: frameRate, format: "mp4", executionTarget: "LOCAL_DEVICE",
      localDeviceId, subtitlesEnabled, subtitleStyle, beatOverrides });
    const { projectId: submittedProjectId, ...request } = submission.request;
    try {
      const value = await apiRequest<unknown>(
        `/api/v1/projects/${encodeURIComponent(submittedProjectId)}/production/render`,
        { method: "POST", headers: { "Idempotency-Key": submission.idempotencyKey }, body: JSON.stringify(request) },
      );
      assertContract(isRenderJob(value), "Render job response không đúng contract.");
      intents.complete(submittedProjectId, submission.idempotencyKey);
      return { ...value, recoveredSubmission: submission.recovered };
    } catch (error) {
      // Validation/admission rejection is definitive. Transport, timeout, conflict and 5xx remain ambiguous.
      if (error instanceof DesktopApiError && error.status >= 400 && error.status < 500 && ![408, 409].includes(error.status)) {
        intents.complete(submittedProjectId, submission.idempotencyKey);
      }
      throw error;
    }
  },

  preflight: (input: LocalRenderPreflightInput): Promise<LocalRenderPreflight> =>
    runLocalRenderPreflight(input, {
      ...localRenderExecutorDependencies(),
      preflight: (preflightInput) => window.narrativex.render.preflight(preflightInput),
    }),
};

function localRenderExecutorDependencies() {
  return {
    status: () => window.narrativex.localExecution.status(),
    requestPairingCode: () =>
      apiRequest<{ code: string; expiresAt: string }>(
        "/api/v1/local-devices/pairing-codes",
        { method: "POST" },
      ),
    pair: (code: string) => window.narrativex.localExecution.pair(code),
  };
}
