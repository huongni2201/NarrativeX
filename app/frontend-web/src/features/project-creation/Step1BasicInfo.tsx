import React, { useId } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { Input, Textarea } from "@/components/ui/Input";
import { AspectRatio, ImageQuality } from "@/types/studio";
import { Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiFieldError } from "@/types/api";

interface Step1Props {
  onNext: () => void;
  onCancel: () => void;
  validationErrors?: ApiFieldError[];
}

export const Step1BasicInfo: React.FC<Step1Props> = ({ validationErrors = [] }) => {
  const { wizardDraft, updateWizardDraft } = useStudioStore();
  const nameError = validationErrors.find((error) => ["name", "title", "projectName"].includes(error.field));
  const nameId = useId();
  const descriptionId = useId();
  const genreId = useId();
  const languageId = useId();
  const aspectLabelId = useId();
  const qualityLabelId = useId();

  const aspectRatios: AspectRatio[] = ["16:9", "9:16", "1:1", "4:3", "3:4"];
  const qualities: ImageQuality[] = ["Standard", "High"];
  const genres = ["Fantasy", "Sci-Fi", "Cổ trang", "Kinh dị", "Trinh thám", "Đô thị / Hiện đại"];
  const languages = ["Tiếng Việt", "English", "日本語", "한국어"];

  return (
    <div className="flex min-h-[480px] flex-col gap-8 md:flex-row">
      <div className="flex-1 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Thông tin cơ bản</h2>
          <p className="mt-0.5 text-xs text-slate-400">Thiết lập tên dự án, thể loại và định dạng hiển thị mặc định.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-xs font-medium text-slate-300">Tên dự án</label>
          <Input
            id={nameId}
            value={wizardDraft.title}
            onChange={(event) => updateWizardDraft({ title: event.target.value })}
            placeholder="Nhập tên dự án…"
            error={nameError?.message || nameError?.code}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={descriptionId} className="text-xs font-medium text-slate-300">Mô tả</label>
          <Textarea id={descriptionId} rows={3} value={wizardDraft.description} onChange={(event) => updateWizardDraft({ description: event.target.value })} placeholder="Mô tả tóm tắt về câu chuyện…" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={genreId} className="text-xs font-medium text-slate-300">Thể loại</label>
            <select id={genreId} value={wizardDraft.genre} onChange={(event) => updateWizardDraft({ genre: event.target.value })} className="w-full rounded-lg border border-border-dark bg-surface-input px-3.5 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50">
              {genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={languageId} className="text-xs font-medium text-slate-300">Ngôn ngữ truyện</label>
            <select id={languageId} value={wizardDraft.language} onChange={(event) => updateWizardDraft({ language: event.target.value })} className="w-full rounded-lg border border-border-dark bg-surface-input px-3.5 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50">
              {languages.map((language) => <option key={language} value={language}>{language}</option>)}
            </select>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend id={aspectLabelId} className="text-xs font-medium text-slate-300">Tỉ lệ khung hình mặc định</legend>
          <div role="radiogroup" aria-labelledby={aspectLabelId} className="flex flex-wrap gap-2">
            {aspectRatios.map((ratio) => {
              const isActive = wizardDraft.aspectRatio === ratio;
              return (
                <button type="button" role="radio" aria-checked={isActive} key={ratio} onClick={() => updateWizardDraft({ aspectRatio: ratio })} className={cn("rounded-lg border px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", isActive ? "border-primary bg-primary text-white" : "border-border-dark bg-surface-input text-slate-400 hover:text-slate-200")}>{ratio}</button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend id={qualityLabelId} className="text-xs font-medium text-slate-300">Chất lượng hình ảnh mặc định</legend>
          <div role="radiogroup" aria-labelledby={qualityLabelId} className="flex gap-2">
            {qualities.map((quality) => {
              const isActive = wizardDraft.quality === quality;
              return (
                <button type="button" role="radio" aria-checked={isActive} key={quality} onClick={() => updateWizardDraft({ quality })} className={cn("rounded-lg border px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", isActive ? "border-primary bg-primary text-white" : "border-border-dark bg-surface-input text-slate-400 hover:text-slate-200")}>{quality}</button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <aside className="w-full shrink-0 space-y-4 md:w-64">
        <div className="space-y-3 rounded-xl border border-border-dark bg-surface-panel p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300"><Info className="h-4 w-4 text-primary-light" /><span>Gợi ý</span></div>
          <p className="text-xs leading-relaxed text-slate-400">Bạn có thể thay đổi các cài đặt này sau trong quá trình thực hiện dự án.</p>
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary-muted p-3 text-xs text-primary-light"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary-light" /><span>Tỉ lệ 9:16 phù hợp để tạo Short / Reel / TikTok.</span></div>
        </div>
      </aside>
    </div>
  );
};
