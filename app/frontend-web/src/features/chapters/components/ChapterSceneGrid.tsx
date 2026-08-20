import { Image as ImageIcon, Layers } from "lucide-react";
import type { ApiChapterWorkspacePreviewScene } from "@/types/api";

interface ChapterSceneGridProps {
  scenes: ApiChapterWorkspacePreviewScene[];
  expanded?: boolean;
}

export function ChapterSceneGrid({ scenes, expanded = false }: Readonly<ChapterSceneGridProps>) {
  if (scenes.length === 0) {
    return (
      <div className="mt-4 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-panel px-6 text-center">
        <Layers className="h-8 w-8 text-slate-600" />
        <p className="mt-3 text-sm font-medium text-slate-300">Chưa có Scene</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
          Phân tích Chapter để backend tạo Scene và Visual Beat. UI không dùng dữ liệu mock.
        </p>
      </div>
    );
  }

  return (
    <div className={`mt-4 grid gap-3 ${expanded ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
      {scenes.map((scene) => (
        <SceneCard key={scene.id} scene={scene} />
      ))}
    </div>
  );
}

function SceneCard({ scene }: Readonly<{ scene: ApiChapterWorkspacePreviewScene }>) {
  const sceneNumber = String(scene.orderIndex + 1).padStart(2, "0");
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface-panel transition-colors hover:border-border-dark">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-800/80 via-slate-900 to-slate-950">
        {scene.previewImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(scene.previewImageUrl).slice(1, -1)})` }}
            role="img"
            aria-label={`Preview ${scene.title}`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
            <ImageIcon className="h-8 w-8 text-slate-600" />
            <span className="text-xs">Visual chưa được generate</span>
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-md border border-white/10 bg-black/60 px-2 py-0.5 text-xs font-semibold text-slate-200 backdrop-blur">
          Scene {sceneNumber}
        </span>
        <span className="absolute bottom-2.5 right-2.5 rounded-md border border-white/10 bg-black/60 px-2 py-0.5 text-[11px] text-slate-300 backdrop-blur">
          {scene.visualBeatCount} beats
        </span>
      </div>
      <div className="p-3.5">
        <h4 className="line-clamp-1 text-xs font-bold text-slate-200">{scene.title}</h4>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
          Trạng thái: {scene.status} {scene.durationSeconds ? `· ${scene.durationSeconds}s` : ""}
        </p>
      </div>
    </article>
  );
}
