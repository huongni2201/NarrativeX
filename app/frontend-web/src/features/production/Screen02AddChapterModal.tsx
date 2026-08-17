import React, { useState } from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { CheckCircle2, FileText, UploadCloud, X, Sparkles, ShieldCheck } from "lucide-react";

export const Screen02AddChapterModal: React.FC = () => {
  const { isAddChapterModalOpen, closeAddChapterModal, addChapter } =
    useProductionStore();

  const [chapterNumber, setChapterNumber] = useState("06");
  const [chapterTitle, setChapterTitle] = useState("Cuộc hành quân đến phương Bắc");
  const [inputTab, setInputTab] = useState("text");
  const [storyContent, setStoryContent] = useState(
    "Đoàn quân rời khỏi thành Hắc Vân trong sương sớm, hướng về phương Bắc lạnh giá. Trên con đường phủ đầy tuyết trắng, họ phải đối mặt với những sinh vật huyền bí và băng giá khắc nghiệt..."
  );

  if (!isAddChapterModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addChapter({
      number: chapterNumber,
      title: chapterTitle,
      storyText: storyContent,
    });
  };

  const inheritedContexts = [
    "Character Bible & Locked Versions",
    "Địa điểm & Bối cảnh",
    "Outfit & Style Bible",
    "Cài đặt Visual & Motion",
    "Giọng đọc & Ngôn ngữ",
  ];

  return (
    <Modal
      isOpen={isAddChapterModalOpen}
      onClose={closeAddChapterModal}
      maxWidth="2xl"
      className="p-0 bg-[#0d1420] border border-slate-800"
    >
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#090e18]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-white tracking-wide">
            Thêm Chapter mới
          </h2>
        </div>

        <button
          onClick={closeAddChapterModal}
          className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
        {/* Số thứ tự Chapter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">
              Số thứ tự Chapter
            </label>
            <span className="text-[11px] text-slate-500 font-mono">
              Thứ tự được sắp xếp tự động nếu để trống
            </span>
          </div>
          <div className="w-24">
            <Input
              value={chapterNumber}
              onChange={(e) => setChapterNumber(e.target.value)}
              className="font-mono text-center text-sm font-bold"
              placeholder="06"
            />
          </div>
        </div>

        {/* Tiêu đề Chapter */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">
            Tiêu đề Chapter
          </label>
          <Input
            value={chapterTitle}
            onChange={(e) => setChapterTitle(e.target.value)}
            placeholder="Nhập tiêu đề chapter..."
            required
          />
        </div>

        {/* Nhập nội dung Chapter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">
              Nhập nội dung Chapter
            </label>
            <Tabs
              tabs={[
                { id: "text", label: "Nhập văn bản", icon: <FileText className="w-3 h-3" /> },
                { id: "upload", label: "Tải file", icon: <UploadCloud className="w-3 h-3" /> },
              ]}
              activeTab={inputTab}
              onChange={setInputTab}
              variant="pills"
            />
          </div>

          <div className="relative">
            <Textarea
              rows={5}
              value={storyContent}
              onChange={(e) => setStoryContent(e.target.value)}
              placeholder="Dán nội dung chương truyện vào đây..."
              required
            />
            <div className="text-right pt-1">
              <span className="text-[11px] text-slate-500 font-mono">
                ({storyContent.length.toLocaleString()} / 500,000 ký tự)
              </span>
            </div>
          </div>
        </div>

        {/* Kế thừa từ dự án (Project Inheritance Principle) */}
        <div className="p-4 rounded-xl bg-[#090e18] border border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Kế thừa từ dự án
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
            {inheritedContexts.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px]">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-800/60">
            Tài nguyên đã tồn tại từ dự án gốc sẽ được kế thừa tự động và KHÔNG bị tạo lại trùng lặp.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={closeAddChapterModal}
            size="md"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            variant="gradient"
            size="md"
            className="shadow-[0_0_20px_rgba(124,58,237,0.4)] font-semibold"
          >
            Thêm Chapter
          </Button>
        </div>
      </form>
    </Modal>
  );
};
