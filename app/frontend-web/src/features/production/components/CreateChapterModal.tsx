import { useEffect, useState } from "react";
import { FileText, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export interface CreateChapterInput {
  title: string;
  sourceText: string;
}

interface CreateChapterModalProps {
  isOpen: boolean;
  nextChapterNumber: number;
  isSubmitting: boolean;
  error: string | null;
  resetKey: number;
  onClose: () => void;
  onSubmit: (input: CreateChapterInput) => void;
}

const inheritedContexts = [
  "Character Bible & Locked Versions",
  "Địa điểm & Bối cảnh",
  "Outfit & Style Bible",
  "Cài đặt Visual & Motion",
  "Giọng đọc & Ngôn ngữ",
];

export function CreateChapterModal({
  isOpen,
  nextChapterNumber,
  isSubmitting,
  error,
  resetKey,
  onClose,
  onSubmit,
}: Readonly<CreateChapterModalProps>) {
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  useEffect(() => {
    setTitle("");
    setSourceText("");
    setValidationError(null);
  }, [resetKey]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    const normalizedSourceText = sourceText.trim();
    if (!normalizedTitle || !normalizedSourceText) {
      setValidationError("Nhập tiêu đề và nội dung Chapter.");
      return;
    }
    setValidationError(null);
    onSubmit({ title: normalizedTitle, sourceText: normalizedSourceText });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title="Thêm Chapter mới"
      subtitle="Chapter mới sẽ dùng cấu hình và context hiện có của project."
      maxWidth="2xl"
      closeDisabled={isSubmitting}
    >
      <form onSubmit={handleSubmit} className="space-y-5 p-6">
        <div>
          <label className="text-xs font-semibold text-slate-300">Số thứ tự Chapter</label>
          <div className="mt-2 flex items-center gap-3">
            <div className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center font-mono text-sm font-bold text-slate-300">
              {String(nextChapterNumber).padStart(2, "0")}
            </div>
            <span className="text-xs text-slate-500">Thứ tự được hệ thống tự động xác định.</span>
          </div>
        </div>

        <div>
          <label htmlFor="chapter-title" className="text-xs font-semibold text-slate-300">
            Tiêu đề Chapter
          </label>
          <input
            id="chapter-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setValidationError(null);
            }}
            placeholder="Nhập tiêu đề chapter..."
            maxLength={200}
            autoComplete="off"
            required
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="chapter-source" className="text-xs font-semibold text-slate-300">
              Nhập nội dung Chapter
            </label>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-950/50 px-2 py-1 text-[10px] font-medium text-purple-300">
              <FileText className="h-3 w-3" /> Nhập văn bản
            </span>
          </div>
          <textarea
            id="chapter-source"
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value);
              setValidationError(null);
            }}
            placeholder="Dán nội dung chương truyện vào đây..."
            rows={8}
            required
            className="mt-2 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm leading-6 text-slate-200 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          />
          <p className="mt-1 text-right text-[11px] text-slate-500">{sourceText.length.toLocaleString("vi-VN")} ký tự</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#090e18] p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Kế thừa từ dự án</h3>
          </div>
          <div className="mt-3 space-y-2">
            {inheritedContexts.map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {(validationError || error) && (
          <p role="alert" className="rounded-lg border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
            {validationError || error}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !sourceText.trim()}
            className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_rgba(124,58,237,0.3)] transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Đang thêm…" : "Thêm Chapter"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
