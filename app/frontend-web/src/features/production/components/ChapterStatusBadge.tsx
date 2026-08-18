import React from "react";
import type { ChapterStatus } from "@/types/domain";
import { Eye, FileText, Loader2, Sparkles } from "lucide-react";

interface ChapterStatusBadgeProps {
  status: ChapterStatus;
  className?: string;
}

export const ChapterStatusBadge: React.FC<ChapterStatusBadgeProps> = ({ status, className }) => {
  const base = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className ?? ""}`;
  if (status === "RENDERED") return <span className={`${base} border-emerald-800/60 bg-emerald-950/80 text-emerald-300`}>Rendered</span>;
  if (status === "VISUAL_READY") return <span className={`${base} border-cyan-800/60 bg-cyan-950/80 text-cyan-300`}>Visual Ready</span>;
  if (status === "VISUAL_REVIEW") return <span className={`${base} border-purple-800/60 bg-purple-950/80 text-purple-300`}><Eye className="h-3 w-3" />Visual Review</span>;
  if (status === "GENERATING_VISUALS") return <span className={`${base} border-indigo-800/60 bg-indigo-950/80 text-indigo-300`}><Loader2 className="h-3 w-3 motion-safe:animate-spin" />Đang xử lý</span>;
  if (status === "ANALYZED") return <span className={`${base} border-blue-800/60 bg-blue-950/80 text-blue-300`}><Sparkles className="h-3 w-3" />Analyzed</span>;
  if (status === "DRAFT") return <span className={`${base} border-amber-800/60 bg-amber-950/80 text-amber-300`}><FileText className="h-3 w-3" />Draft</span>;
  return <span className="text-xs font-medium text-slate-500">Chưa nhập nội dung</span>;
};
