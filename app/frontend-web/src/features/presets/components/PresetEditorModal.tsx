import React, { useEffect, useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import type { PresetCategory, StylePreset } from "@/types/presets";

interface PresetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  preset: StylePreset | null;
  onSave: (data: Partial<StylePreset>) => void;
}

export const PresetEditorModal: React.FC<PresetEditorModalProps> = ({ isOpen, onClose, preset, onSave }) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PresetCategory>("VISUAL_STYLE");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const nameId = useId();
  const categoryId = useId();
  const descriptionId = useId();
  const tagsId = useId();

  useEffect(() => {
    if (!isOpen) return;
    setName(preset?.name ?? "");
    setCategory(preset?.category ?? "VISUAL_STYLE");
    setDescription(preset?.description ?? "");
    setTagsInput(preset?.tags.join(", ") ?? "");
  }, [isOpen, preset]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const tags = tagsInput.split(",").map((tag) => tag.trim().toUpperCase()).filter(Boolean);
    onSave({ name: name.trim() || "Phong cách mới", category, description: description.trim(), tags: tags.length ? tags : ["CUSTOM"] });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel={preset ? `Chỉnh sửa preset ${preset.name}` : "Tạo preset mới"} maxWidth="2xl">
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <div><h2 className="text-lg font-bold text-white">{preset ? `Chỉnh sửa: ${preset.name}` : "Tạo mẫu phong cách mới"}</h2><p className="mt-1 text-xs text-slate-400">Preset editor này chỉ hoạt động trong mock runtime cho tới khi Preset API sẵn sàng.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><label htmlFor={nameId} className="text-xs font-semibold text-slate-300">Tên preset</label><Input id={nameId} required value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div className="space-y-1.5"><label htmlFor={categoryId} className="text-xs font-semibold text-slate-300">Danh mục</label><select id={categoryId} value={category} onChange={(event) => setCategory(event.target.value as PresetCategory)} className="w-full rounded-lg border border-slate-800 bg-surface-panel px-3.5 py-2 text-xs text-slate-200"><option value="VISUAL_STYLE">Visual Style</option><option value="IMAGE">Image</option><option value="MOTION">Motion</option><option value="OUTFIT">Outfit</option><option value="RENDER">Render</option></select></div>
        </div>
        <div className="space-y-1.5"><label htmlFor={descriptionId} className="text-xs font-semibold text-slate-300">Mô tả</label><Textarea id={descriptionId} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="space-y-1.5"><label htmlFor={tagsId} className="text-xs font-semibold text-slate-300">Tags</label><Input id={tagsId} value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="CINEMATIC, FANTASY" /></div>
        <div className="flex justify-end gap-2 border-t border-slate-800 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Hủy</Button><Button type="submit" variant="primary">Lưu phong cách</Button></div>
      </form>
    </Modal>
  );
};
