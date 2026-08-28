import { useMutation, useQueryClient } from "@tanstack/react-query";
import { assetsApi } from "../../assets/api/assets.api";
import { persistVoiceAudioAsset } from "../model/voice-media-workflow";

export function useImportVoiceAudioAsset(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const selection = await window.narrativex.localStorage.selectAsset();
      if (!selection) return null;

      return persistVoiceAudioAsset(
        {
          registerLocal: (input) => assetsApi.registerLocal(input),
          commitSelectedAsset: (input) =>
            window.narrativex.localStorage.commitSelectedAsset(input),
        },
        { projectId, selection },
      );
    },
    onSuccess: async (result) => {
      if (!result) return;
      await queryClient.invalidateQueries({ queryKey: ["assets", "library"] });
    },
  });
}

export function useUploadVoiceReference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => window.narrativex.api.uploadVoiceReference(),
    onSuccess: async (uploaded) => {
      if (!uploaded) return;
      await queryClient.invalidateQueries({ queryKey: ["assets", "library"] });
    },
  });
}
