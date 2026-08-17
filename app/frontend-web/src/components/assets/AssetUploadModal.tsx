import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { UploadCloud, X, Film, Image as ImageIcon, Volume2, Bookmark, Check } from "lucide-react";
import { useAssetStore } from "@/store/useAssetStore";
import { AssetType, MediaAsset } from "@/types/assets";

interface AssetUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AssetUploadModal: React.FC<AssetUploadModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addAsset } = useAssetStore();
  const [selectedType, setSelectedType] = useState<AssetType>("IMAGE");
  const [filename, setFilename] = useState("");
  const [projectTitle, setProjectTitle] = useState("Huyền Thoại Kiếm Thần");
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    setTimeout(() => {
      const newAsset: MediaAsset = {
        id: `ast-${Date.now()}`,
        filename: filename || `uploaded_${selectedType.toLowerCase()}_${Date.now().toString().slice(-4)}.png`,
        type: selectedType,
        status: "APPROVED",
        thumbnailUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop",
        fileSize: "3.5 MB",
        dimensions: selectedType === "AUDIO" ? undefined : "1920 × 1080",
        audioSampleRate: selectedType === "AUDIO" ? "44.1 kHz • WAV" : undefined,
        createdAt: "Vừa xong",
        provider: "User Upload",
        projectTitle: projectTitle,
        aspectRatio: "16:9",
        quality: "High",
        usedIn: [],
      };

      addAsset(newAsset);
      setIsUploading(false);
      onClose();
    }, 600);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      className="p-0 border border-slate-800 bg-[#0d1420]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#090e18]">
        <span className="font-bold text-base text-white">Upload tài sản mới</span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
        {/* Dropzone */}
        <div className="border-2 border-dashed border-slate-800 hover:border-purple-500/60 rounded-xl bg-[#090e18] p-8 text-center space-y-3 cursor-pointer transition-colors">
          <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400 mx-auto">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-200">
              Kéo thả file media hoặc <span className="text-purple-400 underline">duyệt máy tính</span>
            </p>
            <p className="text-xs text-slate-500">
              Hỗ trợ PNG, JPG, MP4, WEBM, WAV, MP3 (Tối đa 500MB)
            </p>
          </div>
        </div>

        {/* Type Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Loại tài sản</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { type: "IMAGE" as AssetType, label: "Hình ảnh", icon: ImageIcon },
              { type: "VIDEO" as AssetType, label: "Video", icon: Film },
              { type: "AUDIO" as AssetType, label: "Âm thanh", icon: Volume2 },
              { type: "REFERENCE" as AssetType, label: "Reference", icon: Bookmark },
              { type: "MOTION" as AssetType, label: "Motion", icon: Film },
              { type: "FINAL_OUTPUT" as AssetType, label: "Final Output", icon: Film },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = selectedType === item.type;
              return (
                <button
                  type="button"
                  key={item.type}
                  onClick={() => setSelectedType(item.type)}
                  className={`p-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all ${
                    isSelected
                      ? "bg-purple-950/80 border-purple-600 text-white font-semibold shadow-[0_0_12px_rgba(124,58,237,0.3)]"
                      : "bg-[#090e18] border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Project Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Gắn vào Dự án</label>
          <select
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="w-full bg-[#090e18] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="Huyền Thoại Kiếm Thần">Huyền Thoại Kiếm Thần</option>
            <option value="Huyền Thoại Ánh Sáng">Huyền Thoại Ánh Sáng</option>
            <option value="Dòng Máu Rồng">Dòng Máu Rồng</option>
            <option value="Global Library">Kho dùng chung (Global Library)</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            isLoading={isUploading}
            className="shadow-[0_0_15px_rgba(124,58,237,0.4)]"
          >
            Tải lên tài sản
          </Button>
        </div>
      </form>
    </Modal>
  );
};
