"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { apiErrorMessage } from "@/shared/api/client";
import { mediaApi } from "../api/media.api";
import type { CreateMediaJobInput, EstimateMediaJobInput } from "../api/media.api";
import type { ProjectId } from "@/types/api";

interface GenerateMediaModalProps {
  open: boolean;
  pending: boolean;
  projectId: ProjectId;
  chapterId: string | number;
  visualBeatCount: number;
  onClose: () => void;
  onSubmit: (input: CreateMediaJobInput) => void;
}

export function GenerateMediaModal({
  open,
  pending,
  projectId,
  chapterId,
  visualBeatCount,
  onClose,
  onSubmit,
}: Readonly<GenerateMediaModalProps>) {
  const [aspectRatio, setAspectRatio] = useState<CreateMediaJobInput["aspectRatio"]>("16:9");
  const [qualityTier, setQualityTier] = useState<CreateMediaJobInput["qualityTier"]>("STANDARD");
  const [imageStyle, setImageStyle] = useState<CreateMediaJobInput["imageStyle"]>("CINEMATIC");
  const [maxAuthorizedCost, setMaxAuthorizedCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const estimateInput: EstimateMediaJobInput = {
    productionMode: "IMAGE_MOTION",
    aspectRatio,
    qualityTier,
    imageStyle,
  };
  const estimateQuery = useQuery({
    queryKey: ["media-cost-estimate", projectId, chapterId, estimateInput],
    queryFn: () => mediaApi.estimate(projectId, chapterId, estimateInput),
    enabled: open && visualBeatCount > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open || !estimateQuery.data) return;
    setMaxAuthorizedCost(estimateQuery.data.estimatedCost);
    setError(null);
  }, [open, estimateQuery.data]);

  const estimatedCost = estimateQuery.data?.estimatedCost;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!estimatedCost) {
      setError("Chưa lấy được dự toán từ backend. Hãy thử lại sau giây lát.");
      return;
    }
    if (!Number.isFinite(Number(maxAuthorizedCost)) || Number(maxAuthorizedCost) < Number(estimatedCost)) {
      setError(`Ngân sách tối thiểu cho ${visualBeatCount} cảnh là $${Number(estimatedCost).toFixed(2)}.`);
      return;
    }
    setError(null);
    onSubmit({ ...estimateInput, maxAuthorizedCost });
  };
  return (
    <Modal isOpen={open} onClose={onClose} closeDisabled={pending} title="Tạo keyframe cho Chapter" subtitle="IMAGE_MOTION tạo ảnh để bạn duyệt trước khi render video." maxWidth="md">
      <form className="space-y-5 p-6" onSubmit={submit}>
        <label className="block text-sm text-slate-300">Tỉ lệ khung hình<select className="mt-2 w-full rounded-lg border border-border-dark bg-surface-panel px-3 py-2 text-slate-100" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as CreateMediaJobInput["aspectRatio"])}><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="3:4">3:4</option></select></label>
        <label className="block text-sm text-slate-300">Chất lượng<select className="mt-2 w-full rounded-lg border border-border-dark bg-surface-panel px-3 py-2 text-slate-100" value={qualityTier} onChange={(event) => setQualityTier(event.target.value as CreateMediaJobInput["qualityTier"])}><option value="DRAFT">Draft</option><option value="STANDARD">Standard</option><option value="HIGH">High</option></select></label>
        <label className="block text-sm text-slate-300">Phong cách hình ảnh<select className="mt-2 w-full rounded-lg border border-border-dark bg-surface-panel px-3 py-2 text-slate-100" value={imageStyle} onChange={(event) => setImageStyle(event.target.value as CreateMediaJobInput["imageStyle"])}><option value="CINEMATIC">Điện ảnh (Cinematic)</option><option value="STORYBOOK_WATERCOLOR">Truyện minh họa màu nước</option></select><span className="mt-1 block text-xs text-slate-500">Phong cách được khóa vào toàn bộ keyframe của lần tạo này.</span></label>
        <label className="block text-sm text-slate-300">Ngân sách tối đa (USD)<input className="mt-2 w-full rounded-lg border border-border-dark bg-surface-panel px-3 py-2 text-slate-100" inputMode="decimal" min="0.000001" step="0.000001" value={maxAuthorizedCost} onChange={(event) => { setMaxAuthorizedCost(event.target.value); setError(null); }} disabled={estimateQuery.isPending || !estimatedCost} /></label>
        <p className="text-xs text-slate-400">
          {estimateQuery.isPending
            ? "Đang lấy dự toán từ backend…"
            : estimateQuery.isError
              ? apiErrorMessage(estimateQuery.error, "Không thể lấy dự toán.")
              : estimatedCost
                ? `Dự toán ${estimateQuery.data?.visualBeatCount ?? visualBeatCount} cảnh: $${Number(estimatedCost).toFixed(2)} ${estimateQuery.data?.currency ?? "USD"}. Bạn có thể đặt cap cao hơn.`
                : "Chưa có dự toán cho Chapter này."}
        </p>
        {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
        <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Hủy</Button><Button type="submit" isLoading={pending} disabled={pending || estimateQuery.isPending || !estimatedCost}>{pending ? "Đang xếp hàng…" : "Tạo keyframe"}</Button></div>
      </form>
    </Modal>
  );
}
