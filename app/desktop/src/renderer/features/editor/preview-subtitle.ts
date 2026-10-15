/** Câu mẫu dùng khi playhead chưa nằm trong cue nào nhưng người dùng đang chỉnh phụ đề. */
export const SUBTITLE_SAMPLE_TEXT = "Đường về nhà — những câu chuyện đẹp.";

/**
 * Chọn văn bản phụ đề hiển thị trên khung preview.
 * - Phụ đề tắt → không hiển thị gì.
 * - Có cue tại playhead → luôn dùng cue thật (giống CapCut: sửa style trên đúng câu đang xem).
 * - Không có cue nhưng đang mở tab chỉnh phụ đề → dùng câu mẫu để thay đổi hiện ngay.
 */
export function resolvePreviewSubtitleText({
  enabled,
  activeText,
  editing,
}: Readonly<{ enabled: boolean; activeText: string | null | undefined; editing: boolean }>): string | null {
  if (!enabled) return null;
  if (activeText?.trim()) return activeText;
  return editing ? SUBTITLE_SAMPLE_TEXT : null;
}
