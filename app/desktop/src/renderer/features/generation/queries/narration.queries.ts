import { useMutation } from "@tanstack/react-query";
import type {
  GenerateBatchNarrationInput,
  GenerateNarrationInput,
  GenerateVoicePreviewInput,
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

export function useGenerateVoicePreview() {
  return useMutation({
    mutationFn: (input: { projectId: string; request: GenerateVoicePreviewInput }) =>
      narrationApi.generatePreview(input.projectId, input.request),
  });
}
