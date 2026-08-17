import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StylePreset, PresetCategory } from "@/types/presets";
import { X, Sparkles, Palette, Camera, Check } from "lucide-react";

interface PresetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  preset: StylePreset | null;
  onSave: (data: Partial<StylePreset>) => void;
}

export const PresetEditorModal: React.FC<PresetEditorModalProps> = ({
  isOpen,
  onClose,
  preset,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PresetCategory>("VISUAL_STYLE");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [lighting, setLighting] = useState("");
  const [atmosphere, setAtmosphere] = useState("");
  const [cameraStyle, setCameraStyle] = useState("");
  const [defaultAspectRatio, setDefaultAspectRatio] = useState("16:9");
  const [defaultQuality, setDefaultQuality] = useState("Standard");
  const [negativeRules, setNegativeRules] = useState("");

  useEffect(() => {
    if (preset) {
      setName(preset.name);
      setCategory(preset.category);
      setDescription(preset.description);
      setTagsInput(preset.tags.join(", "));
      setLighting(preset.lighting || "");
      setAtmosphere(preset.atmosphere || "");
      setCameraStyle(preset.cameraStyle || "");
      setDefaultAspectRatio(preset.defaultAspectRatio || "16:9");
      setDefaultQuality(preset.defaultQuality || "Standard");
      setNegativeRules(preset.negativeRules || "");
    } else {
      setName("");
      setCategory("VISUAL_STYLE");
      setDescription("");
      setTagsInput("CINEMATIC, FANTASY");
      setLighting("Kịch tính, tương phản cao, ánh sáng định hướng");
      setAtmosphere("Huyền bí, u tối, mạnh mẽ");
      setCameraStyle("35mm cinematic, shallow DOF, dynamic angles");
      setDefaultAspectRatio("16:9");
      setDefaultQuality("Standard");
      setNegativeRules("No text, no watermark, no distorted anatomy, no low quality");
    }
  }, [preset, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0);

    onSave({
      name: name || "Phong cách mới",
      category,
      description: description || "Mô tả phong cách tùy chỉnh",
      tags: tags.length > 0 ? tags : ["CUSTOM"],
      lighting,
      atmosphere,
      cameraStyle,
      defaultAspectRatio,
      defaultQuality,
      negativeRules,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      className="p-0 border border-slate-800 bg-[#0d1420]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#090e18]">
        <span className="font-bold text-base text-white">
          {preset ? `Chỉnh sửa: ${preset.name}` : "Tạo mẫu phong cách mới"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        {/* Name & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Tên phong cách / Preset</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Cinematic Dark Fantasy"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Danh mục</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PresetCategory)}
              className="w-full bg-[#090e18] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="VISUAL_STYLE">Visual Style (Phong cách hình ảnh)</option>
              <option value="IMAGE">Image Preset (Khung hình &amp; Lens)</option>
              <option value="MOTION">Motion Preset (Chuyển động camera)</option>
              <option value="OUTFIT">Outfit Preset (Trang phục nhân vật)</option>
              <option value="RENDER">Render Preset (Cấu hình xuất video)</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Mô tả tóm tắt</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả phong cách, cảm xúc và thể loại truyện phù hợp..."
            className="w-full p-3 rounded-lg bg-[#090e18] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Tags phân loại (phân cách bằng dấu phẩy)</label>
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="VD: CINEMATIC, DARK, FANTASY"
          />
        </div>

        {/* Structured Settings */}
        <div className="p-4 rounded-xl bg-[#090e18] border border-slate-800/80 space-y-3.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
            Cấu hình tạo sinh AI
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Ánh sáng (Lighting)</label>
              <Input
                value={lighting}
                onChange={(e) => setLighting(e.target.value)}
                placeholder="VD: Kịch tính, tương phản cao..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Bầu không khí (Atmosphere)</label>
              <Input
                value={atmosphere}
                onChange={(e) => setAtmosphere(e.target.value)}
                placeholder="VD: Huyền bí, u tối, mạnh mẽ..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Camera &amp; Góc quay</label>
              <Input
                value={cameraStyle}
                onChange={(e) => setCameraStyle(e.target.value)}
                placeholder="VD: 35mm cinematic, shallow DOF..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">Tỷ lệ mặc định</label>
              <select
                value={defaultAspectRatio}
                onChange={(e) => setDefaultAspectRatio(e.target.value)}
                className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="16:9">16 : 9 (Landscape)</option>
                <option value="9:16">9 : 16 (Shorts / Reels)</option>
                <option value="2:3">2 : 3 (Portrait)</option>
                <option value="1:1">1 : 1 (Square)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-400">Negative Prompt Rules</label>
            <textarea
              rows={2}
              value={negativeRules}
              onChange={(e) => setNegativeRules(e.target.value)}
              placeholder="VD: No text, no watermark, no distorted anatomy, no low quality"
              className="w-full p-2.5 rounded-lg bg-[#070b14] border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>
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
            className="shadow-[0_0_15px_rgba(124,58,237,0.4)]"
          >
            Lưu phong cách
          </Button>
        </div>
      </form>
    </Modal>
  );
};
