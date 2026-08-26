import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { ConfirmChapterTranslationInput } from "@narrativex/client-contracts";
import { generationApi } from "../../generation/api/generation.api.ts";
import { chaptersApi } from "../api/chapters.api.ts";

export const translationQueryKeys = {
  all: ["chapter-translation"] as const,
  status: (projectId: string, chapterId: string) =>
    [...translationQueryKeys.all, "status", projectId, chapterId] as const,
  variants: (projectId: string, chapterId: string) =>
    [...translationQueryKeys.all, "variants", projectId, chapterId] as const,
};

export function useChapterLanguageStatus(projectId: string, chapterId: string | null) {
  return useQuery({
    queryKey: translationQueryKeys.status(projectId, chapterId ?? "none"),
    queryFn: () => chaptersApi.languageStatus(projectId, chapterId as string),
    enabled: Boolean(projectId && chapterId),
  });
}

export function useChapterContentVariants(projectId: string, chapterId: string | null) {
  return useQuery({
    queryKey: translationQueryKeys.variants(projectId, chapterId ?? "none"),
    queryFn: () => chaptersApi.contentVariants(projectId, chapterId as string),
    enabled: Boolean(projectId && chapterId),
  });
}

export function useTranslateChapter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      chapterId: string;
      request: ConfirmChapterTranslationInput;
    }) => generationApi.translateChapter(input.projectId, input.chapterId, input.request),
    onSuccess: (_job, input) => {
      void queryClient.invalidateQueries({
        queryKey: translationQueryKeys.status(input.projectId, input.chapterId),
      });
    },
  });
}

export function invalidateChapterTranslation(
  queryClient: QueryClient,
  projectId: string,
  chapterId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: translationQueryKeys.status(projectId, chapterId) }),
    queryClient.invalidateQueries({ queryKey: translationQueryKeys.variants(projectId, chapterId) }),
  ]);
}
