"use client";

import { useQuery } from "@tanstack/react-query";
import { chaptersApi } from "@/features/chapters/api/chapters.api";
import { projectsApi } from "@/features/projects/api/projects.api";
import { queryKeys } from "@/lib/query-keys";
import { ApiClientError, apiErrorMessage } from "@/shared/api/client";
import { LoadingState } from "@/components/ui/LoadingState";
import { StoryboardScreen } from "./StoryboardScreen";

interface ProjectStoryboardScreenProps {
  projectId: string;
}

export function ProjectStoryboardScreen({ projectId }: Readonly<ProjectStoryboardScreenProps>) {
  const projectIdentifier = projectId.trim();
  const validProjectId = projectIdentifier.length > 0;

  const storyQuery = useQuery({
    queryKey: validProjectId ? queryKeys.story(projectIdentifier) : ["storyboard", "invalid-project"],
    queryFn: async () => {
      try {
        return await projectsApi.getLatestStoryVersion(projectIdentifier);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: validProjectId,
  });

  const storyVersionId = storyQuery.data?.id;
  const chaptersQuery = useQuery({
    queryKey: storyVersionId
      ? queryKeys.chapters(projectIdentifier, storyVersionId)
      : ["storyboard", projectIdentifier, "chapters", "empty"],
    queryFn: () => chaptersApi.list(projectIdentifier, storyVersionId!),
    enabled: validProjectId && Boolean(storyVersionId),
  });

  if (!validProjectId) {
    return <StoryboardMessage>Project ID không hợp lệ.</StoryboardMessage>;
  }
  if (storyQuery.isPending || (storyVersionId && chaptersQuery.isPending)) {
    return (
      <LoadingState
        message="Đang tải dữ liệu Storyboard từ backend…"
        className="rounded-xl border border-slate-800 bg-surface-input p-8"
      />
    );
  }
  if (storyQuery.isError) {
    return (
      <StoryboardError error={storyQuery.error} fallback="Không tải được Story Version hiện tại." />
    );
  }
  if (chaptersQuery.isError) {
    return <StoryboardError error={chaptersQuery.error} fallback="Không tải được danh sách Chapter." />;
  }

  return <StoryboardScreen projectId={projectIdentifier} chapters={chaptersQuery.data?.content ?? []} />;
}

function StoryboardMessage({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="rounded-xl border border-slate-800 bg-surface-input p-8 text-sm text-slate-400">
      {children}
    </div>
  );
}

function StoryboardError({ error, fallback }: Readonly<{ error: unknown; fallback: string }>) {
  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-8 text-sm text-rose-200">
      {apiErrorMessage(error, fallback)}
    </div>
  );
}
