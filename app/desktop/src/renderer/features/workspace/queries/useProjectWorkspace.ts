import { useQuery } from "@tanstack/react-query";
import type {
  DesktopAsset,
  DesktopCharacter,
  DesktopChapterDetails,
  DesktopPreset,
  DesktopProject,
  DesktopTimeline,
  DesktopVoice,
} from "@narrativex/client-contracts";
import { assetsApi, type AssetLibraryScope } from "../../assets/api/assets.api";
import { useCurrentUserQuery } from "../../auth/queries/auth.queries";
import { chaptersApi } from "../../chapters/api/chapters.api";
import { charactersApi } from "../../characters/api/characters.api";
import { presetsApi } from "../../presets/api/presets.api";
import { productionApi } from "../../production/api/production.api";
import { useProjectQuery } from "../../projects/queries/projects.queries";
import { voicesApi } from "../../voices/api/voices.api";
import type { ActivityId } from "../workspace-navigation";

export interface DesktopWorkspaceState {
  status: "loading" | "ready" | "partial" | "empty" | "error";
  projects: DesktopProject[];
  assets: DesktopAsset[];
  characters: DesktopCharacter[];
  voices: DesktopVoice[];
  presets: DesktopPreset[];
  timeline: DesktopTimeline | null;
  chapters: DesktopChapterDetails[];
  error: string | null;
}

type WorkspaceQueryRequirements = Readonly<{
  timeline: boolean;
  chapters: boolean;
  assetScope: AssetLibraryScope | null;
  characters: boolean;
  voices: boolean;
  presets: boolean;
}>;

const CATALOG_STALE_TIME_MS = 5 * 60 * 1000;

export const assetLibraryQueryKey = (userId: string, scope: AssetLibraryScope) =>
  ["assets", "library", userId, scope] as const;

const QUERY_REQUIREMENTS: Record<ActivityId, WorkspaceQueryRequirements> = {
  editor: {
    timeline: true,
    chapters: false,
    // Editor needs both visual media and narration assets. Restricting this to
    // "visual" makes LOCAL_ONLY narration look remote and causes preview URL
    // requests to hit an endpoint that cannot serve that local asset.
    assetScope: "all",
    characters: false,
    voices: false,
    presets: false,
  },
  chapters: {
    timeline: true,
    chapters: true,
    assetScope: null,
    characters: false,
    voices: true,
    presets: false,
  },
  characters: {
    timeline: false,
    chapters: false,
    assetScope: null,
    characters: true,
    voices: false,
    presets: false,
  },
  images: {
    timeline: true,
    chapters: true,
    assetScope: null,
    characters: false,
    voices: false,
    presets: false,
  },
  voice: {
    timeline: true,
    chapters: true,
    assetScope: "audio",
    characters: false,
    voices: true,
    presets: false,
  },
  assets: {
    timeline: false,
    chapters: false,
    assetScope: "all",
    characters: false,
    voices: false,
    presets: false,
  },
  render: {
    timeline: true,
    chapters: false,
    assetScope: null,
    characters: false,
    voices: false,
    presets: false,
  },
  settings: {
    timeline: false,
    chapters: false,
    assetScope: "all",
    characters: false,
    voices: false,
    presets: true,
  },
};

const emptyWorkspace: DesktopWorkspaceState = {
  status: "empty",
  projects: [],
  assets: [],
  characters: [],
  voices: [],
  presets: [],
  timeline: null,
  chapters: [],
  error: null,
};

export function useProjectWorkspace(projectId: string | null, screen: ActivityId) {
  const currentUser = useCurrentUserQuery();
  const projectQuery = useProjectQuery(projectId);
  const enabled = Boolean(projectId);
  const requirements = QUERY_REQUIREMENTS[screen];
  const hasAssets = requirements.assetScope !== null;
  const assetScope = requirements.assetScope ?? "all";
  const currentUserId = currentUser.data?.id;

  const timelineQuery = useQuery({
    queryKey: ["projects", projectId, "timeline"],
    queryFn: () => productionApi.getTimeline(projectId as string),
    enabled: enabled && requirements.timeline,
  });
  const chaptersQuery = useQuery({
    queryKey: ["projects", projectId, "chapters", timelineQuery.data?.storyVersionId],
    queryFn: () =>
      chaptersApi.listAll(projectId as string, timelineQuery.data?.storyVersionId as string),
    enabled:
      enabled && requirements.chapters && Boolean(timelineQuery.data?.storyVersionId),
  });
  const assetsQuery = useQuery({
    queryKey: assetLibraryQueryKey(currentUserId ?? "anonymous", assetScope),
    queryFn: () => assetsApi.listAll(assetScope),
    enabled: enabled && hasAssets && Boolean(currentUserId),
  });
  const charactersQuery = useQuery({
    queryKey: ["projects", projectId, "characters"],
    queryFn: () => charactersApi.listAll(projectId as string),
    enabled: enabled && requirements.characters,
  });
  const voicesQuery = useQuery({
    queryKey: ["voices"],
    queryFn: voicesApi.list,
    enabled: enabled && requirements.voices,
    staleTime: CATALOG_STALE_TIME_MS,
  });
  const presetsQuery = useQuery({
    queryKey: ["presets"],
    queryFn: presetsApi.list,
    enabled: enabled && requirements.presets,
    staleTime: CATALOG_STALE_TIME_MS,
  });

  const projects = projectQuery.data ? [projectQuery.data] : [];
  const resourceQueries = [
    ...(requirements.timeline ? [timelineQuery] : []),
    ...(requirements.chapters ? [chaptersQuery] : []),
    ...(hasAssets ? [assetsQuery] : []),
    ...(requirements.characters ? [charactersQuery] : []),
    ...(requirements.voices ? [voicesQuery] : []),
    ...(requirements.presets ? [presetsQuery] : []),
  ];
  const queries = [projectQuery, ...resourceQueries];
  const hasPending = queries.some((query) => query.isLoading);
  const firstError = queries.find((query) => query.isError)?.error;
  const hasScreenData =
    resourceQueries.length === 0 || resourceQueries.some((query) => query.isSuccess);
  const timeline = requirements.timeline ? (timelineQuery.data ?? null) : null;

  const workspace: DesktopWorkspaceState = !projectId
    ? { ...emptyWorkspace, projects }
    : {
        status: hasPending
          ? "loading"
          : firstError
            ? timeline
              ? "partial"
              : hasScreenData
                ? "partial"
                : "error"
            : requirements.timeline && !timeline
              ? "empty"
              : "ready",
        projects,
        assets: hasAssets ? (assetsQuery.data ?? []) : [],
        characters: requirements.characters ? (charactersQuery.data ?? []) : [],
        voices: requirements.voices ? (voicesQuery.data ?? []) : [],
        presets: requirements.presets ? (presetsQuery.data ?? []) : [],
        timeline,
        chapters: requirements.chapters ? (chaptersQuery.data ?? []) : [],
        error: firstError instanceof Error ? firstError.message : null,
      };

  return {
    workspace,
    projectsQuery: projectQuery,
    timelineQuery,
    isPending: hasPending,
    isError: Boolean(firstError),
  };
}
