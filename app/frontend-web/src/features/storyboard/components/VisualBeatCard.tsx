import { ImageIcon } from "lucide-react";
import type {
  ApiStoryboardVisualBeat,
  CameraMovement,
  MotionMode,
  VisualBeatReviewStatus,
} from "../api/storyboard.api";

interface VisualBeatCardProps {
  beat: ApiStoryboardVisualBeat;
  updating: boolean;
  onReview: (status: VisualBeatReviewStatus) => void;
}

export function VisualBeatCard({
  beat,
  updating,
  onReview,
}: Readonly<VisualBeatCardProps>) {
  const approved = beat.reviewStatus === "APPROVED";

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-dark bg-surface-card shadow-lg transition-transform duration-200 hover:-translate-y-0.5 hover:border-purple-500/60 hover:shadow-purple-950/30">
      {/* Visual Image / Frame Area */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-b from-slate-800/80 via-surface-dark to-black">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-slate-600">
          <ImageIcon className="h-8 w-8 text-slate-600 transition-colors group-hover:text-purple-400" />
          <span className="text-center text-[10px] text-slate-500">Visual frame render</span>
        </div>

        {/* Top Badges & Actions */}
        <div className="absolute inset-x-2.5 top-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MotionBadge mode={beat.motionMode} movement={beat.cameraMovement} />
          </div>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-slate-300 backdrop-blur-md transition-colors hover:bg-black/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            title="Đổi góc quay / action"
            aria-label="Đổi góc quay / action"
          >
            ⤢
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <p className="text-xs font-semibold text-slate-400">Beat {beat.orderIndex + 1}</p>
          <h4 className="mt-1 line-clamp-2 min-h-10 text-xs font-bold uppercase leading-5 text-slate-100">
            {beat.title}
          </h4>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${
              approved
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-400"
                : "border-amber-500/40 bg-amber-950/40 text-amber-400"
            }`}
          >
            {approved ? "APPROVED" : "NEEDS REVIEW"}
          </span>
          <button
            type="button"
            disabled={updating}
            onClick={() => onReview(approved ? "NEEDS_REVIEW" : "APPROVED")}
            className="rounded-md px-2 py-1 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-40"
          >
            {updating ? "…" : approved ? "Review lại" : "Duyệt"}
          </button>
        </div>
      </div>
    </article>
  );
}

function MotionBadge({ mode, movement }: Readonly<{ mode: MotionMode; movement: CameraMovement }>) {
  const label = movement === "NONE" ? mode : `${mode} · ${movement}`;
  return (
    <span
      className="rounded-md bg-black/65 px-2 py-1 text-[9px] font-semibold tracking-wide text-slate-300 backdrop-blur-md"
      title={`Render: ${mode}; camera: ${movement}`}
    >
      {label}
    </span>
  );
}
