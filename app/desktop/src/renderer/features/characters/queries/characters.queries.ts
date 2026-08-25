import { useMutation, useQueryClient } from "@tanstack/react-query";
import { catalogApi } from "../../../api/catalog.api";

export function useCreateCharacter(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { canonicalName: string; aliases?: string[] }) => catalogApi.createCharacter(input), onSuccess: async (character) => { await catalogApi.assignCharacter(projectId, { characterId: character.id, role: "SECONDARY" }); await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "characters"] }); } });
}
