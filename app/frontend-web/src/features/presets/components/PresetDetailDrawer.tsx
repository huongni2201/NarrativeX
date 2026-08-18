import React, { useState } from "react";
import type { StylePreset } from "@/types/presets";
import { Button } from "@/components/ui/Button";
import { Copy, Edit3, Trash2, X } from "lucide-react";

interface PresetDetailDrawerProps {
  preset: StylePreset | null;
  onClose: () => void;
  onEdit: (preset: StylePreset) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export const PresetDetailDrawer: React.FC<PresetDetailDrawerProps> = ({ preset, onClose, onEdit, onDuplicate, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!preset) return null;

  return (
    <aside aria-label={`Chi tiết preset ${preset.name}`} className="flex h-full w-full shrink-0 flex-col overflow-y-auto border-l border-slate-800 bg-[#0d1420] shadow-2xl lg:w-[380px] xl:w-[420px]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-[#0d1420]/95 p-4 backdrop-blur-md">
        <h3 className="truncate text-sm font-bold text-white">{preset.name}</h3>
        <div className="flex items-center gap-1"><Button type="button" onClick={() => onEdit(preset)} variant="secondary" size="sm" leftIcon={<Edit3 className="mr-1 h-3 w-3" />}>Sửa</Button><button type="button" onClick={onClose} aria-label="Đóng chi tiết preset" className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button></div>
      </header>
      <div className="flex-1 space-y-5 p-5 text-xs">
        <p className="rounded-xl border border-slate-800 bg-[#090e18] p-3.5 leading-relaxed text-slate-300">{preset.description}</p>
        <div><h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Màu sắc chủ đạo</h4><div className="mt-2 flex gap-2">{(preset.colorPalette ?? ["#070B14", "#7C3AED"]).map((color) => <span key={color} title={color} className="h-7 w-7 rounded-lg border border-white/20" style={{ backgroundColor: color }} />)}</div></div>
        <dl className="space-y-2 rounded-xl border border-slate-800 bg-[#090e18] p-3.5"><div className="flex justify-between gap-3"><dt className="text-slate-500">Ánh sáng</dt><dd className="text-right text-slate-200">{preset.lighting ?? "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Camera</dt><dd className="text-right text-slate-200">{preset.cameraStyle ?? "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Tỷ lệ</dt><dd className="font-mono text-purple-300">{preset.defaultAspectRatio ?? "16:9"}</dd></div></dl>
      </div>
      <footer className="sticky bottom-0 space-y-2 border-t border-slate-800 bg-[#090e18] p-4">
        {confirmDelete ? <div className="space-y-2"><p className="text-center text-xs text-rose-200">Xóa preset này?</p><div className="grid grid-cols-2 gap-2"><Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>Hủy</Button><Button variant="danger" size="sm" onClick={() => { onDelete(preset.id); setConfirmDelete(false); }}>Xóa</Button></div></div> : <div className="grid grid-cols-2 gap-2"><Button variant="secondary" size="sm" onClick={() => onDuplicate(preset.id)} leftIcon={<Copy className="mr-1 h-3.5 w-3.5" />}>Nhân bản</Button><Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} leftIcon={<Trash2 className="mr-1 h-3.5 w-3.5" />}>Xóa</Button></div>}
      </footer>
    </aside>
  );
};
