import { X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { ApiChapterStoryboard, ApiStoryboardScene } from "../api/storyboard.api";

interface AddVisualBeatModalProps {
  isOpen: boolean;
  storyboard: ApiChapterStoryboard;
  addSceneId: number | null;
  beatTitle: string;
  visualIntent: string;
  actionError: string | null;
  isPending: boolean;
  onClose: () => void;
  onSceneChange: (sceneId: number) => void;
  onTitleChange: (title: string) => void;
  onIntentChange: (intent: string) => void;
  onSubmit: () => void;
}

export function AddVisualBeatModal({
  isOpen,
  storyboard,
  addSceneId,
  beatTitle,
  visualIntent,
  actionError,
  isPending,
  onClose,
  onSceneChange,
  onTitleChange,
  onIntentChange,
  onSubmit,
}: Readonly<AddVisualBeatModalProps>) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Thêm Visual Beat" closeDisabled={isPending} maxWidth="lg">
      <div className="w-full bg-surface-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-100">Thêm Visual Beat</h3>
            <p className="mt-1 text-xs text-slate-500">Dữ liệu sẽ được lưu trực tiếp qua Storyboard API.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Đóng"
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <label className="block text-xs text-slate-400">
            Scene
            <select
              value={addSceneId?.toString() ?? ""}
              onChange={(event) => onSceneChange(Number(event.target.value))}
              className="mt-1.5 h-10 w-full rounded-lg border border-border-dark bg-surface-input px-3 text-sm text-slate-200 outline-none transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            >
              {storyboard.scenes.map((scene: ApiStoryboardScene) => (
                <option key={scene.id} value={scene.id}>
                  Scene {String(scene.orderIndex + 1).padStart(2, "0")} — {scene.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            Tiêu đề
            <input
              value={beatTitle}
              onChange={(event) => onTitleChange(event.target.value)}
              maxLength={200}
              placeholder="Ví dụ: Đội quân xuất phát"
              className="mt-1.5 h-10 w-full rounded-lg border border-border-dark bg-surface-input px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Visual intent
            <textarea
              value={visualIntent}
              onChange={(event) => onIntentChange(event.target.value)}
              maxLength={8000}
              rows={5}
              placeholder="Mô tả khung hình, hành động, bối cảnh…"
              className="mt-1.5 w-full resize-y rounded-lg border border-border-dark bg-surface-input px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </label>
          {actionError && <p role="alert" className="text-xs text-rose-300">{actionError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-border-dark px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isPending || !beatTitle.trim() || !visualIntent.trim() || addSceneId === null}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "Đang lưu…" : "Thêm Visual Beat"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
