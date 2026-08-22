import type { ApiStoryboardScene } from "../api/storyboard.api";

interface StoryboardSceneRailProps {
  scenes: ApiStoryboardScene[];
  sceneId: number | null;
  onSelectAll: () => void;
  onSelectScene: (sceneId: number) => void;
}

export function StoryboardSceneRail({
  scenes,
  sceneId,
  onSelectAll,
  onSelectScene,
}: Readonly<StoryboardSceneRailProps>) {
  return (
    <aside className="border-b border-border-dark bg-surface-panel p-2 lg:border-b-0 lg:border-r">
      <button
        type="button"
        onClick={onSelectAll}
        className={`mb-1 w-full rounded-md px-2.5 py-2 text-left text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
          sceneId === null
            ? "bg-surface-elevated text-orange-300 ring-1 ring-orange-500/25"
            : "text-slate-500 hover:bg-surface-2 hover:text-slate-300"
        }`}
      >
        Tất cả Scene
      </button>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => onSelectScene(scene.id)}
            className={`group relative w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
              sceneId === scene.id
                ? "border-orange-500/50 bg-surface-elevated shadow-lg shadow-orange-950/20"
                : "border-border-dark bg-surface-input hover:border-border hover:bg-surface-2"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-100">
                Scene {String(scene.orderIndex + 1).padStart(2, "0")}
              </span>
              <span className="text-[11px] text-slate-500 group-hover:text-slate-400">✕</span>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-slate-400">{scene.title}</p>
            <p className="mt-1.5 text-[11px] font-medium text-slate-500">
              {scene.totalBeatCount}/{scene.totalBeatCount} beats
            </p>
          </button>
        ))}
      </div>
    </aside>
  );
}
