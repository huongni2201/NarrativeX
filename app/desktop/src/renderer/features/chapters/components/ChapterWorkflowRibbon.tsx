import { BookOpen, Clapperboard, FileText, WandSparkles } from "lucide-react";

type Props = Readonly<{
  sceneAvailable: boolean;
  visualBeatAvailable: boolean;
  onOpenEditor: () => void;
}>;

const STEPS = [
  { key: "story", label: "Story", icon: BookOpen },
  { key: "chapter", label: "Chapter", icon: FileText },
  { key: "scene", label: "Scene", icon: Clapperboard },
  { key: "visual-beat", label: "Visual Beat", icon: WandSparkles },
] as const;

export function ChapterWorkflowRibbon({
  sceneAvailable,
  visualBeatAvailable,
  onOpenEditor,
}: Props) {
  return (
    <div className="shrink-0 border-b border-border bg-surface-panel px-6 py-2">
      <div className="flex max-w-2xl items-center gap-3 text-xs text-text-muted">
        {STEPS.map(({ key, label }, index) => {
          const active = key === "chapter";
          const editorStep = key === "scene" || key === "visual-beat";
          const available =
            key === "scene" ? sceneAvailable : key === "visual-beat" ? visualBeatAvailable : false;
          const className = `flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors ${
            active
              ? "border-b-2 border-primary bg-transparent text-primary-hover"
              : available
                ? "cursor-pointer text-text-secondary hover:text-primary-hover"
                : "text-text-muted"
          }`;

          return (
            <div key={key} className="flex items-center gap-3">
              {editorStep ? (
                <button
                  type="button"
                  disabled={!available}
                  onClick={onOpenEditor}
                  className={`${className} disabled:cursor-not-allowed disabled:opacity-55`}
                  title={
                    available
                      ? key === "visual-beat"
                        ? "Mở Visual Beat trong Editor"
                        : "Mở Scene trong Editor"
                      : "Phân tích chapter để tạo dữ liệu trước"
                  }
                >
                  <span
                    className={`size-1.5 rounded-full ${available ? "bg-primary" : "bg-text-dim"}`}
                  />
                  <span>{label}</span>
                </button>
              ) : (
                <div className={className}>
                  <span className={`size-1.5 rounded-full ${active ? "bg-primary" : "bg-text-dim"}`} />
                  <span>{label}</span>
                </div>
              )}
              {index < STEPS.length - 1 && (
                <span aria-hidden="true" className="w-7 border-t border-dashed border-border-dark" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
