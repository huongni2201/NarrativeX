"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiErrorMessage } from "@/shared/api/client";
import {
  storyboardApi,
  type ApiStoryboardVisualBeat,
  type VisualBeatReviewStatus,
} from "../api/storyboard.api";

export interface StoryboardChapterItem {
  id: number;
  orderIndex: number;
  title: string;
}

export type StatusFilter = "ALL" | VisualBeatReviewStatus;

interface UseStoryboardStateOptions {
  projectId: number;
  chapters: StoryboardChapterItem[];
  initialChapterId?: number | null;
}

export function useStoryboardState({
  projectId,
  chapters,
  initialChapterId,
}: UseStoryboardStateOptions) {
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
    mutationFn: ({
      beat,
      nextStatus,
    }: {
      beat: ApiStoryboardVisualBeat;
      nextStatus: VisualBeatReviewStatus;
    }) => {
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

  function closeAddVisualBeat() {
    setAddOpen(false);
    setActionError(null);
  }

  return {
    orderedChapters,
    chapterId,
    setChapterId,
    sceneId,
    setSceneId,
    status,
    setStatus,
    search,
    setSearch,
    addOpen,
    addSceneId,
    setAddSceneId,
    beatTitle,
    setBeatTitle,
    visualIntent,
    setVisualIntent,
    actionError,
    storyboardQuery,
    storyboard,
    visibleScenes,
    visibleBeatCount,
    createBeat,
    updateReview,
    openAddVisualBeat,
    closeAddVisualBeat,
  };
}
