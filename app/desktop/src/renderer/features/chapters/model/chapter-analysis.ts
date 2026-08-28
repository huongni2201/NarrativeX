import {
  isActiveGenerationJobStatus,
  isTerminalGenerationJobStatus,
} from "../../generation/generation-status.ts";

export interface ChapterAnalysisJobState {
  status: string;
  errorCode?: string | null;
}

export interface ChapterAnalysisUiState {
  isAnalyzing: boolean;
  isTerminal: boolean;
  canAnalyze: boolean;
  message: string | null;
}

export function deriveChapterAnalysisUiState(
  job: ChapterAnalysisJobState | null,
  mutationPending: boolean,
): ChapterAnalysisUiState {
  if (mutationPending) {
    return {
      isAnalyzing: true,
      isTerminal: false,
      canAnalyze: false,
      message: "Đang gửi yêu cầu phân tích chapter…",
    };
  }

  if (!job) {
    return {
      isAnalyzing: false,
      isTerminal: false,
      canAnalyze: true,
      message: null,
    };
  }

  if (isActiveGenerationJobStatus(job.status)) {
    return {
      isAnalyzing: true,
      isTerminal: false,
      canAnalyze: false,
      message: "Phân tích chapter đang chạy…",
    };
  }

  if (isTerminalGenerationJobStatus(job.status)) {
    if (job.status === "COMPLETED") {
      return {
        isAnalyzing: false,
        isTerminal: true,
        canAnalyze: true,
        message: "Phân tích chapter đã hoàn tất.",
      };
    }
    if (job.status === "FAILED") {
      return {
        isAnalyzing: false,
        isTerminal: true,
        canAnalyze: true,
        message: job.errorCode
          ? `Phân tích chapter thất bại (${job.errorCode}).`
          : "Phân tích chapter thất bại.",
      };
    }
    return {
      isAnalyzing: false,
      isTerminal: true,
      canAnalyze: true,
      message: "Phân tích chapter đã bị hủy.",
    };
  }

  return {
    isAnalyzing: false,
    isTerminal: false,
    canAnalyze: true,
    message: null,
  };
}
