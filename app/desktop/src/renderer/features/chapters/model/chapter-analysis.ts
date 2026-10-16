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

/** Plain-language reasons for failure codes reported by the Desktop agy runner. */
const FAILURE_REASONS: Record<string, string> = {
  PROVIDER_UNAVAILABLE: "Chưa cài agy hoặc không chạy được. Mở tab Tài khoản để kiểm tra.",
  AUTH_REQUIRED: "agy chưa đăng nhập. Mở tab Tài khoản và chọn “Mở agy để đăng nhập”.",
  QUOTA_EXHAUSTED: "Hạn mức agy đã hết. Xem thời điểm reset trong tab Tài khoản.",
  RATE_LIMITED: "agy đang giới hạn lượt dùng. Thử lại sau ít phút.",
  MODEL_UNAVAILABLE: "Model đã chọn không có trong agy. Chọn lại model trong tab Tài khoản.",
  TOOL_DENIED: "agy cố chạy một công cụ bị chặn nên không trả kết quả (không liên quan đến tài khoản). Bấm Phân tích chương để thử lại.",
  PROVIDER_REFUSAL: "agy từ chối yêu cầu. Kiểm tra gói tài khoản trong tab Tài khoản.",
  CONTENT_BLOCKED: "Nội dung chương bị bộ lọc an toàn chặn.",
  INPUT_TOO_LARGE: "Chương quá dài để phân tích một lần.",
  OUTPUT_LIMIT_EXCEEDED: "Kết quả phân tích vượt giới hạn cho phép.",
  SCHEMA_INVALID: "agy trả về kết quả không đúng định dạng. Hãy phân tích lại.",
  APP_INTERRUPTED: "Ứng dụng đã đóng khi đang phân tích nên chưa có kết quả. Bấm Phân tích chương để chạy lại.",
  ANALYSIS_TIMEOUT: "agy chạy quá thời gian cho phép nên đã bị dừng. Chương có thể quá dài; bấm Phân tích chương để thử lại.",
  PROCESS_FAILED: "agy thoát mà không trả kết quả. Bấm Phân tích chương để chạy lại.",
  OUTCOME_UNRESOLVED: "Không nhận được kết quả từ agy. Bấm Phân tích chương để chạy lại.",
};

export function describeAnalysisFailure(errorCode: string | null | undefined): string {
  const reason = errorCode ? FAILURE_REASONS[errorCode] : undefined;
  if (reason) return `Phân tích chapter thất bại: ${reason}`;
  return errorCode ? `Phân tích chapter thất bại (${errorCode}).` : "Phân tích chapter thất bại.";
}

export function deriveChapterAnalysisUiState(
  job: ChapterAnalysisJobState | null,
  mutationPending: boolean,
  monitoringError = false,
): ChapterAnalysisUiState {
  if (monitoringError) {
    return {
      isAnalyzing: false,
      isTerminal: false,
      canAnalyze: false,
      message: "Không thể xác nhận trạng thái phân tích. Kiểm tra trạng thái trước khi gửi lại.",
    };
  }

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
    const unresolved = job.status === "UNKNOWN" || job.status === "STALLED";
    return {
      isAnalyzing: !unresolved,
      isTerminal: false,
      canAnalyze: false,
      message: job.status === "QUEUED"
        ? "Chương đang chờ lượt phân tích. Với CLI, hãy giữ NarrativeX mở và kết nối phiên Google trong Account."
        : job.status === "UNKNOWN"
          ? "Đang chờ xác nhận kết quả phân tích. Nếu không có kết quả sau vài phút, tác vụ sẽ được đánh dấu lỗi để bạn chạy lại; ứng dụng không tự gửi lại."
          : job.status === "STALLED"
            ? "Tác vụ có thể đã dừng. Hãy kiểm tra nhật ký trước khi gửi lại."
            : "agy đang phân tích chương trên máy này. Giữ NarrativeX mở đến khi hoàn tất.",
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
        message: describeAnalysisFailure(job.errorCode),
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
