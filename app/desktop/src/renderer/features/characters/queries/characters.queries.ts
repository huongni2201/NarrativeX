import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assetsApi } from "../../assets/api/assets.api";
import { charactersApi } from "../api/characters.api";
import {
  generateCharacterIdentityReference,
  importCharacterIdentityReference,
} from "../services/character-reference-generation";

function characterDetailKey(projectId: string, characterId: string | null) {
  return ["projects", projectId, "characters", characterId] as const;
}

function characterReferencesKey(
  projectId: string,
  characterId: string | null,
  versionId: string | null,
) {
  return ["projects", projectId, "characters", characterId, "versions", versionId, "references"] as const;
}

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

export function useCharacterDetail(projectId: string, characterId: string | null) {
  return useQuery({
    queryKey: characterDetailKey(projectId, characterId),
    queryFn: () => charactersApi.detail(projectId, characterId as string),
    enabled: Boolean(projectId && characterId),
  });
}

export function useCharacterReferences(
  projectId: string,
  characterId: string | null,
  versionId: string | null,
) {
  return useQuery({
    queryKey: characterReferencesKey(projectId, characterId, versionId),
    queryFn: () => charactersApi.versionReferences(characterId as string, versionId as string),
    enabled: Boolean(projectId && characterId && versionId),
    staleTime: 30_000,
  });
}

export function useCharacterPortrait(
  projectId: string,
  characterId: string | null,
  versionId: string | null,
) {
  const referencesQuery = useCharacterReferences(projectId, characterId, versionId);

  const portraitReference =
    referencesQuery.data?.find((reference) => reference.role === "IDENTITY") ??
    referencesQuery.data?.[0] ??
    null;

  const imageQuery = useQuery({
    queryKey: ["assets", portraitReference?.assetId ?? "none", "download-url"],
    queryFn: () => assetsApi.downloadUrl(portraitReference!.assetId),
    enabled: Boolean(portraitReference?.assetId),
    staleTime: 30_000,
  });

  return {
    ...imageQuery,
    isReferencesLoading: referencesQuery.isLoading,
    isReferencesError: referencesQuery.isError,
    reference: portraitReference,
    url: imageQuery.data?.url ?? null,
  };
}

export function useCharacterReferenceActions(
  projectId: string,
  characterId: string,
  versionId: string | null,
) {
  const queryClient = useQueryClient();

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: characterDetailKey(projectId, characterId) }),
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "characters"] }),
      versionId
        ? queryClient.invalidateQueries({
            queryKey: characterReferencesKey(projectId, characterId, versionId),
          })
        : Promise.resolve(),
    ]);
  }

  const createVersion = useMutation({
    mutationFn: (input: { bible: string; visualPrompt: string }) =>
      charactersApi.createVersion(characterId, input),
    onSuccess: refresh,
  });

  const generateIdentity = useMutation({
    mutationFn: (input: {
      canonicalName: string;
      visualPrompt: string;
      bible?: string | null;
      appearance?: Parameters<typeof generateCharacterIdentityReference>[0]["appearance"];
    }) => {
      if (!versionId) throw new Error("Character chưa có version để lưu reference.");
      return generateCharacterIdentityReference({
        projectId,
        characterId,
        versionId,
        ...input,
      });
    },
    onSuccess: refresh,
  });

  const importIdentity = useMutation({
    mutationFn: () => {
      if (!versionId) throw new Error("Character chưa có version để lưu reference.");
      return importCharacterIdentityReference({ projectId, characterId, versionId });
    },
    onSuccess: refresh,
  });

  const review = useMutation({
    mutationFn: () => {
      if (!versionId) throw new Error("Character chưa có version để approve.");
      return charactersApi.reviewVersion(characterId, versionId);
    },
    onSuccess: refresh,
  });

  const lockAndPin = useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error("Character chưa có version để lock.");
      await charactersApi.lockVersion(characterId, versionId);
      return charactersApi.pinVersion(projectId, characterId, versionId);
    },
    onSuccess: refresh,
  });

  return {
    createVersion,
    generateIdentity,
    importIdentity,
    review,
    lockAndPin,
  };
}
