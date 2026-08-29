import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url";
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
    mutationFn: (input: { canonicalName: string; aliases?: string[] }) => charactersApi.create(input),
    onSuccess: async (character) => {
      await charactersApi.assign(projectId, { characterId: character.id, role: "SECONDARY" });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "characters"] });
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

export function useCharacterAssetPreview(projectId: string, assetId: string | null) {
  return {
    url: assetId ? localAssetPreviewUrl(projectId, assetId) : null,
    isLoading: false,
    isError: false,
  };
}

export function useCharacterPortrait(
  projectId: string,
  characterId: string | null,
  versionId: string | null,
) {
  const referencesQuery = useCharacterReferences(projectId, characterId, versionId);
  const portraitReference =
    referencesQuery.data?.find((reference) => reference.role === "IDENTITY") ?? referencesQuery.data?.[0] ?? null;
  const imagePreview = useCharacterAssetPreview(projectId, portraitReference?.assetId ?? null);
  return {
    ...imagePreview,
    isReferencesLoading: referencesQuery.isLoading,
    isReferencesError: referencesQuery.isError,
    reference: portraitReference,
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
        ? queryClient.invalidateQueries({ queryKey: characterReferencesKey(projectId, characterId, versionId) })
        : Promise.resolve(),
    ]);
  }

  const createVersion = useMutation({
    mutationFn: (input: { bible: string; visualPrompt: string }) => charactersApi.createVersion(characterId, input),
    onSuccess: refresh,
  });

  const generateIdentity = useMutation({
    mutationFn: (input: { prompt: string }) => {
      if (!versionId) throw new Error("Character chưa có version để lưu reference.");
      return generateCharacterIdentityReference({ projectId, characterId, versionId, ...input });
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

  const pin = useMutation({
    mutationFn: () => {
      if (!versionId) throw new Error("Character chưa có version để pin.");
      return charactersApi.pinVersion(projectId, characterId, versionId);
    },
    onSuccess: refresh,
  });

  const lockAndPin = useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error("Character chưa có version để lock.");
      await charactersApi.lockVersion(characterId, versionId);
      return charactersApi.pinVersion(projectId, characterId, versionId);
    },
    onSettled: refresh,
  });

  return { createVersion, generateIdentity, importIdentity, review, pin, lockAndPin };
}
