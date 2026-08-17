import React, { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { Tabs } from "@/components/ui/Tabs";
import { FileText, UploadCloud, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Step2Props {
  onNext: () => void;
  onBack: () => void;
}

export const Step2ImportStory: React.FC<Step2Props> = ({ onNext, onBack }) => {
  const { wizardDraft, updateWizardDraft, loadSampleStory } = useStudioStore();
  const [activeTab, setActiveTab] = useState("text");

  const importTabs = [
    { id: "text", label: "Nhập văn bản", icon: <FileText className="w-3.5 h-3.5" /> },
    { id: "upload", label: "Tải file", icon: <UploadCloud className="w-3.5 h-3.5" /> },
  ];

  const characterCount = wizardDraft.storyText ? wizardDraft.storyText.length : 0;

  return (
    <div className="flex flex-col md:flex-row gap-8 min-h-[480px]">
      {/* Left Input Area */}
      <div className="flex-1 space-y-4 flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Nhập truyện của bạn</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Dán truyện chữ, kịch bản hoặc tải tệp tài liệu để AI phân tích.
            </p>
          </div>

          <Tabs
            tabs={importTabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            variant="pills"
          />
        </div>

        {/* Tab content: Nhập văn bản */}
        {activeTab === "text" && (
          <div className="flex-1 flex flex-col relative rounded-xl border border-slate-800 bg-[#0a0f1d] overflow-hidden focus-within:border-purple-500 transition-colors min-h-[320px]">
            <textarea
              rows={12}
              value={wizardDraft.storyText}
              onChange={(e) => updateWizardDraft({ storyText: e.target.value })}
              placeholder="Dán nội dung truyện của bạn vào đây (tiểu thuyết, truyện ngắn, kịch bản)..."
              className="w-full flex-1 p-4 bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none text-sm leading-relaxed resize-none font-sans"
            />
            {/* Bottom Character Counter Bar */}
            <div className="px-4 py-2 bg-[#090e18] border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">
                Số ký tự: <strong className="text-purple-300">{characterCount.toLocaleString()}</strong>
              </span>
              <span className="text-[11px] text-slate-500">
                Ước tính: ~{Math.ceil(characterCount / 500)} phút phân tích
              </span>
            </div>
          </div>
        )}

        {/* Tab content: Tải file */}
        {activeTab === "upload" && (
          <div className="flex-1 border-2 border-dashed border-slate-800 hover:border-purple-500/50 rounded-xl bg-[#0a0f1d] flex flex-col items-center justify-center p-8 text-center space-y-3 cursor-pointer transition-colors">
            <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-200">
                Kéo thả file truyện hoặc <span className="text-purple-400 underline">duyệt máy tính</span>
              </p>
              <p className="text-xs text-slate-500">Hỗ trợ .txt, .docx, .pdf, .epub (tối đa 50MB)</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Tips Sidebar Panel */}
      <div className="w-full md:w-64 shrink-0 space-y-4">
        <div className="p-4 rounded-xl bg-[#090e18] border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
            <Info className="w-4 h-4 text-purple-400" />
            <span>Gợi ý</span>
          </div>

          <ul className="space-y-2.5 text-xs text-slate-400 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">•</span>
              <span>Dán nội dung truyện của bạn vào đây hoặc tải file .txt, .docx</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">•</span>
              <span>AI sẽ phân tích và chia nhỏ câu chuyện thành các thông số</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">•</span>
              <span>Không giới hạn độ dài câu chuyện</span>
            </li>
          </ul>

          {/* Sample Preset Button */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={loadSampleStory}
              className="w-full py-2 px-3 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/60 text-purple-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Ví dụ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
