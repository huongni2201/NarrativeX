import type { DesktopChapterDetails } from "@narrativex/client-contracts";
import { Clapperboard, Loader2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChapterNextActions({
  selected,
  busy,
  analyzeBusy,
  canAnalyze,
  generationBlockedByUnsavedChanges,
  onAnalyze,
  onOpenEditor,
}: Readonly<{
  selected: DesktopChapterDetails | null;
  busy: boolean;
  analyzeBusy: boolean;
  canAnalyze: boolean;
  generationBlockedByUnsavedChanges: boolean;
  onAnalyze: () => void;
  onOpenEditor: () => void;
}>) {
  return (
    <div className="space-y-2.5 border-t border-border pt-4">
      <span className="block text-[11px] font-semibold text-text-muted">
        Các hành động tiếp theo
      </span>
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          type="button"
          variant="outline"
          disabled={!selected || busy || generationBlockedByUnsavedChanges || !canAnalyze}
          onClick={onAnalyze}
          aria-busy={analyzeBusy}
          className="h-auto items-start justify-start rounded-md border-border bg-surface p-3 text-left hover:border-border-dark hover:bg-surface-2"
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-hover">
              {analyzeBusy ? (
                <Loader2 className="animate-spin" size={13} />
              ) : (
                <WandSparkles size={13} />
              )}
              <span>{analyzeBusy ? "Đang phân tích…" : "Phân tích chapter"}</span>
            </div>
            <p className="mt-1 text-[10px] font-normal leading-4 text-text-muted">
              {analyzeBusy
                ? "AI đang phân tích nội dung. Nút được khóa để tránh gửi trùng request cho chapter này."
                : !canAnalyze && selected
                  ? "Backend đang khóa phân tích cho trạng thái hiện tại của chapter."
                  : "Chọn IMAGE/VIDEO và provider trước khi tạo scene/beat."}
            </p>
          </div>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={!selected || busy}
          onClick={onOpenEditor}
          className="h-auto items-start justify-start rounded-md border-border bg-surface p-3 text-left hover:border-border-dark hover:bg-surface-2"
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
              <Clapperboard size={13} />
              <span>Mở Editor</span>
            </div>
            <p className="mt-1 text-[10px] font-normal leading-4 text-text-muted">
              Chỉnh scene, visual beat và media trên timeline.
            </p>
          </div>
        </Button>
      </div>
    </div>
  );
}
