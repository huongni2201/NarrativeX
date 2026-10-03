import type { ChapterProductionStatus } from "@narrativex/client-contracts";

export function productionStageStatus(status?: ChapterProductionStatus | null) {
  return {
    audioReady: status?.audioReady ?? null,
    totalShots: status?.totalShots ?? 0,
    shotsGeneratedCount: status?.passedShots ?? 0,
    qcPassedCount: status?.passedShots ?? 0,
    editorReady: status?.timelineReady === true,
    generationReady: status?.generationReady === true,
    overallProgressPercent: status?.overallProgressPercent ?? 0,
    voiceReady: status?.voiceReady ?? null,
  };
}
