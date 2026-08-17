import React, { useState } from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { VisualStatusBadge } from "@/components/production/VisualStatusBadge";
import { BatchReviewToolbar } from "@/components/production/BatchReviewToolbar";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Square,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const VisualReview: React.FC = () => {
  const {
    project,
    activeChapterId,
    visualBeats,
    selectedVisualBeatIds,
    toggleSelectVisualBeat,
    selectAllVisualBeats,
    clearSelectedVisualBeats,
    batchUpdateVisualBeatsStatus,
    activeReviewTab,
    setActiveReviewTab,
    setView,
  } = useProductionStore();

  if (!project) return null;

  const chapter =
    project.chapters.find((c) => c.id === activeChapterId) ||
    project.chapters.find((c) => c.number === "06") ||
    project.chapters[0];

  const approvedCount = visualBeats.filter((b) => b.status === "APPROVED").length;
  const needsReviewCount = visualBeats.filter((b) => b.status === "NEEDS_REVIEW").length;
  const rejectedCount = visualBeats.filter((b) => b.status === "REJECTED").length;

  const filteredBeats = visualBeats.filter((b) => {
    if (activeReviewTab === "approved") return b.status === "APPROVED";
    if (activeReviewTab === "needs_review") return b.status === "NEEDS_REVIEW";
    if (activeReviewTab === "rejected") return b.status === "REJECTED";
    return true;
  });

  const isAllSelected =
    filteredBeats.length > 0 &&
    filteredBeats.every((b) => selectedVisualBeatIds.includes(b.id));

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      clearSelectedVisualBeats();
    } else {
      selectAllVisualBeats();
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
        <button
          onClick={() => setView("workspace")}
          className="hover:text-purple-400 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Chapter Workspace</span>
        </button>
        <span>/</span>
        <button
          onClick={() => setView("overview")}
          className="hover:text-slate-200 transition-colors"
        >
          {project.title}
        </button>
        <span>/</span>
        <span className="text-purple-300 font-semibold truncate">
          Visual Review (Batch Review) – Chapter {chapter.number}
        </span>
      </div>

      {/* Top Filter and Status Header matching Screen 05 */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#0d1420] border border-slate-800/90 shadow-md">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tất cả */}
          <button
            onClick={() => setActiveReviewTab("all")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-2",
              activeReviewTab === "all"
                ? "bg-purple-600 text-white border-purple-500 shadow-[0_0_12px_rgba(124,58,237,0.4)]"
                : "bg-[#090e18] text-slate-400 border-slate-800 hover:text-slate-200"
            )}
          >
            <span>Tất cả ({visualBeats.length})</span>
          </button>

          {/* Approved */}
          <button
            onClick={() => setActiveReviewTab("approved")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-2",
              activeReviewTab === "approved"
                ? "bg-emerald-950/90 text-emerald-300 border-emerald-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                : "bg-[#090e18] text-emerald-400/80 border-slate-800 hover:text-emerald-300"
            )}
          >
            <span>Approved ({approvedCount})</span>
          </button>

          {/* Needs Review */}
          <button
            onClick={() => setActiveReviewTab("needs_review")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-2",
              activeReviewTab === "needs_review"
                ? "bg-amber-950/90 text-amber-300 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                : "bg-[#090e18] text-amber-400/80 border-slate-800 hover:text-amber-300"
            )}
          >
            <span>Needs Review ({needsReviewCount})</span>
          </button>

          {/* Rejected */}
          <button
            onClick={() => setActiveReviewTab("rejected")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-2",
              activeReviewTab === "rejected"
                ? "bg-rose-950/90 text-rose-300 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                : "bg-[#090e18] text-rose-400/80 border-slate-800 hover:text-rose-300"
            )}
          >
            <span>Rejected ({rejectedCount})</span>
          </button>
        </div>

        {/* Select all & Filter Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSelectAllToggle}
            className="px-3 py-1.5 rounded-lg bg-[#090e18] hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-2 transition-colors"
          >
            {isAllSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}</span>
          </button>

          <button
            type="button"
            className="px-3.5 py-1.5 rounded-lg bg-[#090e18] hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Bộ lọc</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 8 Dense Visual Review Cards matching Screen 05 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5">
        {filteredBeats.map((beat) => {
          const isSelected = selectedVisualBeatIds.includes(beat.id);

          return (
            <div
              key={beat.id}
              onClick={() => toggleSelectVisualBeat(beat.id)}
              className={cn(
                "group relative bg-[#0d1420] rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border flex flex-col justify-between shadow-lg select-none",
                isSelected
                  ? "border-purple-500 ring-2 ring-purple-500/50 shadow-[0_0_20px_rgba(124,58,237,0.35)] scale-[1.01]"
                  : "border-slate-800/90 hover:border-slate-700 hover:bg-[#111a29]"
              )}
            >
              {/* Image Box */}
              <div className="aspect-[3/4] w-full overflow-hidden bg-slate-950 relative">
                <img
                  src={beat.imageUrl}
                  alt={beat.description}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1420] via-transparent to-black/30" />

                {/* Top Corner Checkbox & Number */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                      isSelected
                        ? "bg-purple-600 border-purple-400 text-white shadow-[0_0_8px_rgba(124,58,237,0.8)]"
                        : "bg-black/60 border-white/20 text-transparent hover:border-purple-400"
                    )}
                  >
                    <Check className="w-3 h-3 text-white" />
                  </div>

                  <span className="w-6 h-6 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-mono font-bold text-white flex items-center justify-center border border-white/10">
                    {beat.number}
                  </span>
                </div>

                {/* Status Badge Overlay at Bottom of Image */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 text-center">
                  <VisualStatusBadge status={beat.status} size="sm" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Batch Review Toolbar matching Screen 05 */}
      <BatchReviewToolbar
        selectedCount={selectedVisualBeatIds.length}
        totalCount={visualBeats.length}
        onApprove={() => batchUpdateVisualBeatsStatus("APPROVED")}
        onRequestChanges={() => batchUpdateVisualBeatsStatus("NEEDS_REVIEW")}
        onReject={() => batchUpdateVisualBeatsStatus("REJECTED")}
        onClear={clearSelectedVisualBeats}
      />
    </div>
  );
};
