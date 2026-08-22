import React, { useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAssetStore } from "@/store/useAssetStore";
import type { AssetType, MediaAsset } from "@/types/assets";
import { isMockDataMode } from "@/lib/data-mode";
import { apiErrorMessage } from "@/shared/api/client";
import { assetsApi } from "../api/assets.api";

interface AssetUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded?: () => void;
}

const apiAssetTypes: Array<Extract<AssetType, "AUDIO" | "IMAGE" | "VIDEO">> = ["IMAGE", "VIDEO", "AUDIO"];
type ApiAssetType = (typeof apiAssetTypes)[number];

const supportedContentTypesByAssetType: Record<ApiAssetType, ReadonlySet<string>> = {
  AUDIO: new Set(["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/webm"]),
  IMAGE: new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  VIDEO: new Set(["video/mp4", "video/webm", "video/quicktime"]),
};

const supportedUploadContentTypes = Object.values(supportedContentTypesByAssetType)
  .flatMap((contentTypes) => [...contentTypes])
  .join(",");

function assetTypeForContentType(contentType: string): ApiAssetType | null {
  return apiAssetTypes.find((assetType) => supportedContentTypesByAssetType[assetType].has(contentType)) ?? null;
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const AssetUploadModal: React.FC<AssetUploadModalProps> = ({ isOpen, onClose, onUploaded }) => {
  const addAsset = useAssetStore((state) => state.addAsset);
  const [selectedType, setSelectedType] = useState<AssetType>("IMAGE");
  const [filename, setFilename] = useState("");
  const [projectTitle, setProjectTitle] = useState("Demo Project");
  const [file, setFile] = useState<File | null>(null);
  const [uploadIdempotencyKey, setUploadIdempotencyKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filenameId = useId();
  const projectId = useId();
  const fileId = useId();

  const resetForm = () => {
    setFilename("");
    setFile(null);
    setUploadIdempotencyKey(null);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isMockDataMode) {
      if (!file || !apiAssetTypes.includes(selectedType as Extract<AssetType, "AUDIO" | "IMAGE" | "VIDEO">)) {
        setError("Hãy chọn một file media hợp lệ.");
        return;
      }

      const contentType = file.type.trim().toLowerCase();
      const detectedType = assetTypeForContentType(contentType);
      if (!detectedType) {
        setError("Định dạng file không được hỗ trợ. Hãy chọn MP3/WAV/OGG, JPG/PNG/WEBP/GIF hoặc MP4/WEBM/MOV.");
        return;
      }
      if (detectedType !== selectedType) {
        setError(`Loại tài sản không khớp với file. Hãy chọn ${detectedType}.`);
        setSelectedType(detectedType);
        return;
      }

      setIsSubmitting(true);
      try {
        const expectedSha256 = await sha256(file);
        const intent = await assetsApi.createUploadIntent({
          type: selectedType as Extract<AssetType, "AUDIO" | "IMAGE" | "VIDEO">,
          originalFilename: file.name,
          contentType,
          expectedSizeBytes: file.size,
          expectedSha256,
        }, uploadIdempotencyKey ?? crypto.randomUUID());
        const uploadResponse = await fetch(intent.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
            ...intent.uploadHeaders,
          },
          body: file,
          credentials: "omit",
        });
        if (!uploadResponse.ok) throw new Error(`Upload object thất bại (${uploadResponse.status}).`);

        const finalized = await assetsApi.finalizeUpload(intent.id);
        if (finalized.status !== "READY") throw new Error("Backend từ chối media upload sau khi verify.");
        onUploaded?.();
        resetForm();
        onClose();
      } catch (uploadError) {
        setError(apiErrorMessage(uploadError, "Không thể upload tài sản."));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

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
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel={isMockDataMode ? "Upload tài sản demo" : "Upload tài sản"} maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-5 p-6">
        <div>
          <h2 className="text-lg font-bold text-text-primary">{isMockDataMode ? "Upload tài sản demo" : "Upload tài sản"}</h2>
          <p className="mt-1 text-xs text-text-secondary">{isMockDataMode ? "Chỉ dùng trong mock runtime." : "File sẽ được upload trực tiếp lên object storage và backend sẽ verify trước khi READY."}</p>
        </div>
        {isMockDataMode ? (
          <div className="space-y-1.5"><label htmlFor={filenameId} className="text-xs font-semibold text-text-secondary">Tên file</label><Input id={filenameId} value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="asset.png" /></div>
        ) : (
          <div className="space-y-1.5"><label htmlFor={fileId} className="text-xs font-semibold text-text-secondary">File media</label><input id={fileId} type="file" accept={supportedUploadContentTypes} required onChange={(event) => { const nextFile = event.target.files?.[0] ?? null; setFile(nextFile); setUploadIdempotencyKey(crypto.randomUUID()); const detectedType = nextFile ? assetTypeForContentType(nextFile.type.trim().toLowerCase()) : null; if (detectedType) setSelectedType(detectedType); }} className="block w-full rounded-lg border border-border bg-surface-panel px-3 py-2 text-xs text-text-secondary file:mr-3 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white" /></div>
        )}
        <fieldset className="space-y-2"><legend className="text-xs font-semibold text-text-secondary">Loại tài sản</legend><div className="grid grid-cols-3 gap-2" role="radiogroup">{(isMockDataMode ? (["IMAGE", "VIDEO", "AUDIO", "REFERENCE", "MOTION", "FINAL_OUTPUT"] as AssetType[]) : apiAssetTypes).map((type) => <button key={type} type="button" role="radio" aria-checked={selectedType === type} onClick={() => setSelectedType(type)} className={`rounded-lg border p-2 text-xs ${selectedType === type ? "border-primary bg-primary-muted text-text-primary" : "border-border bg-surface-panel text-text-secondary"}`}>{type}</button>)}</div></fieldset>
        {isMockDataMode && <div className="space-y-1.5"><label htmlFor={projectId} className="text-xs font-semibold text-text-secondary">Dự án demo</label><Input id={projectId} value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} /></div>}
        {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger-bg/20 p-3 text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>Hủy</Button><Button type="submit" variant="primary" disabled={isSubmitting}>{isSubmitting ? "Đang upload…" : isMockDataMode ? "Thêm tài sản demo" : "Upload tài sản"}</Button></div>
      </form>
    </Modal>
  );
};
