import React from "react";
import type { ChapterStatus } from "@/types/domain";
import { Eye, FileText, Loader2, Sparkles } from "lucide-react";

interface ChapterStatusBadgeProps {
  status: ChapterStatus;
  className?: string;
}

export const ChapterStatusBadge: React.FC<ChapterStatusBadgeProps> = ({ status, className }) => {
  const base = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className ?? ""}`;
  if (status === "RENDERED") return <span className={`${base} border-badge-green-border bg-badge-green-bg text-badge-green`}>Rendered</span>;
  if (status === "VISUAL_READY") return <span className={`${base} border-badge-blue-border bg-badge-blue-bg text-badge-blue`}>Visual Ready</span>;
  if (status === "VISUAL_REVIEW") return <span className={`${base} border-badge-amber-border bg-badge-amber-bg text-badge-amber`}><Eye className="h-3 w-3" />Visual Review</span>;
  if (status === "GENERATING_VISUALS") return <span className={`${base} border-badge-purple-border bg-badge-purple-bg text-badge-purple`}><Loader2 className="h-3 w-3 motion-safe:animate-spin" />Đang xử lý</span>;
  if (status === "ANALYZED") return <span className={`${base} border-badge-blue-border bg-badge-blue-bg text-badge-blue`}><Sparkles className="h-3 w-3" />Analyzed</span>;
  if (status === "DRAFT") return <span className={`${base} border-badge-slate-border bg-badge-slate-bg text-badge-slate`}><FileText className="h-3 w-3" />Draft</span>;
  return <span className="text-xs font-medium text-badge-slate">Chưa nhập nội dung</span>;
};
