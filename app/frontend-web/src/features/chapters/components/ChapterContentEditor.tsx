import { Loader2, Pencil, RefreshCw, Save, X } from "lucide-react";

interface ChapterContentEditorProps {
  editing: boolean;
  title: string;
  sourceText: string;
  dirty: boolean;
  saving: boolean;
  saveMessage: string | null;
  onTitleChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onStartEditing: () => void;
  onCancel: () => void;
  onSave: () => void;
  onReload: () => void;
}

export function ChapterContentEditor({
  editing,
  title,
  sourceText,
  dirty,
  saving,
  saveMessage,
  onTitleChange,
  onSourceChange,
  onStartEditing,
  onCancel,
  onSave,
  onReload,
}: Readonly<ChapterContentEditorProps>) {
  if (!editing) {
    return (
      <section className="rounded-2xl border border-border bg-surface-card/90 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">Nội dung Chapter được tải trực tiếp từ backend.</p>
          </div>
          <button
            type="button"
            onClick={onStartEditing}
            className="inline-flex items-center gap-2 rounded-lg border border-border-dark px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <Pencil className="h-3.5 w-3.5" />
            Chỉnh sửa
          </button>
        </div>
        <div className="mt-5 whitespace-pre-wrap rounded-xl border border-border bg-surface-panel p-5 text-sm leading-7 text-slate-300">
          {sourceText || "Chapter chưa có nội dung."}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-card/90 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Chỉnh sửa Chapter</h2>
          <p className="mt-1 text-xs text-slate-500">Ctrl/Cmd + S để lưu. Backend kiểm soát optimistic concurrency.</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] ${
            dirty
              ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
              : "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
          }`}
        >
          {dirty ? "Chưa lưu" : "Đã đồng bộ"}
        </span>
      </div>

      <label className="mt-5 block space-y-2">
        <span className="text-xs font-medium text-slate-300">Tiêu đề Chapter</span>
        <input
          value={title}
          maxLength={200}
          onChange={(event) => onTitleChange(event.target.value)}
          className="w-full rounded-xl border border-border-dark bg-surface-panel px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />
      </label>

      <label className="mt-4 block space-y-2">
        <span className="text-xs font-medium text-slate-300">Nội dung truyện</span>
        <textarea
          value={sourceText}
          onChange={(event) => onSourceChange(event.target.value)}
          rows={20}
          className="min-h-[420px] w-full resize-y rounded-xl border border-border-dark bg-surface-panel px-4 py-4 text-sm leading-7 text-slate-200 outline-none transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500">
          {Array.from(sourceText).length.toLocaleString("vi-VN")} ký tự · SHA-256 do backend tính khi lưu
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReload}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tải lại
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Hủy
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || !title.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Đang lưu…" : "Lưu Chapter"}
          </button>
        </div>
      </div>

      {saveMessage && (
        <p role="status" aria-live="polite" className="mt-4 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
          {saveMessage}
        </p>
      )}
    </section>
  );
}
