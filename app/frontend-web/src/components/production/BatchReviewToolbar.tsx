import React from "react";
import { Button } from "@/components/ui/Button";
import { Check, Edit3, X, Sparkles } from "lucide-react";

interface BatchReviewToolbarProps {
  selectedCount: number;
  totalCount: number;
  onApprove: () => void;
  onRequestChanges: () => void;
  onReject: () => void;
  onClear: () => void;
}

export const BatchReviewToolbar: React.FC<BatchReviewToolbarProps> = ({
  selectedCount,
  totalCount,
  onApprove,
  onRequestChanges,
  onReject,
  onClear,
}) => {
  if (selectedCount === 0) return null;

  return (
    <aside aria-label="Batch Review Actions" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0d1420]/95 backdrop-blur-xl border border-purple-500/50 rounded-2xl px-6 py-3 shadow-[0_0_40px_rgba(0,0,0,0.8)] flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-200 max-w-[90vw]">
      {/* Selection counter */}
      <div className="flex items-center gap-3 pr-4 border-r border-slate-700">
        <div className="w-6 h-6 rounded-full bg-purple-600/30 border border-purple-500/60 flex items-center justify-center text-xs font-bold text-purple-300">
          {selectedCount}
        </div>
        <span className="text-xs font-medium text-slate-300 whitespace-nowrap">
          Đã chọn <strong className="text-white font-mono">{selectedCount}</strong> / {totalCount}
        </span>
      </div>

      {/* Action Buttons matching Screen 05 */}
      <div className="flex items-center gap-2.5">
        <Button
          onClick={onApprove}
          variant="primary"
          size="sm"
          className="shadow-[0_0_15px_rgba(124,58,237,0.4)]"
          leftIcon={<Check className="w-3.5 h-3.5 mr-1" />}
        >
          Approve đã chọn
        </Button>

        <button
          type="button"
          onClick={onRequestChanges}
          className="px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900/80 text-amber-300 border border-amber-600/60 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Request changes</span>
        </button>

        <Button
          onClick={onReject}
          variant="danger"
          size="sm"
          leftIcon={<X className="w-3.5 h-3.5 mr-1" />}
        >
          Reject đã chọn
        </Button>

        <button
          onClick={onClear}
          title="Bỏ chọn tất cả"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
