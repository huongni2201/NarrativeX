import { useMutation, useQueryClient } from "@tanstack/react-query";
import { narrationApi } from "../api/narration.api";
import type { GenerateNarrationInput } from "../types/narration.types";
import { queryKeys } from "@/lib/query-keys";
import type { ChapterId, ProjectId } from "@/types/api";

interface GenerateNarrationMutationParams {
  projectId: ProjectId;
  chapterId: ChapterId;
  input: GenerateNarrationInput;
}

export function useGenerateNarration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, chapterId, input }: GenerateNarrationMutationParams) =>
      narrationApi.generateNarration(projectId, chapterId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chapterWorkspace(variables.projectId, variables.chapterId),
      });
      queryClient.invalidateQueries({ queryKey: ["job-history"] });
    },
  });
}
