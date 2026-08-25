import { useMutation, useQueryClient } from "@tanstack/react-query";
import { charactersApi } from "../api/characters.api";

export function useCreateCharacter(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { canonicalName: string; aliases?: string[] }) =>
      charactersApi.create(input),
    onSuccess: async (character) => {
      await charactersApi.assign(projectId, {
        characterId: character.id,
        role: "SECONDARY",
      });
      await queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "characters"],
      });
    },
  });
}
