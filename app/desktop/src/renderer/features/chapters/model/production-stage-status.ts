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

/** Guidance only: readiness and admission remain authoritative on the backend. */
export function productionNextStep(status?: ChapterProductionStatus | null): {
  title: string;
  detail: string;
  destination?: "audio" | "editor";
} {
  if (!status) return {
    title: "Đang tải trạng thái sản xuất",
    detail: "Chờ dữ liệu từ máy chủ để xác định bước tiếp theo.",
  };
  if (!status.storyReady || status.totalShots === 0) return {
    title: "Hoàn tất phân tích kịch bản",
    detail: "Mở Nội dung gốc để phân tích chương và tạo kế hoạch Shot trước khi sản xuất.",
  };
  const busy = status.queuedShots + status.generatingShots + status.validatingShots;
  if (busy > 0) return {
    title: "Theo dõi các Shot đang xử lý",
    detail: `${status.queuedShots} đang chờ · ${status.generatingShots} đang tạo · ${status.validatingShots} đang kiểm tra. Bạn có thể duyệt các Take đã hoàn tất bên dưới.`,
  };
  if (status.selectedTakeCount === status.totalShots) {
    if (!status.timelineReady) return {
      destination: "editor",
      title: "Kiểm tra dữ liệu dựng chương",
      detail: "Các Shot đã có Take được chọn. Mở trình dựng để kiểm tra media và thời gian; việc chọn đủ Take chưa đồng nghĩa timeline đã sẵn sàng.",
    };
    if (!status.renderReady) return {
      destination: "editor",
      title: "Chương đã sẵn sàng để dựng",
      detail: "Mở trình dựng để xem trước. Kiểm tra các chương còn lại của dự án trước khi xuất video.",
    };
    return {
      destination: "editor",
      title: "Dự án đã sẵn sàng để xuất video",
      detail: "Mở trình dựng, xem trước các điểm nối và chọn xuất video. Hệ thống sẽ kiểm tra lại điều kiện khi bạn gửi yêu cầu.",
    };
  }
  if (status.manualReviewShots > 0) return {
    title: "Kiểm tra Shot cần duyệt thủ công",
    detail: "Mở chi tiết các Shot cần duyệt để kiểm tra kết quả và trạng thái thực thi trước khi quyết định tạo lại.",
  };
  if (!status.voiceReady) return {
    destination: "audio",
    title: "Hoàn tất giọng nhân vật",
    detail: "Mở Âm thanh và gán giọng cho các nhân vật có lời thoại để mở khóa tạo video.",
  };
  if (status.blockedShots > 0 || !status.generationReady) return {
    title: "Kiểm tra điều kiện tạo video",
    detail: "Xem các Shot bên dưới để xử lý điều kiện bị chặn trước khi tạo tiếp. Nút tạo video chỉ mở khi API xác nhận sẵn sàng.",
  };
  if (status.passedShots < status.totalShots) return {
    title: "Tạo các Shot còn thiếu",
    detail: `${status.totalShots - status.passedShots} Shot chưa có kết quả qua kiểm tra kỹ thuật. Tạo tiếp hoặc xem lỗi và thử lại từng Shot bên dưới.`,
  };
  return {
    title: "Duyệt và chọn Take cho từng Shot",
    detail: `${status.totalShots - status.selectedTakeCount} Shot chưa có Take được chọn. Xem hình, tiếng và In/Out trước khi chọn; kiểm tra kỹ thuật không thay thế việc duyệt nội dung.`,
  };
}
