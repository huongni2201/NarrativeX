import { Image as ImageIcon } from "lucide-react";
import type { ApiChapterWorkspacePreviewScene } from "@/types/api";

interface ChapterSceneGridProps {
  scenes: ApiChapterWorkspacePreviewScene[];
  expanded?: boolean;
}

export function ChapterSceneGrid({ scenes, expanded = false }: Readonly<ChapterSceneGridProps>) {
  if (scenes.length === 0) {
    return (
      <div className="mt-4 flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-surface-panel/30 px-6 py-12 text-center transition-colors">
        {/* Film / Clapperboard Illustration */}
        <div className="relative mx-auto flex h-24 w-28 items-center justify-center select-none">
          {/* Sóng tròn đồng tâm phía dưới */}
          <div className="absolute -bottom-2 h-7 w-24 rounded-[100%] border border-orange-500/20 bg-orange-500/5 blur-[0.5px]" />
          <div className="absolute -bottom-3.5 h-9 w-28 rounded-[100%] border border-orange-500/10" />

          {/* Ngôi sao trang trí lấp lánh xung quanh */}
          <span className="absolute -top-1 left-2.5 text-xs text-orange-300 animate-pulse">✦</span>
          <span className="absolute top-1 right-2 text-sm text-amber-300 animate-pulse">★</span>
          <span className="absolute bottom-2 -left-1 text-base text-amber-400 font-bold">✦</span>
          <span className="absolute top-0 right-7 text-[10px] text-orange-400">✦</span>

          {/* Biểu tượng Clapperboard 3D sắc nét */}
          <div className="relative flex h-14 w-16 rotate-[-6deg] flex-col items-center justify-between rounded-xl border border-orange-400/40 bg-gradient-to-br from-orange-600 via-orange-600 to-slate-900 p-1.5 shadow-xl shadow-orange-950/70 transition-transform duration-300 hover:rotate-0 hover:scale-105">
            {/* Sọc kẻ clapperboard */}
            <div className="flex h-3 w-full items-center justify-around overflow-hidden rounded-t border-b border-orange-300/30 bg-slate-950/80">
              <div className="h-full w-1.5 -skew-x-12 bg-orange-200/90" />
              <div className="h-full w-1.5 -skew-x-12 bg-orange-200/90" />
              <div className="h-full w-1.5 -skew-x-12 bg-orange-200/90" />
            </div>
            {/* Nút Play ở giữa */}
            <div className="my-auto flex h-6 w-6 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm shadow-inner">
              <div className="ml-0.5 h-0 w-0 border-y-[4px] border-y-transparent border-l-[7px] border-l-white" />
            </div>
          </div>
        </div>

        <h3 className="mt-4 text-base font-semibold text-slate-100">Chưa có Scene</h3>
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-400">
          Phân tích Chapter để backend tạo Scene và Visual Beat.
          <br />
          UI không dùng dữ liệu mock.
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
