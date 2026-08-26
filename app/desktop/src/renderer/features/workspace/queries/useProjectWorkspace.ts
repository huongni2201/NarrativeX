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
import { assetsApi } from "../../assets/api/assets.api";
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
  assets: boolean;
  characters: boolean;
  voices: boolean;
  presets: boolean;
}>;

const QUERY_REQUIREMENTS: Record<ActivityId, WorkspaceQueryRequirements> = {
  editor: {
    timeline: true,
    chapters: false,
    assets: true,
    characters: false,
    voices: false,
    presets: false,
  },
  chapters: {
    timeline: true,
    chapters: true,
    assets: false,
    characters: false,
    voices: true,
    presets: false,
  },
  characters: {
    timeline: false,
    chapters: false,
    assets: false,
    characters: true,
    voices: false,
    presets: false,
  },
  images: {
    timeline: true,
    chapters: true,
    assets: false,
    characters: false,
    voices: false,
    presets: false,
  },
  voice: {
    timeline: true,
    chapters: true,
    assets: true,
    characters: false,
    voices: true,
    presets: false,
  },
  assets: {
    timeline: false,
    chapters: false,
    assets: true,
    characters: false,
    voices: false,
    presets: false,
  },
  render: {
    timeline: true,
    chapters: false,
    assets: false,
    characters: false,
    voices: false,
    presets: false,
  },
  settings: {
    timeline: false,
    chapters: false,
    assets: true,
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
  const projectQuery = useProjectQuery(projectId);
  const enabled = Boolean(projectId);
  const requirements = QUERY_REQUIREMENTS[screen];

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
    queryKey: ["assets", "library"],
    queryFn: assetsApi.listAll,
    enabled: enabled && requirements.assets,
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
  });
  const presetsQuery = useQuery({
    queryKey: ["presets"],
    queryFn: presetsApi.list,
    enabled: enabled && requirements.presets,
  });

  const projects = projectQuery.data ? [projectQuery.data] : [];
  const resourceQueries = [
    ...(requirements.timeline ? [timelineQuery] : []),
    ...(requirements.chapters ? [chaptersQuery] : []),
    ...(requirements.assets ? [assetsQuery] : []),
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
        assets: requirements.assets ? (assetsQuery.data ?? []) : [],
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
