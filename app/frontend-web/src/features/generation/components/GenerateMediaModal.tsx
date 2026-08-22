"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { CreateMediaJobInput } from "../api/media.api";

interface GenerateMediaModalProps {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: CreateMediaJobInput) => void;
}

export function GenerateMediaModal({ open, pending, onClose, onSubmit }: Readonly<GenerateMediaModalProps>) {
  const [aspectRatio, setAspectRatio] = useState<CreateMediaJobInput["aspectRatio"]>("16:9");
  const [qualityTier, setQualityTier] = useState<CreateMediaJobInput["qualityTier"]>("STANDARD");
  const [maxAuthorizedCost, setMaxAuthorizedCost] = useState("1.500000");
  return (
    <Modal isOpen={open} onClose={onClose} closeDisabled={pending} title="Tạo keyframe cho Chapter" subtitle="IMAGE_MOTION tạo ảnh để bạn duyệt trước khi render video." maxWidth="md">
      <form className="space-y-5 p-6" onSubmit={(event) => { event.preventDefault(); onSubmit({ productionMode: "IMAGE_MOTION", aspectRatio, qualityTier, maxAuthorizedCost }); }}>
        <label className="block text-sm text-slate-300">Tỉ lệ khung hình<select className="mt-2 w-full rounded-lg border border-border-dark bg-surface-panel px-3 py-2 text-slate-100" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as CreateMediaJobInput["aspectRatio"])}><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="3:4">3:4</option></select></label>
        <label className="block text-sm text-slate-300">Chất lượng<select className="mt-2 w-full rounded-lg border border-border-dark bg-surface-panel px-3 py-2 text-slate-100" value={qualityTier} onChange={(event) => setQualityTier(event.target.value as CreateMediaJobInput["qualityTier"])}><option value="DRAFT">Draft</option><option value="STANDARD">Standard</option><option value="HIGH">High</option></select></label>
        <label className="block text-sm text-slate-300">Ngân sách tối đa (USD)<input className="mt-2 w-full rounded-lg border border-border-dark bg-surface-panel px-3 py-2 text-slate-100" inputMode="decimal" min="0.000001" step="0.000001" value={maxAuthorizedCost} onChange={(event) => setMaxAuthorizedCost(event.target.value)} /></label>
        <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Hủy</Button><Button type="submit" isLoading={pending} disabled={Number(maxAuthorizedCost) <= 0}>{pending ? "Đang xếp hàng…" : "Tạo keyframe"}</Button></div>
      </form>
    </Modal>
  );
}
