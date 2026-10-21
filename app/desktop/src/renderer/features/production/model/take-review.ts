import type { DesktopShot, DesktopTake, TakeContentReviewChecklist } from "../../../../shared/api-types";

export const TAKE_REVIEW_ITEMS: Array<{ key: keyof TakeContentReviewChecklist; label: string }> = [
  { key: "characterWardrobe", label: "Nhân vật và trang phục" },
  { key: "settingContinuity", label: "Bối cảnh và continuity" },
  { key: "actionMotion", label: "Hành động và chuyển động" },
  { key: "dialogueVoice", label: "Lời thoại và giọng" },
  { key: "lipSync", label: "Khẩu hình và thoại trên hình" },
];

export function takeReviewChecklist(checked = false): TakeContentReviewChecklist {
  return { characterWardrobe: checked, settingContinuity: checked, actionMotion: checked, dialogueVoice: checked, lipSync: checked };
}

export function isTakeSelectable(take?: DesktopTake | null) {
  const status = take?.status?.toUpperCase() ?? "";
  return Boolean(take && ["PASSED", "COMPLETED", "SUCCEEDED"].includes(status) &&
    (status === "PASSED" || take.validationResult?.passed === true) &&
    take.validationResult?.passed !== false && take.outputAssetId &&
    Number.isSafeInteger(take.sourceDurationMs) && take.sourceDurationMs! > 0);
}

export function bulkTakeCandidates(shots: readonly DesktopShot[]) {
  return shots.filter((shot) => !shot.selectedTake).flatMap((shot) => {
    const takes = (shot.takes ?? []).filter(isTakeSelectable).sort((a, b) => b.attemptNumber - a.attemptNumber);
    return takes.length ? [{ shot, takes }] : [];
  });
}
