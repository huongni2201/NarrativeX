import type {
  AutoEditBeatDecision,
  AutoEditPlan,
  AutoEditStyle,
  BeatMediaFitMode,
  DesktopTimeline,
  DesktopTimelineBeat,
  ProjectRenderBeatOverride,
} from "@narrativex/client-contracts";

const CAMERA_MOVEMENTS = new Set([
  "NONE",
  "PAN",
  "TILT",
  "PUSH_IN",
  "PULL_OUT",
  "TRACK",
  "ZOOM_IN",
  "ZOOM_OUT",
  "PARALLAX",
]);

const REVEAL_TERMS = /\b(reveal|discover|realize|realise|recognize|recognise|notice|secret|truth|phát hiện|nhận ra|bí mật|sự thật)\b/i;
const ISOLATION_TERMS = /\b(alone|lonely|isolated|leaves|walks away|goodbye|một mình|cô độc|rời đi|chia tay)\b/i;
const PORTRAIT_TERMS = /\b(close[- ]?up|portrait|face|expression|reaction|cận cảnh|chân dung|biểu cảm|phản ứng)\b/i;
const VERTICAL_TERMS = /\b(look up|look down|tower|building|stairs|sky|ceiling|ngước lên|cúi xuống|tòa nhà|cầu thang|bầu trời|trần nhà)\b/i;
const ESTABLISH_TERMS = /\b(establish|landscape|city|village|room|location|environment|toàn cảnh|khung cảnh|thành phố|ngôi làng|căn phòng)\b/i;
const ACTION_TERMS = /\b(run|running|chase|fight|attack|escape|explosion|crash|rush|sprint|battle|combat|đuổi|chạy|chiến đấu|tấn công|trốn chạy|nổ|va chạm)\b/i;
const QUIET_TERMS = /\b(calm|quiet|still|pause|silence|conversation|dialogue|reflect|wait|yên tĩnh|im lặng|đối thoại|trò chuyện|suy ngẫm|chờ đợi)\b/i;

type ResolvedAutoEditStyle = Exclude<AutoEditStyle, "AUTO">;

export function createAutoEditPlan(
  timeline: DesktopTimeline,
  style: AutoEditStyle = "AUTO",
): AutoEditPlan {
  const decisions = timeline.beats.map((beat) => createBeatDecision(beat, style));
  const renderOverrides = decisions
    .map((decision, index) => toRenderOverride(timeline.beats[index], decision))
    .filter((override): override is ProjectRenderBeatOverride => override !== null);

  return {
    version: 1,
    projectId: timeline.projectId,
    style,
    decisions,
    renderOverrides,
  };
}

export function createBeatDecision(
  beat: DesktopTimelineBeat,
  style: AutoEditStyle = "AUTO",
): AutoEditBeatDecision {
  const resolvedStyle = resolveAutoEditStyle(beat, style);
  const motion = chooseCameraMovement(beat, resolvedStyle);
  const fit = chooseMediaFit(beat, resolvedStyle);
  const source = normalizedCameraMovement(beat.cameraMovement) !== "NONE"
    ? "AI_DIRECTED"
    : "RULE_ENGINE";

  return {
    visualBeatId: beat.visualBeatId,
    cameraMovement: motion,
    fitMode: fit.fitMode,
    trimStartMs: fit.trimStartMs,
    source,
    reason: style === "AUTO" ? `${fit.reason} Auto style: ${resolvedStyle}.` : fit.reason,
  };
}

export function resolveAutoEditStyle(
  beat: Pick<DesktopTimelineBeat, "title" | "visualIntent">,
  requestedStyle: AutoEditStyle = "AUTO",
): ResolvedAutoEditStyle {
  if (requestedStyle !== "AUTO") return requestedStyle;
  const text = `${beat.title}\n${beat.visualIntent}`;
  if (ACTION_TERMS.test(text)) return "DYNAMIC";
  if (REVEAL_TERMS.test(text) || ISOLATION_TERMS.test(text) || PORTRAIT_TERMS.test(text)) {
    return "CINEMATIC";
  }
  if (QUIET_TERMS.test(text)) return "BALANCED";
  return "BALANCED";
}

