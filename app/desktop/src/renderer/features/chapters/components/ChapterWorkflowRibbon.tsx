import { BookOpen, Clapperboard, FileText, WandSparkles } from "lucide-react";

const STEPS = [
  { label: "Story", icon: BookOpen, active: false },
  { label: "Chapter", icon: FileText, active: true },
  { label: "Scene", icon: Clapperboard, active: false },
  { label: "Visual Beat", icon: WandSparkles, active: false },
] as const;

export function ChapterWorkflowRibbon() {
  return (
    <div className="border-b border-border bg-surface-panel px-6 py-2.5">
      <div className="flex max-w-2xl items-center gap-3 text-xs text-text-muted">
        {STEPS.map(({ label, active }, index) => (
          <div key={label} className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-b-2 border-primary bg-transparent text-primary-hover"
                  : "text-text-muted"
              }`}
            >
              <span className={`size-1.5 rounded-full ${active ? "bg-primary" : "bg-text-dim"}`} />
              <span>{label}</span>
            </div>
            {index < STEPS.length - 1 && (
              <span aria-hidden="true" className="w-7 border-t border-dashed border-border-dark" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
