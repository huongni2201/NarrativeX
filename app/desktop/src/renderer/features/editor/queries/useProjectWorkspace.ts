import { useQuery } from "@tanstack/react-query";
import type { DesktopAsset, DesktopCharacter, DesktopPreset, DesktopProject, DesktopRenderJob, DesktopTimeline, DesktopVoice } from "@narrativex/client-contracts";
import { workspaceApi } from "../../../api/workspace";
import { projectQueryKeys } from "../../projects/queries/projects.queries";

export interface DesktopWorkspaceState {
  status: "loading" | "ready" | "partial" | "empty" | "error";
  projects: DesktopProject[];
  assets: DesktopAsset[];
  characters: DesktopCharacter[];
  voices: DesktopVoice[];
  presets: DesktopPreset[];
  timeline: DesktopTimeline | null;
  error: string | null;
}

const emptyWorkspace: DesktopWorkspaceState = {
  status: "empty", projects: [], assets: [], characters: [], voices: [], presets: [], timeline: null, error: null,
};

export function useProjectWorkspace(projectId: string | null) {
  const projectsQuery = useQuery({ queryKey: projectQueryKeys.list(), queryFn: workspaceApi.listProjects });
  const enabled = Boolean(projectId);
  const timelineQuery = useQuery({ queryKey: ["projects", projectId, "timeline"], queryFn: () => workspaceApi.getTimeline(projectId as string), enabled });
  const assetsQuery = useQuery({ queryKey: ["assets", "library"], queryFn: workspaceApi.listAssets, enabled });
  const charactersQuery = useQuery({ queryKey: ["projects", projectId, "characters"], queryFn: () => workspaceApi.listCharacters(projectId as string), enabled });
  const voicesQuery = useQuery({ queryKey: ["voices"], queryFn: workspaceApi.listVoices, enabled });
  const presetsQuery = useQuery({ queryKey: ["presets"], queryFn: workspaceApi.listPresets, enabled });

  const projects = projectsQuery.data?.content ?? [];
  const hasPending = [projectsQuery, timelineQuery, assetsQuery, charactersQuery, voicesQuery, presetsQuery].some((query) => query.isPending);
  const timeline = timelineQuery.data ?? null;
  const firstError = [projectsQuery, timelineQuery, assetsQuery, charactersQuery, voicesQuery, presetsQuery].find((query) => query.isError)?.error;
  const workspace: DesktopWorkspaceState = !projectId
    ? { ...emptyWorkspace, projects }
    : { status: hasPending ? "loading" : timeline ? "ready" : firstError ? "partial" : "empty", projects, assets: assetsQuery.data?.items ?? [], characters: charactersQuery.data?.content ?? [], voices: voicesQuery.data ?? [], presets: presetsQuery.data ?? [], timeline, error: firstError instanceof Error ? firstError.message : null };

  return { workspace, projectsQuery, timelineQuery, isPending: hasPending, isError: Boolean(firstError) };
}

export type DesktopRenderState = DesktopRenderJob | null;