export function chooseMediaFit(
  beat: Pick<DesktopTimelineBeat, "mediaType" | "sourceDurationMs" | "durationMs">,
  style: ResolvedAutoEditStyle = "CINEMATIC",
): { fitMode: BeatMediaFitMode; trimStartMs: number; reason: string } {
  if (beat.mediaType !== "VIDEO") {
    return {
      fitMode: "TRIM",
      trimStartMs: 0,
      reason: "Still image follows narration duration; motion is handled by FFmpeg.",
    };
  }

  const targetMs = Math.max(1, beat.durationMs);
  const sourceMs = beat.sourceDurationMs;
  if (sourceMs == null || sourceMs <= 0) {
    return {
      fitMode: "FREEZE_END",
      trimStartMs: 0,
      reason: "Video duration is unknown, so Freeze End is the safest deterministic fit.",
    };
  }

  const ratio = sourceMs / targetMs;
  const trimThreshold = style === "DYNAMIC" ? 1 : style === "BALANCED" ? 1.08 : 1.15;
  const speedThreshold = style === "DYNAMIC" ? 0.78 : style === "BALANCED" ? 0.82 : 0.85;
  const freezeThreshold = style === "DYNAMIC" ? 0.45 : style === "BALANCED" ? 0.55 : 0.6;

  if (ratio >= trimThreshold) {
    const spareMs = Math.max(0, sourceMs - targetMs);
    const trimStartMs = style === "DYNAMIC"
      ? Math.round(spareMs * 0.35)
      : Math.round(spareMs / 2);
    return {
      fitMode: "TRIM",
      trimStartMs,
      reason: "Source video is longer than the narration span; Auto Edit selects a deterministic usable window.",
    };
  }

  if (ratio >= speedThreshold) {
    return {
      fitMode: "SPEED_ADJUST",
      trimStartMs: 0,
      reason: "Source duration is close to the narration span; a small speed adjustment avoids a visible freeze.",
    };
  }

  if (ratio >= freezeThreshold) {
    return {
      fitMode: "FREEZE_END",
      trimStartMs: 0,
      reason: "Source is moderately shorter than narration; freezing the final frame is less distracting than looping.",
    };
  }

  return {
    fitMode: "LOOP",
    trimStartMs: 0,
    reason: "Source is much shorter than narration; looping preserves motion across the full beat.",
  };
}

export function chooseCameraMovement(
  beat: Pick<DesktopTimelineBeat, "mediaType" | "cameraMovement" | "title" | "visualIntent">,
  style: AutoEditStyle = "CINEMATIC",
): string {
  if (beat.mediaType === "VIDEO") return "NONE";

  const authored = normalizedCameraMovement(beat.cameraMovement);
  if (authored !== "NONE") return authored;
  const resolvedStyle = resolveAutoEditStyle(beat, style);
  if (resolvedStyle === "BALANCED") return "NONE";

  const text = `${beat.title}\n${beat.visualIntent}`;
  if (REVEAL_TERMS.test(text)) return "PUSH_IN";
  if (ISOLATION_TERMS.test(text)) return "PULL_OUT";
  if (PORTRAIT_TERMS.test(text)) return resolvedStyle === "DYNAMIC" ? "PUSH_IN" : "PARALLAX";
  if (VERTICAL_TERMS.test(text)) return "TILT";
  if (ESTABLISH_TERMS.test(text)) return "PAN";
  if (resolvedStyle === "DYNAMIC" && ACTION_TERMS.test(text)) return "TRACK";
  return "NONE";
}

function toRenderOverride(
  beat: DesktopTimelineBeat,
  decision: AutoEditBeatDecision,
): ProjectRenderBeatOverride | null {
  const override: ProjectRenderBeatOverride = { visualBeatId: beat.visualBeatId };
  let changed = false;

  if (decision.cameraMovement !== normalizedCameraMovement(beat.cameraMovement)) {
    override.cameraMovement = decision.cameraMovement;
    changed = true;
  }
  if (decision.fitMode !== beat.fitMode) {
    override.fitMode = decision.fitMode;
    changed = true;
  }
  if (decision.trimStartMs !== beat.trimStartMs) {
    override.trimStartMs = decision.trimStartMs;
    changed = true;
  }

  return changed ? override : null;
}

function normalizedCameraMovement(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase() || "NONE";
  return CAMERA_MOVEMENTS.has(normalized) ? normalized : "NONE";
}
