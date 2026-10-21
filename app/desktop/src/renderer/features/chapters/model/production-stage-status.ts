import type { ChapterProductionStatus } from "../../../../shared/api-types";

export function productionStageStatus(status?: ChapterProductionStatus | null) {
  return {
    audioReady: status?.audioReady ?? null,
    totalShots: status?.totalShots ?? 0,
    shotsGeneratedCount: status?.passedShots ?? 0,
    technicalValidatedCount: status?.passedShots ?? 0,
    editorReady: status?.timelineReady === true,
    generationReady: status?.generationReady === true,
    overallProgressPercent: status?.overallProgressPercent ?? 0,
    voiceReady: status?.voiceReady ?? null,
  };
}
