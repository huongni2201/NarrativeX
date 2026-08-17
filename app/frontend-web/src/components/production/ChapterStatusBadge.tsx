import React from "react";
import { ChapterStatus } from "@/types/domain";
import { Badge } from "@/components/ui/Badge";
import { CheckCircle2, Clock, Eye, FileText, Loader2, Sparkles } from "lucide-react";

interface ChapterStatusBadgeProps {
  status: ChapterStatus;
  className?: string;
}

export const ChapterStatusBadge: React.FC<ChapterStatusBadgeProps> = ({
  status,
  className,
}) => {
  switch (status) {
    case "RENDERED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Rendered
        </span>
      );
    case "VISUAL_READY":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          Visual Ready
        </span>
      );
    case "VISUAL_REVIEW":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/60 shadow-[0_0_10px_rgba(124,58,237,0.2)]">
          <Eye className="w-3 h-3 text-purple-400" />
          Visual Review
        </span>
      );
    case "GENERATING_VISUALS":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 animate-pulse">
          <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
          Đang xử lý
        </span>
      );
    case "ANALYZED":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60">
          <Sparkles className="w-3 h-3 text-blue-400" />
          Analyzed
        </span>
      );
    case "DRAFT":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60">
          <FileText className="w-3 h-3 text-amber-400" />
          Draft
        </span>
      );
    case "EMPTY":
    default:
      return (
        <span className="text-xs text-slate-500 font-medium">
          Chưa nhập nội dung
        </span>
      );
  }
};
