import { Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface JobStatusIndicatorProps {
  projectId: string;
  activeCount?: number;
}

export function JobStatusIndicator({ projectId, activeCount = 0 }: JobStatusIndicatorProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${projectId}/jobs`)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-all hover:brightness-110 focus-visible:ring-1 focus-visible:ring-primary ${
        activeCount > 0
          ? "border-primary/40 bg-primary-muted text-primary"
          : "border-border-subtle bg-surface-2 text-text-secondary hover:text-foreground"
      }`}
      title="Bấm để xem danh sách tác vụ nền (Jobs dashboard)"
      aria-label={`Tác vụ nền: ${activeCount > 0 ? `${activeCount} đang xử lý` : "Hoàn thành"}`}
    >
      <Activity size={13} className={activeCount > 0 ? "animate-pulse text-primary" : "text-text-muted"} />
      <span>{activeCount > 0 ? `${activeCount} Jobs` : "Jobs"}</span>
    </button>
  );
}
