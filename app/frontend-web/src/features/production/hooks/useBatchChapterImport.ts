import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chaptersApi } from "@/features/chapters/api/chapters.api";
import { queryKeys } from "@/lib/query-keys";
import { apiErrorMessage } from "@/shared/api/client";
import type { ProjectId } from "@/types/api";

export function useBatchChapterImport(projectId: ProjectId) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useMutation({
    mutationFn: (file: File) => chaptersApi.batchImport(projectId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectOverview(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  return {
    inputRef,
    ...mutation,
    errorMessage: mutation.error
      ? apiErrorMessage(mutation.error, "Không thể batch import file.")
      : null,
    selectFile: () => inputRef.current?.click(),
    importFile: (file: File) => mutation.mutate(file),
  };
}
