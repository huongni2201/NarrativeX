import type { ProjectRenderBeatOverride, RenderFrameRate, RenderResolution, SubtitleStyle } from "../../../shared/api-types";
import { parseSubtitleStyle } from "../../../shared/subtitle-style.ts";

export interface RenderSubmissionRequest {
  projectId: string;
  resolution: RenderResolution;
  fps: RenderFrameRate;
  format: "mp4";
  executionTarget: "LOCAL_DEVICE";
  localDeviceId: string;
  subtitlesEnabled: boolean;
  subtitleStyle: SubtitleStyle;
  beatOverrides: ProjectRenderBeatOverride[];
}

interface PendingSubmission {
  schemaVersion: 1;
  idempotencyKey: string;
  request: RenderSubmissionRequest;
}

const prefix = "narrativex:render-submission:v1:";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Durable editor request state; the backend remains the authority for admitted jobs. */
export class RenderSubmissionIntents {
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem">) {}

  prepare(request: RenderSubmissionRequest): PendingSubmission & { recovered: boolean } {
    const selected = normalizeRequest(request);
    const pending = this.read(selected.projectId);
    if (pending) return { ...pending, recovered: true };
    const next: PendingSubmission = { schemaVersion: 1, idempotencyKey: crypto.randomUUID(), request: selected };
    // A failed write must stop submission; otherwise a lost response could be resubmitted as a new intent.
    this.storage.setItem(prefix + selected.projectId, JSON.stringify(next));
    return { ...next, recovered: false };
  }

  complete(projectId: string, idempotencyKey: string): void {
    if (this.read(projectId)?.idempotencyKey === idempotencyKey) this.storage.removeItem(prefix + projectId);
  }

  private read(projectId: string): PendingSubmission | null {
    const stored = this.storage.getItem(prefix + projectId);
    if (stored === null) return null;
    try {
      const value = JSON.parse(stored) as PendingSubmission;
      if (value.schemaVersion !== 1 || typeof value.idempotencyKey !== "string" || !uuid.test(value.idempotencyKey)) throw new Error();
      const request = normalizeRequest(value.request);
      if (request.projectId !== projectId) throw new Error();
      return { schemaVersion: 1, idempotencyKey: value.idempotencyKey, request };
    } catch {
      throw new Error("Không đọc được yêu cầu render trước. Cần kiểm tra trạng thái trước khi tạo yêu cầu mới.");
    }
  }
}

function normalizeRequest(value: RenderSubmissionRequest): RenderSubmissionRequest {
  if (!value || !uuid.test(value.projectId) || !uuid.test(value.localDeviceId) ||
      !["720p", "1080p", "1440p"].includes(value.resolution) || ![24, 30, 60].includes(value.fps) ||
      value.format !== "mp4" || value.executionTarget !== "LOCAL_DEVICE" || typeof value.subtitlesEnabled !== "boolean" ||
      !value.subtitleStyle || typeof value.subtitleStyle !== "object" ||
      !Array.isArray(value.beatOverrides) || value.beatOverrides.length > 2000) throw new Error("Invalid render submission.");
  const beatOverrides = value.beatOverrides.map((beat) => {
    if (!beat || !uuid.test(beat.visualBeatId) ||
        (beat.trimStartMs !== undefined && (!Number.isSafeInteger(beat.trimStartMs) || beat.trimStartMs < 0)) ||
        (beat.cameraMovement !== undefined && !["NONE", "PAN", "TILT", "PUSH_IN", "PULL_OUT", "TRACK", "ZOOM_IN", "ZOOM_OUT", "PARALLAX"].includes(beat.cameraMovement)) ||
        (beat.fitMode !== undefined && !["TRIM", "LOOP", "FREEZE_END", "SPEED_ADJUST"].includes(beat.fitMode))) throw new Error("Invalid render override.");
    return { visualBeatId: beat.visualBeatId, ...(beat.cameraMovement !== undefined ? { cameraMovement: beat.cameraMovement } : {}),
      ...(beat.fitMode !== undefined ? { fitMode: beat.fitMode } : {}), ...(beat.trimStartMs !== undefined ? { trimStartMs: beat.trimStartMs } : {}) };
  });
  return { projectId: value.projectId, resolution: value.resolution, fps: value.fps, format: "mp4", executionTarget: "LOCAL_DEVICE",
    localDeviceId: value.localDeviceId, subtitlesEnabled: value.subtitlesEnabled, subtitleStyle: parseSubtitleStyle(value.subtitleStyle), beatOverrides };
}
