import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { ProductionChapter } from "../production.types";

interface DeleteChapterModalProps {
  chapter: ProductionChapter | null;
  isDeleting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (chapterId: string) => void;
}

export function DeleteChapterModal({
  chapter,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: Readonly<DeleteChapterModalProps>) {
  if (!chapter) return null;

  return (
    <Modal
      isOpen
      onClose={() => !isDeleting && onClose()}
      title="Xoá chapter?"
      subtitle="Thao tác này không thể hoàn tác."
      maxWidth="sm"
      closeDisabled={isDeleting}
    >
      <div className="space-y-5 p-6">
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" aria-hidden="true" />
          <p className="text-sm leading-6 text-rose-100">
            Bạn có chắc muốn xoá <strong>{chapter.title}</strong>? Toàn bộ dữ liệu thuộc chapter sẽ bị xoá khỏi project.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-border-dark pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => onConfirm(chapter.id)}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "Đang xoá…" : "Xoá chapter"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
