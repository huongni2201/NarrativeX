import React from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { FileText, UploadCloud, Sparkles, Info } from "lucide-react";
import type { ApiFieldError } from "@/types/api";

interface Step2Props {
  onNext: () => void;
  onBack: () => void;
  validationErrors?: ApiFieldError[];
}

export const Step2ImportStory: React.FC<Step2Props> = ({ validationErrors = [] }) => {
  const wizardDraft = useStudioStore((state) => state.wizardDraft);
  const updateWizardDraft = useStudioStore((state) => state.updateWizardDraft);
  const loadSampleStory = useStudioStore((state) => state.loadSampleStory);
  const contentError = validationErrors.find((error) => ["content", "storyText"].includes(error.field));
  const characterCount = wizardDraft.storyText.length;

  return (
    <div className="flex flex-col md:flex-row gap-8 min-h-[480px]">
      <div className="flex-1 space-y-4 flex flex-col">
        <div>
          <h2 className="text-lg font-semibold text-white">Nhập truyện của bạn</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Dán nội dung truyện hoặc kịch bản để lưu vào StoryVersion trên backend.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
          <FileText className="w-3.5 h-3.5" />
          Nhập văn bản
        </div>

        <div className="flex-1 flex flex-col relative rounded-xl border border-slate-800 bg-[#0a0f1d] overflow-hidden focus-within:border-purple-500 transition-colors min-h-[320px]">
          <textarea
            rows={12}
            value={wizardDraft.storyText}
            onChange={(event) => updateWizardDraft({ storyText: event.target.value })}
            placeholder="Dán nội dung truyện của bạn vào đây (tiểu thuyết, truyện ngắn, kịch bản)…"
            aria-invalid={contentError ? "true" : undefined}
            aria-describedby={contentError ? "story-content-error" : undefined}
            className="w-full flex-1 p-4 bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none text-sm leading-relaxed resize-none font-sans"
          />
          <div className="px-4 py-2 bg-[#090e18] border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono">
              Số ký tự: <strong className="text-purple-300">{characterCount.toLocaleString()}</strong>
            </span>
            <span className="text-[11px] text-slate-500">Dữ liệu sẽ được lưu bằng API thật.</span>
          </div>
          {contentError && (
            <p id="story-content-error" className="px-4 py-2 text-xs text-rose-300">
              {contentError.message || contentError.code || "Nội dung truyện không hợp lệ."}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-dashed border-slate-700 bg-[#090e18]/70 p-5" aria-disabled="true">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-300">Tải file</p>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sắp có</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Import .txt, .docx, .pdf và .epub đang bị vô hiệu hóa cho tới khi backend có Document Import API và storage contract tương ứng.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full md:w-64 shrink-0 space-y-4">
        <div className="p-4 rounded-xl bg-[#090e18] border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
            <Info className="w-4 h-4 text-purple-400" />
            <span>Gợi ý</span>
          </div>

          <ul className="space-y-2.5 text-xs text-slate-400 leading-relaxed">
            <li className="flex items-start gap-2"><span className="text-purple-400 font-bold">•</span><span>Dán nội dung truyện hiện có vào ô văn bản.</span></li>
            <li className="flex items-start gap-2"><span className="text-purple-400 font-bold">•</span><span>Project và StoryVersion chỉ được tạo khi bạn xác nhận ở bước cuối.</span></li>
            <li className="flex items-start gap-2"><span className="text-purple-400 font-bold">•</span><span>File import sẽ được bật sau khi backend hỗ trợ extraction và storage.</span></li>
          </ul>

          <div className="pt-2 border-t border-slate-800/80">
            <button type="button" onClick={loadSampleStory} className="w-full py-2 px-3 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/60 text-purple-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Điền truyện mẫu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
