import { useQuery } from "@tanstack/react-query";
import type {
  DesktopAsset,
  DesktopCharacter,
  DesktopChapterDetails,
  DesktopPreset,
  DesktopProject,
  DesktopRenderJob,
  DesktopTimeline,
  DesktopVoice,
} from "@narrativex/client-contracts";
import { assetsApi } from "../../assets/api/assets.api";
import { chaptersApi } from "../../chapters/api/chapters.api";
import { charactersApi } from "../../characters/api/characters.api";
import { presetsApi } from "../../presets/api/presets.api";
import { productionApi } from "../../production/api/production.api";
import { useProjectsQuery } from "../../projects/queries/projects.queries";
import { voicesApi } from "../../voices/api/voices.api";

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

export function useProjectWorkspace(projectId: string | null) {
  const projectsQuery = useProjectsQuery();
  const enabled = Boolean(projectId);

  const timelineQuery = useQuery({
    queryKey: ["projects", projectId, "timeline"],
    queryFn: () => productionApi.getTimeline(projectId as string),
    enabled,
  });

  const chaptersQuery = useQuery({
    queryKey: ["projects", projectId, "chapters", timelineQuery.data?.storyVersionId],
    queryFn: () =>
      chaptersApi.list(projectId as string, timelineQuery.data?.storyVersionId as string),
    enabled: enabled && Boolean(timelineQuery.data?.storyVersionId),
  });

  const assetsQuery = useQuery({
    queryKey: ["assets", "library"],
    queryFn: () => assetsApi.list(),
    enabled,
  });

  const charactersQuery = useQuery({
    queryKey: ["projects", projectId, "characters"],
    queryFn: () => charactersApi.list(projectId as string),
    enabled,
  });

  const voicesQuery = useQuery({
    queryKey: ["voices"],
    queryFn: voicesApi.list,
    enabled,
  });

  const presetsQuery = useQuery({
    queryKey: ["presets"],
    queryFn: presetsApi.list,
    enabled,
  });

  const projects = projectsQuery.data?.content ?? [];
  const queries = [
    projectsQuery,
    timelineQuery,
    assetsQuery,
    charactersQuery,
    voicesQuery,
    presetsQuery,
    chaptersQuery,
  ];
  const hasPending = queries.some((query) => query.isPending);
  const timeline = timelineQuery.data ?? null;
  const firstError = queries.find((query) => query.isError)?.error;

  const workspace: DesktopWorkspaceState = !projectId
    ? { ...emptyWorkspace, projects }
    : {
        status: hasPending
          ? "loading"
          : timeline
            ? "ready"
            : firstError
              ? "partial"
              : "empty",
        projects,
        assets: assetsQuery.data?.items ?? [],
        characters: charactersQuery.data?.content ?? [],
        voices: voicesQuery.data ?? [],
        presets: presetsQuery.data ?? [],
        timeline,
        chapters: chaptersQuery.data?.content ?? [],
        error: firstError instanceof Error ? firstError.message : null,
      };

  return {
    workspace,
    projectsQuery,
    timelineQuery,
    isPending: hasPending,
    isError: Boolean(firstError),
  };
}

export type DesktopRenderState = DesktopRenderJob | null;
