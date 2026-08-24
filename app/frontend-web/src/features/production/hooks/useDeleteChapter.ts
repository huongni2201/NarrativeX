import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chaptersApi } from "@/features/chapters/api/chapters.api";
import { queryKeys } from "@/lib/query-keys";
import { apiErrorMessage } from "@/shared/api/client";
import type { ProjectId } from "@/types/api";

export function useDeleteChapter(
  projectId: ProjectId,
  options: Readonly<{ onDeleted?: () => void }> = {},
) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (chapterId: string) => chaptersApi.delete(projectId, chapterId),
    onSuccess: () => {
      options.onDeleted?.();
      queryClient.invalidateQueries({ queryKey: queryKeys.projectOverview(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  return {
    ...mutation,
    errorMessage: mutation.error ? apiErrorMessage(mutation.error, "Không thể xoá Chapter.") : null,
    submit: (chapterId: string) => mutation.mutate(chapterId),
  };
}
