import React from "react";
import { Button } from "@/components/ui/Button";
import { Check, Edit3, X } from "lucide-react";

interface BatchReviewToolbarProps {
  selectedCount: number;
  totalCount: number;
  onApprove: () => void;
  onRequestChanges: () => void;
  onReject: () => void;
  onClear: () => void;
}

export const BatchReviewToolbar: React.FC<BatchReviewToolbarProps> = ({ selectedCount, totalCount, onApprove, onRequestChanges, onReject, onClear }) => {
  if (selectedCount === 0) return null;

  return (
    <aside aria-label="Thao tác duyệt hàng loạt" className="fixed bottom-6 left-1/2 z-40 flex max-w-[90vw] -translate-x-1/2 items-center gap-6 rounded-2xl border border-purple-500/50 bg-[#0d1420]/95 px-6 py-3 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-xl motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200">
      <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-purple-500/60 bg-purple-600/30 text-xs font-bold text-purple-300">{selectedCount}</div>
        <span className="whitespace-nowrap text-xs font-medium text-slate-300">Đã chọn <strong className="font-mono text-white">{selectedCount}</strong> / {totalCount}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <Button onClick={onApprove} variant="primary" size="sm" leftIcon={<Check className="mr-1 h-3.5 w-3.5" />}>Approve đã chọn</Button>
        <button type="button" onClick={onRequestChanges} className="flex items-center gap-1.5 rounded-lg border border-amber-600/60 bg-amber-950/80 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/80"><Edit3 className="h-3.5 w-3.5" />Request changes</button>
        <Button onClick={onReject} variant="danger" size="sm" leftIcon={<X className="mr-1 h-3.5 w-3.5" />}>Reject đã chọn</Button>
        <button type="button" onClick={onClear} aria-label="Bỏ chọn tất cả" className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"><X className="h-4 w-4" /></button>
      </div>
    </aside>
  );
};
