import { Image, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChapterAnalysisProductionMode } from "../../generation/api/generation.api";

export function AnalysisModeDialog({
  open,
  onClose,
  onSelect,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  onSelect: (mode: ChapterAnalysisProductionMode) => void;
}>) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="w-[min(620px,calc(100vw-32px))] rounded-xl border border-border bg-surface-panel p-6 shadow-2xl"
        aria-describedby="analysis-mode-description"
      >
        <DialogCloseButton aria-label="Đóng" />
        <DialogTitle className="text-lg font-semibold text-foreground">
          Chuẩn bị Storyboard
        </DialogTitle>
        <DialogDescription
          id="analysis-mode-description"
          className="mt-1 text-sm leading-6 text-text-secondary"
        >
          Chọn loại visual cho lần phân tích này. Lựa chọn được lưu cùng analysis job để AI tạo
          visual beats phù hợp ngay từ đầu.
        </DialogDescription>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-32 items-start justify-start gap-3 border-border bg-surface p-4 text-left hover:border-primary/55 hover:bg-surface-2"
            onClick={() => onSelect("IMAGE_MOTION")}
          >
            <span className="mt-0.5 rounded-md border border-border bg-surface-input p-2 text-primary-hover">
              <Image size={18} />
            </span>
            <span className="min-w-0 whitespace-normal">
              <span className="block text-sm font-semibold text-foreground">Image</span>
              <span className="mt-1 block text-xs font-normal leading-5 text-text-secondary">
                Tạo still image cho mỗi beat. FFmpeg tiếp tục đảm nhiệm pan, zoom và camera motion.
              </span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-32 items-start justify-start gap-3 border-border bg-surface p-4 text-left hover:border-primary/55 hover:bg-surface-2"
            onClick={() => onSelect("VIDEO_GENERATION")}
          >
            <span className="mt-0.5 rounded-md border border-border bg-surface-input p-2 text-primary-hover">
              <Video size={18} />
            </span>
            <span className="min-w-0 whitespace-normal">
              <span className="block text-sm font-semibold text-foreground">Video</span>
              <span className="mt-1 block text-xs font-normal leading-5 text-text-secondary">
                AI chia thành các continuous shots ngắn tối đa 8 giây. FFmpeg chỉ trim, normalize,
                upscale khi cần và ghép video.
              </span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
