import { Clapperboard } from "lucide-react";
import { MetricStrip } from "../../workspace/components/WorkstationPrimitives";

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
    <header className="flex min-h-12 shrink-0 items-center justify-between gap-4 border-b border-border-subtle bg-surface-dark px-4 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <Clapperboard size={14} className="shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold tracking-tight text-foreground">Storyboard</div>
          <div className="text-[10px] text-text-dim">Scene & Visual Beat review workspace</div>
        </div>
      </div>
      <MetricStrip
        items={[
          { label: "scenes", value: sceneCount },
          { label: "beats", value: beatCount },
          { label: "approved", value: approvedCount },
        ]}
        className="justify-end"
      />
    </header>
  );
}
