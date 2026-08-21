/* eslint-disable @next/next/no-img-element -- Asset URLs may use environment-specific Cloudflare R2/CDN hosts. */
import React, { useState } from "react";
import type { MediaAsset } from "@/types/assets";
import { Button } from "@/components/ui/Button";
import { Image as ImageIcon, Lock, Trash2, Unlock, X } from "lucide-react";
import { AssetStatusBadge } from "./AssetStatusBadge";
import { AssetTypeBadge } from "./AssetTypeBadge";

interface AssetDetailDrawerProps {
  asset: MediaAsset | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onToggleLock?: (id: string) => void;
}

export const AssetDetailDrawer: React.FC<AssetDetailDrawerProps> = ({ asset, onClose, onDelete, onApprove, onReject: _onReject, onToggleLock }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!asset) return null;

  return (
    <aside aria-label={`Chi tiết tài sản ${asset.filename}`} className="flex h-full w-full shrink-0 flex-col overflow-y-auto border-l border-slate-800 bg-surface shadow-2xl lg:w-[380px] xl:w-[420px]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-surface/95 p-4 backdrop-blur-md">
        <h3 className="max-w-[300px] truncate font-mono text-xs font-bold text-slate-100">{asset.filename}</h3>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết tài sản" className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"><X className="h-4 w-4" /></button>
      </header>
      <div className="flex-1 space-y-5 p-5">
        {asset.type !== "AUDIO" && (asset.thumbnailUrl ? <img src={asset.thumbnailUrl} alt={asset.filename} className="aspect-[16/10] w-full rounded-xl object-cover" /> : <div className="flex aspect-[16/10] w-full items-center justify-center rounded-xl bg-surface-panel text-text-muted"><ImageIcon className="h-10 w-10" aria-hidden="true" /><span className="sr-only">Chưa có thumbnail</span></div>)}
        <div className="flex items-center justify-between"><AssetTypeBadge type={asset.type} showIcon /><AssetStatusBadge status={asset.status} progressPercent={asset.progressPercent} /></div>
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-surface-panel p-4 text-xs">
          <div><dt className="text-slate-500">Dự án</dt><dd className="mt-1 text-slate-200">{asset.projectTitle}</dd></div>
          <div><dt className="text-slate-500">Dung lượng</dt><dd className="mt-1 text-slate-200">{asset.fileSize}</dd></div>
          <div><dt className="text-slate-500">Tỷ lệ</dt><dd className="mt-1 text-slate-200">{asset.aspectRatio ?? "—"}</dd></div>
          <div><dt className="text-slate-500">Ngày tạo</dt><dd className="mt-1 text-slate-200">{asset.createdAt}</dd></div>
        </dl>
        {asset.prompt && <div><h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Prompt AI</h4><p className="mt-2 rounded-xl border border-slate-800 bg-surface-panel p-3 font-mono text-[11px] leading-5 text-slate-300">{asset.prompt}</p></div>}
      </div>
      <footer className="sticky bottom-0 space-y-2 border-t border-slate-800 bg-surface-panel p-4">
        {confirmDelete ? <div className="space-y-2 rounded-xl border border-rose-800/80 bg-rose-950/50 p-3"><p className="text-center text-xs text-rose-200">Xóa tài sản này?</p><div className="grid grid-cols-2 gap-2"><Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Hủy</Button><Button variant="danger" size="sm" onClick={() => { onDelete(asset.id); setConfirmDelete(false); }}>Xóa</Button></div></div> : <div className="grid grid-cols-2 gap-2">{onToggleLock && <Button variant="secondary" size="sm" onClick={() => onToggleLock(asset.id)} leftIcon={asset.status === "LOCKED" ? <Unlock className="mr-1 h-3.5 w-3.5" /> : <Lock className="mr-1 h-3.5 w-3.5" />}>{asset.status === "LOCKED" ? "Mở khóa" : "Khóa"}</Button>}{onApprove && <Button variant="primary" size="sm" onClick={() => onApprove(asset.id)}>Approve</Button>}<Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} leftIcon={<Trash2 className="mr-1 h-3.5 w-3.5" />}>Xóa</Button></div>}
      </footer>
    </aside>
  );
};
