import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  GenerateBatchNarrationInput,
  GenerateNarrationInput,
  GenerateVoicePreviewInput,
} from "@narrativex/client-contracts";
import { chapterQueryKeys } from "../../chapters/queries/chapters.queries";
import { narrationApi } from "../api/narration.api";

async function invalidateNarrationState(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: chapterQueryKeys.all(projectId) }),
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
  ]);
}

export function useGenerateNarration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; request: GenerateNarrationInput }) =>
      narrationApi.generate(input.projectId, input.request),
    onSuccess: async (_job, input) => invalidateNarrationState(queryClient, input.projectId),
  });
}

export function useGenerateBatchNarration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: GenerateBatchNarrationInput) => narrationApi.generateBatch(request),
    onSuccess: async (_jobs, request) => invalidateNarrationState(queryClient, request.projectId),
  });
}

export function useGenerateVoicePreview() {
  return useMutation({
    mutationFn: (input: { projectId: string; request: GenerateVoicePreviewInput }) =>
      narrationApi.generatePreview(input.projectId, input.request),
  });
}
