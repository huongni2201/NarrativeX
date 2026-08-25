import type {
  DesktopRenderJob,
  DesktopTimeline,
  LocalRenderPreflight,
  ProjectRenderBeatOverride,
} from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";
import { assertContract, isRecord, isString } from "../../../api/guards";

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
  getTimeline: (projectId: string) =>
    apiRequest<unknown>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/production/timeline`,
    ).then((value) => {
      assertContract(isTimeline(value), "Production timeline response không đúng contract.");
      return value;
    }),

  startRender: async (
    projectId: string,
    beatOverrides: ProjectRenderBeatOverride[] = [],
    resolution: "720p" | "1080p" = "1080p",
  ) => {
    const status = await window.narrativex.localExecution.status();
    if (!status.projectRenderEnabled) {
      throw new Error("Local FFmpeg rendering is not enabled.");
    }

    let localDeviceId = status.deviceId;
    if (status.state === "UNPAIRED") {
      const pairing = await apiRequest<{ code: string; expiresAt: string }>(
        "/api/v1/local-devices/pairing-codes",
        { method: "POST" },
      );
      const paired = await window.narrativex.localExecution.pair(pairing.code);
      localDeviceId = paired.deviceId;
    }

    if (!localDeviceId) throw new Error("Desktop local executor is not online.");

    return apiRequest<unknown>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/production/render`,
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          resolution,
          format: "mp4",
          executionTarget: "LOCAL_DEVICE",
          localDeviceId,
          beatOverrides,
        }),
      },
    ).then((value) => {
      assertContract(isRenderJob(value), "Render job response không đúng contract.");
      return value;
    });
  },

  preflight: (input: {
    projectId: string;
    assetIds: string[];
    estimatedOutputBytes: number;
    requiredTemporaryBytes: number;
  }): Promise<LocalRenderPreflight> => window.narrativex.render.preflight(input),

  getRenderJob: (jobId: string) =>
    apiRequest<unknown>(`/api/v1/generation-jobs/${encodeURIComponent(jobId)}`).then(
      (value) => {
        assertContract(isRenderJob(value), "Generation job response không đúng contract.");
        return value;
      },
    ),
};
