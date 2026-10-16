import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateCharacterVoiceProfileInput } from "../../../../shared/api-types/character";
import { charactersApi } from "../../characters/api/characters.api";
import { videoProductionQueryKeys } from "../../production/queries/production-cache";

const voiceKey = (characterId: string) => ["characters", characterId, "voice-profiles"] as const;

export function useCharacterVoiceProfiles(characterId: string) {
  return useQuery({ queryKey: voiceKey(characterId), queryFn: () => charactersApi.voiceProfiles(characterId), staleTime: 30_000 });
}

export function useSaveCharacterVoice(characterId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCharacterVoiceProfileInput) => charactersApi.createVoiceProfile(characterId, input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: voiceKey(characterId) }),
        client.invalidateQueries({ queryKey: ["projects"] }),
        client.invalidateQueries({ queryKey: videoProductionQueryKeys.all }),
      ]);
    },
  });
}
