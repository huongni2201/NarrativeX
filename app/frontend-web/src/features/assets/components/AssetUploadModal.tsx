import React, { useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAssetStore } from "@/store/useAssetStore";
import type { AssetType, MediaAsset } from "@/types/assets";

interface AssetUploadModalProps { isOpen: boolean; onClose: () => void }

export const AssetUploadModal: React.FC<AssetUploadModalProps> = ({ isOpen, onClose }) => {
  const addAsset = useAssetStore((state) => state.addAsset);
  const [selectedType, setSelectedType] = useState<AssetType>("IMAGE");
  const [filename, setFilename] = useState("");
  const [projectTitle, setProjectTitle] = useState("Demo Project");
  const filenameId = useId();
  const projectId = useId();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const now = Date.now();
    const asset: MediaAsset = {
      id: `ast-${now}`,
      filename: filename.trim() || `demo_${selectedType.toLowerCase()}_${now}.png`,
      type: selectedType,
      status: "APPROVED",
      thumbnailUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop",
      fileSize: "3.5 MB",
      dimensions: selectedType === "AUDIO" ? undefined : "1920 × 1080",
      audioSampleRate: selectedType === "AUDIO" ? "44.1 kHz • WAV" : undefined,
      createdAt: "Vừa xong",
      provider: "Demo Upload",
      projectTitle,
      aspectRatio: "16:9",
      quality: "High",
      usedIn: [],
    };
    addAsset(asset);
    setFilename("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Upload tài sản demo" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-5 p-6">
        <div><h2 className="text-lg font-bold text-white">Upload tài sản demo</h2><p className="mt-1 text-xs text-slate-400">Chỉ dùng trong mock runtime. API mode không hiển thị modal này.</p></div>
        <div className="space-y-1.5"><label htmlFor={filenameId} className="text-xs font-semibold text-slate-300">Tên file</label><Input id={filenameId} value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="asset.png" /></div>
        <fieldset className="space-y-2"><legend className="text-xs font-semibold text-slate-300">Loại tài sản</legend><div className="grid grid-cols-3 gap-2" role="radiogroup">{(["IMAGE", "VIDEO", "AUDIO", "REFERENCE", "MOTION", "FINAL_OUTPUT"] as AssetType[]).map((type) => <button key={type} type="button" role="radio" aria-checked={selectedType === type} onClick={() => setSelectedType(type)} className={`rounded-lg border p-2 text-xs ${selectedType === type ? "border-purple-500 bg-purple-950/80 text-white" : "border-slate-800 bg-surface-panel text-slate-400"}`}>{type}</button>)}</div></fieldset>
        <div className="space-y-1.5"><label htmlFor={projectId} className="text-xs font-semibold text-slate-300">Dự án demo</label><Input id={projectId} value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} /></div>
        <div className="flex justify-end gap-2 border-t border-slate-800 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Hủy</Button><Button type="submit" variant="primary">Thêm tài sản demo</Button></div>
      </form>
    </Modal>
  );
};
