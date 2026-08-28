import { Loader2 } from "lucide-react";
import type { StoryboardScene } from "../api/storyboard.api";

export function SceneRail({
  scenes,
  selectedSceneId,
  chapterTitle,
  loading,
  error,
  onSelectScene,
}: Readonly<{
  scenes: StoryboardScene[];
  selectedSceneId: string | null;
  chapterTitle: string | null;
  loading: boolean;
  error: string | null;
  onSelectScene: (sceneId: string) => void;
}>) {
  return (
    <section className="min-h-0 overflow-y-auto border-r border-border bg-surface-panel p-3">
      <PanelTitle title="Scenes" count={scenes.length} />
      <div className="mt-1 truncate text-[11px] text-text-muted">
        {chapterTitle ?? "Chọn chapter"}
      </div>

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Loader2 size={14} className="animate-spin" />
          Đang tải storyboard...
        </div>
      ) : error ? (
        <div className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : !scenes.length ? (
        <div className="mt-4 rounded-md border border-dashed border-border p-4 text-xs text-text-muted">
          Chapter này chưa có scene. Hãy chạy hoặc chạy lại phân tích chapter.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {scenes.map((scene) => {
            const active = scene.id === selectedSceneId;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => onSelectScene(scene.id)}
                className={`w-full rounded-md border p-3 text-left transition ${
                  active
                    ? "border-primary/55 bg-primary/10"
                    : "border-border-subtle bg-surface-dark hover:border-border hover:bg-surface-2"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    Scene {scene.orderIndex + 1}
                  </span>
                  <span className="rounded bg-surface-input px-1.5 py-0.5 text-[9px] text-text-muted">
                    {scene.approvedBeatCount}/{scene.totalBeatCount} approved
                  </span>
                </div>
                <div className="mt-1.5 text-xs font-semibold text-foreground">{scene.title}</div>
                <div className="mt-2 text-[10px] uppercase tracking-wide text-text-dim">
                  {formatEnum(scene.status)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PanelTitle({ title, count }: Readonly<{ title: string; count: number }>) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary">{title}</h2>
      <span className="rounded bg-surface-input px-1.5 py-0.5 text-[9px] text-text-muted">{count}</span>
    </div>
  );
}

function formatEnum(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .toLocaleLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}
