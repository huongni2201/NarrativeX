"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clock3,
  ImageIcon,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { ApiChapterSummary } from "@/types/api";
import { queryKeys } from "@/lib/query-keys";
import { apiErrorMessage } from "@/shared/api/client";
import {
  storyboardApi,
  type ApiStoryboardScene,
  type ApiStoryboardVisualBeat,
  type VisualBeatReviewStatus,
} from "./api/storyboard.api";

export interface StoryboardChapterItem {
  id: number;
  orderIndex: number;
  title: string;
}

interface StoryboardScreenProps {
  projectId: number;
  chapters: StoryboardChapterItem[];
  initialChapterId?: number | null;
  hideChapterSelector?: boolean;
}

type StatusFilter = "ALL" | VisualBeatReviewStatus;

export function StoryboardScreen({
  projectId,
  chapters,
  initialChapterId,
  hideChapterSelector = false,
}: Readonly<StoryboardScreenProps>) {
  const queryClient = useQueryClient();
  const orderedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id),
    [chapters],
  );
  const [chapterId, setChapterId] = useState<number | null>(
    initialChapterId ?? orderedChapters.at(-1)?.id ?? null,
  );
  const [sceneId, setSceneId] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addSceneId, setAddSceneId] = useState<number | null>(null);
  const [beatTitle, setBeatTitle] = useState("");
  const [visualIntent, setVisualIntent] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (initialChapterId !== undefined && initialChapterId !== null) {
      setChapterId(initialChapterId);
      return;
    }
    if (orderedChapters.length === 0) {
      setChapterId(null);
      return;
    }
    if (chapterId === null || !orderedChapters.some((chapter) => chapter.id === chapterId)) {
      setChapterId(orderedChapters.at(-1)!.id);
    }
  }, [chapterId, orderedChapters, initialChapterId]);

  useEffect(() => {
    setSceneId(null);
    setStatus("ALL");
    setSearch("");
  }, [chapterId]);

  const storyboardQuery = useQuery({
    queryKey:
      chapterId === null
        ? ["projects", projectId, "storyboard", "empty"]
        : queryKeys.storyboard(projectId, chapterId),
    queryFn: () => storyboardApi.get(projectId, chapterId!),
    enabled: chapterId !== null,
  });

  const createBeat = useMutation({
    mutationFn: async () => {
      if (chapterId === null || addSceneId === null) {
        throw new Error("Hãy chọn Scene cho Visual Beat.");
      }
      const title = beatTitle.trim();
      const intent = visualIntent.trim();
      if (!title || !intent) {
        throw new Error("Nhập tiêu đề và mô tả hình ảnh cho Visual Beat.");
      }
      return storyboardApi.createVisualBeat(projectId, chapterId, addSceneId, {
        title,
        visualIntent: intent,
      });
    },
    onSuccess: async () => {
      setActionError(null);
      setAddOpen(false);
      setBeatTitle("");
      setVisualIntent("");
      if (chapterId !== null) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.storyboard(projectId, chapterId) });
      }
    },
    onError: (error) => setActionError(apiErrorMessage(error, "Không thể tạo Visual Beat.")),
  });

  const updateReview = useMutation({
    mutationFn: ({ beat, nextStatus }: { beat: ApiStoryboardVisualBeat; nextStatus: VisualBeatReviewStatus }) => {
      if (chapterId === null) throw new Error("Chapter không hợp lệ.");
      return storyboardApi.updateReviewStatus(
        projectId,
        chapterId,
        beat.sceneId,
        beat.id,
        beat.rowVersion,
        nextStatus,
      );
    },
    onSuccess: async () => {
      setActionError(null);
      if (chapterId !== null) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.storyboard(projectId, chapterId) });
      }
    },
    onError: (error) => setActionError(apiErrorMessage(error, "Không thể cập nhật trạng thái.")),
  });

  const storyboard = storyboardQuery.data;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleScenes = useMemo(() => {
    if (!storyboard) return [];
    return storyboard.scenes
      .filter((scene) => sceneId === null || scene.id === sceneId)
      .map((scene) => ({
        ...scene,
        visualBeats: scene.visualBeats.filter((beat) => {
          const matchesStatus = status === "ALL" || beat.reviewStatus === status;
          const matchesSearch =
            !normalizedSearch ||
            [scene.title, beat.title, beat.visualIntent]
              .join(" ")
              .toLocaleLowerCase()
              .includes(normalizedSearch);
          return matchesStatus && matchesSearch;
        }),
      }));
  }, [normalizedSearch, sceneId, status, storyboard]);

  const visibleBeatCount = visibleScenes.reduce((sum, scene) => sum + scene.visualBeats.length, 0);

  function openAddVisualBeat(preferredSceneId?: number) {
    const firstSceneId = storyboard?.scenes[0]?.id ?? null;
    setAddSceneId(preferredSceneId ?? sceneId ?? firstSceneId);
    setActionError(null);
    setAddOpen(true);
  }

  if (orderedChapters.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-[#07111c] p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-100">Storyboard chưa có Chapter</h2>
        <p className="mt-2 text-sm text-slate-500">
          Tạo Chapter và chạy Analyze để backend sinh Scene và Visual Beat thật.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#163047] bg-[#06101a] shadow-2xl shadow-black/20">
      <div className="border-b border-[#142637] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {!hideChapterSelector && (
            <SelectControl
              ariaLabel="Chọn Chapter"
              value={chapterId?.toString() ?? ""}
              onChange={(value) => setChapterId(Number(value))}
              className="min-w-[230px]"
            >
              {orderedChapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  Chapter {String(chapter.orderIndex + 1).padStart(2, "0")} — {chapter.title}
                </option>
              ))}
            </SelectControl>
          )}

          <SelectControl
            ariaLabel="Lọc theo Scene"
            value={sceneId?.toString() ?? "ALL"}
            onChange={(value) => setSceneId(value === "ALL" ? null : Number(value))}
          >
            <option value="ALL">All Scenes</option>
            {(storyboard?.scenes ?? []).map((scene) => (
              <option key={scene.id} value={scene.id}>
                Scene {String(scene.orderIndex + 1).padStart(2, "0")}
              </option>
            ))}
          </SelectControl>

          <SelectControl
            ariaLabel="Lọc theo trạng thái"
            value={status}
            onChange={(value) => setStatus(value as StatusFilter)}
          >
            <option value="ALL">All Status</option>
            <option value="APPROVED">Approved</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
          </SelectControl>

          <label className="relative min-w-[190px] flex-1 sm:max-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm kiếm scene/visual beat..."
              className="h-9 w-full rounded-md border border-[#1b3043] bg-[#091522] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-purple-500"
            />
          </label>

          <button
            type="button"
            onClick={() => openAddVisualBeat()}
            disabled={!storyboard?.scenes.length}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md bg-purple-600 px-3 text-xs font-semibold text-white shadow-lg shadow-purple-950/30 transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm Visual Beat
          </button>
        </div>
      </div>

      {storyboardQuery.isPending && (
        <div className="flex min-h-[360px] items-center justify-center text-sm text-slate-500">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Đang tải storyboard từ backend…
        </div>
      )}

      {storyboardQuery.isError && (
        <div className="m-5 rounded-xl border border-rose-500/20 bg-rose-950/10 p-6 text-center">
          <p className="text-sm text-rose-200">
            {apiErrorMessage(storyboardQuery.error, "Không tải được Storyboard từ backend.")}
          </p>
          <button
            type="button"
            onClick={() => storyboardQuery.refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Thử lại
          </button>
        </div>
      )}

      {storyboard && (
        <div className="grid min-h-[440px] lg:grid-cols-[170px_minmax(0,1fr)]">
          <aside className="border-b border-[#142637] bg-[#07121e] p-2 lg:border-b-0 lg:border-r">
            <button
              type="button"
              onClick={() => setSceneId(null)}
              className={`mb-1 w-full rounded-md px-2.5 py-2 text-left text-[11px] transition ${
                sceneId === null
                  ? "bg-[#102235] text-purple-300 ring-1 ring-purple-500/25"
                  : "text-slate-500 hover:bg-[#0c1a28] hover:text-slate-300"
              }`}
            >
              Tất cả Scene
            </button>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {storyboard.scenes.map((scene) => (
                <SceneRailItem
                  key={scene.id}
                  scene={scene}
                  active={sceneId === scene.id}
                  onClick={() => setSceneId(scene.id)}
                />
              ))}
            </div>
          </aside>

          <div className="p-3 sm:p-4">
            {storyboard.scenes.length === 0 ? (
              <EmptyBoard
                title="Chapter chưa có Scene"
                description="Chạy Analyze Chapter để AI worker tạo Scene và Visual Beat vào PostgreSQL."
              />
            ) : visibleBeatCount === 0 ? (
              <EmptyBoard
                title="Không có Visual Beat phù hợp"
                description="Đổi Scene, trạng thái hoặc từ khóa tìm kiếm để xem các beat khác."
              />
            ) : (
              <div className="space-y-5">
                {visibleScenes.map((scene) =>
                  scene.visualBeats.length > 0 ? (
                    <div key={scene.id}>
                      {sceneId === null && (
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-slate-400">
                            Scene {String(scene.orderIndex + 1).padStart(2, "0")} · {scene.title}
                          </p>
                          <span className="text-[10px] text-slate-600">
                            {scene.approvedBeatCount}/{scene.totalBeatCount} approved
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {scene.visualBeats.map((beat) => (
                          <VisualBeatCard
                            key={beat.id}
                            beat={beat}
                            updating={updateReview.isPending && updateReview.variables?.beat.id === beat.id}
                            onReview={(nextStatus) => updateReview.mutate({ beat, nextStatus })}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => openAddVisualBeat(scene.id)}
                          className="flex min-h-[222px] flex-col items-center justify-center rounded-lg border border-dashed border-[#26425a] bg-[#07131f] text-purple-400 transition hover:border-purple-500/60 hover:bg-purple-950/10"
                        >
                          <Plus className="h-5 w-5" />
                          <span className="mt-2 text-[11px]">Thêm visual beat</span>
                        </button>
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {actionError && !addOpen && (
        <div role="alert" className="border-t border-rose-500/20 bg-rose-950/10 px-4 py-2 text-xs text-rose-300">
          {actionError}
        </div>
      )}

      {addOpen && storyboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0a1420] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h3 className="font-semibold text-slate-100">Thêm Visual Beat</h3>
                <p className="mt-1 text-xs text-slate-500">Dữ liệu sẽ được lưu trực tiếp qua Storyboard API.</p>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Đóng"
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-xs text-slate-400">
                Scene
                <select
                  value={addSceneId?.toString() ?? ""}
                  onChange={(event) => setAddSceneId(Number(event.target.value))}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-700 bg-[#07111c] px-3 text-sm text-slate-200 outline-none focus:border-purple-500"
                >
                  {storyboard.scenes.map((scene) => (
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
                  onChange={(event) => setBeatTitle(event.target.value)}
                  maxLength={200}
                  placeholder="Ví dụ: Đội quân xuất phát"
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-700 bg-[#07111c] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-purple-500"
                />
              </label>
              <label className="block text-xs text-slate-400">
                Visual intent
                <textarea
                  value={visualIntent}
                  onChange={(event) => setVisualIntent(event.target.value)}
                  maxLength={8000}
                  rows={5}
                  placeholder="Mô tả khung hình, hành động, bối cảnh..."
                  className="mt-1.5 w-full resize-y rounded-lg border border-slate-700 bg-[#07111c] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-purple-500"
                />
              </label>
              {actionError && <p role="alert" className="text-xs text-rose-300">{actionError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => createBeat.mutate()}
                  disabled={createBeat.isPending || !beatTitle.trim() || !visualIntent.trim() || addSceneId === null}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {createBeat.isPending ? "Đang lưu…" : "Thêm Visual Beat"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SelectControl({
  ariaLabel,
  value,
  onChange,
  className = "",
  children,
}: Readonly<{
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`h-9 rounded-md border border-[#1b3043] bg-[#091522] px-2.5 text-xs text-slate-300 outline-none focus:border-purple-500 ${className}`}
    >
      {children}
    </select>
  );
}

function SceneRailItem({
  scene,
  active,
  onClick,
}: Readonly<{ scene: ApiStoryboardScene; active: boolean; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full rounded-xl border p-3 text-left transition ${
        active
          ? "border-purple-500/50 bg-[#122135] shadow-lg shadow-purple-950/20"
          : "border-[#152738] bg-[#091522] hover:border-[#1e384e] hover:bg-[#0c1a29]"
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
  );
}

function VisualBeatCard({
  beat,
  updating,
  onReview,
}: Readonly<{
  beat: ApiStoryboardVisualBeat;
  updating: boolean;
  onReview: (status: VisualBeatReviewStatus) => void;
  index?: number;
}>) {
  const approved = beat.reviewStatus === "APPROVED";
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#1b344b] bg-[#071421] shadow-lg transition duration-200 hover:-translate-y-0.5 hover:border-purple-500/60 hover:shadow-purple-950/30">
      {/* Visual Image / Frame Area */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-b from-slate-800/80 via-[#0a1826] to-[#06101a]">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-slate-600">
          <ImageIcon className="h-8 w-8 text-slate-600 transition group-hover:text-purple-400" />
          <span className="text-center text-[10px] text-slate-500">Visual frame render</span>
        </div>

        {/* Top Badges & Actions */}
        <div className="absolute inset-x-2.5 top-2.5 flex items-center justify-between">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-xs font-semibold text-slate-300 backdrop-blur-md">
            🏃
          </span>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-slate-300 backdrop-blur-md transition hover:bg-black/80 hover:text-white"
            title="Đổi góc quay / action"
          >
            ⤢
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <p className="text-xs font-semibold text-slate-400">Beat {beat.orderIndex + 1}</p>
          <h4 className="mt-1 line-clamp-2 min-h-10 text-xs font-bold uppercase leading-5 text-slate-100">
            {beat.title}
          </h4>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#122434] pt-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${
              approved
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-400"
                : "border-amber-500/40 bg-amber-950/40 text-amber-400"
            }`}
          >
            {approved ? "APPROVED" : "NEEDS REVIEW"}
          </span>
          <button
            type="button"
            disabled={updating}
            onClick={() => onReview(approved ? "NEEDS_REVIEW" : "APPROVED")}
            className="rounded-md px-2 py-1 text-xs font-medium text-purple-300 transition hover:bg-purple-950/60 disabled:opacity-40"
          >
            {updating ? "…" : approved ? "Review lại" : "Duyệt"}
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyBoard({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <div className="flex min-h-[330px] items-center justify-center rounded-xl border border-dashed border-[#1c3448] bg-[#07131f] px-6 text-center">
      <div>
        <ImageIcon className="mx-auto h-9 w-9 text-slate-700" />
        <h3 className="mt-3 text-sm font-semibold text-slate-300">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
