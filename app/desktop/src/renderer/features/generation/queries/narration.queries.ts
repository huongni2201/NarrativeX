import { useMutation } from "@tanstack/react-query";
import type {
  GenerateBatchNarrationInput,
  GenerateNarrationInput,
} from "@narrativex/client-contracts";
import { narrationApi } from "../api/narration.api";

export function useGenerateNarration() {
  return useMutation({
    mutationFn: (input: { projectId: string; request: GenerateNarrationInput }) =>
      narrationApi.generate(input.projectId, input.request),
  });
}

export function useGenerateBatchNarration() {
  return useMutation({
    mutationFn: (request: GenerateBatchNarrationInput) => narrationApi.generateBatch(request),
  });
}
