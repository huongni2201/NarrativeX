import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InlineNotice } from "../../workspace/components/WorkstationPrimitives";
import { wordCount } from "../model/chapter-ui";

export function ChapterWritingForm({
  title,
  sourceText,
  onTitleChange,
  onSourceTextChange,
}: Readonly<{
  title: string;
  sourceText: string;
  onTitleChange: (value: string) => void;
  onSourceTextChange: (value: string) => void;
}>) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-secondary" htmlFor="chapter-title">
          Tên chapter <span className="text-danger">*</span>
        </label>
        <div className="relative">
          <Input
            id="chapter-title"
            name="chapter-title"
            autoComplete="off"
            maxLength={120}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Nhập tên chapter"
            className="h-9 border-border bg-surface-input pr-16 text-xs"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-dim">
            {title.length} / 120
          </span>
        </div>
      </div>

      <div className="flex h-[clamp(300px,42vh,520px)] flex-col space-y-1.5">
        <label className="text-xs font-semibold text-text-secondary" htmlFor="chapter-source">
          Nội dung chapter <span className="text-danger">*</span>
        </label>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-surface-input focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <Textarea
            id="chapter-source"
            name="chapter-source"
            value={sourceText}
            onChange={(event) => onSourceTextChange(event.target.value)}
            placeholder="Nhập nội dung chapter..."
            className="min-h-0 flex-1 resize-none border-0 bg-transparent p-3 text-xs leading-relaxed focus-visible:ring-0"
          />
          <div className="flex items-center justify-between border-t border-border-subtle bg-surface-2 px-3 py-1.5 text-[10px] text-text-dim">
            <span>{wordCount(sourceText).toLocaleString("vi-VN")} từ</span>
            <span>{sourceText.length.toLocaleString("vi-VN")} ký tự</span>
          </div>
        </div>
      </div>

      <InlineNotice tone="info">
        Phân tích và tạo audio luôn dùng bản chapter đã lưu trên backend, không dùng nội dung nháp chưa lưu trong form.
      </InlineNotice>
    </>
  );
}
