import type { DesktopChapterDetails } from "../../../../shared/api-types";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface DeleteChapterDialogProps {
  chapter: DesktopChapterDetails | null;
  isPending: boolean;
  error: Error | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteChapterDialog({
  chapter,
  isPending,
  error,
  onClose,
  onConfirm,
}: DeleteChapterDialogProps) {
  const label = chapter ? chapter.title || `Chương ${chapter.orderIndex + 1}` : "";

  return (
    <Dialog
      open={chapter !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent
        className="w-[min(460px,calc(100vw-32px))] gap-4 bg-surface-panel p-6"
        aria-describedby="delete-chapter-description"
      >
        <DialogCloseButton disabled={isPending} />
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="text-[15px] font-bold text-foreground">Xoá chương?</DialogTitle>
          <DialogDescription id="delete-chapter-description" className="text-body leading-relaxed text-text-muted">
            Chương <strong className="font-semibold text-foreground">{label}</strong> sẽ biến mất khỏi
            dự án cùng nội dung gốc, hồ sơ và kịch bản của chương. Chương đang có tác vụ tạo nội dung
            chạy thì chưa thể xoá.
          </DialogDescription>
        </DialogHeader>

        {Boolean(error) && (
          <p className="m-0 border-l-2 border-danger bg-danger-bg px-3 py-2 text-label text-danger" role="alert">
            Không thể xoá chương: {error?.message}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-border-subtle pt-4">
          <Button variant="outline" size="default" disabled={isPending} onClick={() => onClose()}>
            Huỷ
          </Button>
          <Button variant="destructive" size="default" disabled={isPending} onClick={onConfirm}>
            <Trash2 size={14} />
            {isPending ? "Đang xoá…" : "Xoá chương"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
