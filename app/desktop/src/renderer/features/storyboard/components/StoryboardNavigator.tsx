import type { DesktopChapterDetails } from "@narrativex/client-contracts";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { StoryboardScene } from "../api/storyboard.api";
import { PaneHeader, StatusIndicator, WorkspacePane } from "../../workspace/components/WorkstationPrimitives";

export function StoryboardNavigator({
  chapters,
  selectedChapterId,
  scenes,
  selectedSceneId,
  loading,
  error,
  onSelectChapter,
  onSelectScene,
}: Readonly<{
  chapters: DesktopChapterDetails[];
  selectedChapterId: string | null;
  scenes: StoryboardScene[];
  selectedSceneId: string | null;
  loading: boolean;
  error: string | null;
  onSelectChapter: (chapterId: string) => void;
  onSelectScene: (sceneId: string) => void;
}>) {
  return (
    <WorkspacePane className="flex flex-col border-r border-border-subtle bg-surface-dark">
      <PaneHeader title="Storyboard" meta={`${chapters.length} chapters`} />
      <div className="min-h-0 flex-1 overflow-y-auto py-1.5">
        {chapters.map((chapter) => {
          const active = chapter.id === selectedChapterId;
          return (
            <div key={chapter.id} className="border-b border-border-subtle last:border-b-0">
              <button
                type="button"
                onClick={() => onSelectChapter(chapter.id)}
                className={`flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 ${
                  active ? "bg-surface-selected text-foreground" : "text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {active ? <ChevronDown size={13} className="shrink-0 text-primary" /> : <ChevronRight size={13} className="shrink-0 text-text-dim" />}
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium text-text-dim">Chapter {chapter.orderIndex + 1}</div>
                  <div className="truncate text-[11px] font-semibold">{chapter.title}</div>
                </div>
                {active ? <span className="h-5 w-0.5 shrink-0 rounded-full bg-primary" aria-hidden="true" /> : null}
              </button>

              {active ? (
                <div className="border-t border-border-subtle bg-background/35 py-1">
                  {loading ? (
                    <div className="flex items-center gap-2 px-7 py-3 text-[10px] text-text-muted">
                      <Loader2 size={12} className="animate-spin" /> Loading scenes…
                    </div>
                  ) : error ? (
                    <div className="px-7 py-2 text-[10px] leading-4 text-danger">{error}</div>
                  ) : scenes.length ? (
                    scenes.map((scene) => {
                      const sceneActive = scene.id === selectedSceneId;
                      return (
                        <button
                          key={scene.id}
                          type="button"
                          onClick={() => onSelectScene(scene.id)}
                          className={`group flex min-h-11 w-full items-center gap-2 border-l-2 px-3 pl-7 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 ${
                            sceneActive
                              ? "border-l-primary bg-primary-muted/55"
                              : "border-l-transparent hover:bg-surface-hover"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] font-medium ${sceneActive ? "text-primary-hover" : "text-text-muted"}`}>
                                Scene {scene.orderIndex + 1}
                              </span>
                              <span className="text-[9px] tabular-nums text-text-dim">
                                {scene.approvedBeatCount}/{scene.totalBeatCount}
                              </span>
                            </div>
                            <div className={`mt-0.5 truncate text-[11px] ${sceneActive ? "font-semibold text-foreground" : "text-text-secondary"}`}>
                              {scene.title}
                            </div>
                            <StatusIndicator
                              label={formatEnum(scene.status)}
                              tone={scene.approvedBeatCount === scene.totalBeatCount && scene.totalBeatCount > 0 ? "success" : "neutral"}
                              className="mt-1"
                            />
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-7 py-3 text-[10px] leading-4 text-text-muted">
                      Chưa có scene. Hãy chạy hoặc chạy lại phân tích chapter.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </WorkspacePane>
  );
}

function formatEnum(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value
    .toLocaleLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}
