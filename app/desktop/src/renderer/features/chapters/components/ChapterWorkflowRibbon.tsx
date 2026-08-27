import { BookOpen, Clapperboard, FileText, WandSparkles } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

type Props = Readonly<{
  sceneAvailable?: boolean;
  visualBeatAvailable?: boolean;
}>;

const STEPS = [
  { key: "story", label: "Story", icon: BookOpen },
  { key: "chapter", label: "Chapter", icon: FileText },
  { key: "scene", label: "Scene", icon: Clapperboard },
  { key: "visual-beat", label: "Visual Beat", icon: WandSparkles },
] as const;

export function ChapterWorkflowRibbon({
  sceneAvailable = true,
  visualBeatAvailable = true,
}: Props = {}) {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const openStoryboard = () =>
    navigate(projectId ? `/projects/${projectId}/storyboard` : "/projects");

  return (
    <div className="shrink-0 border-b border-border bg-surface-panel px-6 py-2">
      <div className="flex max-w-2xl items-center gap-3 text-xs text-text-muted">
        {STEPS.map(({ key, label }, index) => {
          const active = key === "chapter";
          const storyboardStep = key === "scene" || key === "visual-beat";
          const available =
            key === "scene" ? sceneAvailable : key === "visual-beat" ? visualBeatAvailable : false;
          const className = `flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors ${
            active
              ? "border-b-2 border-primary bg-transparent text-primary-hover"
              : available
                ? "text-text-secondary"
                : "text-text-muted"
          }`;

          return (
            <div key={key} className="flex items-center gap-3">
              {storyboardStep ? (
                <button
                  type="button"
                  disabled={!available}
                  onClick={openStoryboard}
                  className={`${className} cursor-pointer hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-55`}
                  title={
                    available
                      ? key === "visual-beat"
                        ? "Quản lý Visual Beat trong Storyboard"
                        : "Quản lý Scene trong Storyboard"
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
