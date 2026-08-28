import { Clapperboard } from "lucide-react";

export function StoryboardHeader({
  sceneCount,
  beatCount,
  approvedCount,
}: Readonly<{
  sceneCount: number;
  beatCount: number;
  approvedCount: number;
}>) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface-panel px-6 py-4">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
          <Clapperboard size={13} />
          Storyboard Workspace
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight">Scene & Visual Beat Manager</h1>
        <p className="mt-1 text-xs text-text-secondary">
          Quản lý visual beat, tự động generate ảnh bằng Gemini Web và gắn output về đúng beat.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Metric label="Scenes" value={sceneCount} />
        <Metric label="Visual Beats" value={beatCount} />
        <Metric label="Approved" value={approvedCount} />
      </div>
    </header>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="min-w-[78px] rounded-md border border-border bg-surface px-3 py-2 text-center">
      <div className="text-sm font-bold text-foreground">{value}</div>
      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  );
}
