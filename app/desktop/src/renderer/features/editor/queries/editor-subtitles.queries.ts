import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DesktopTimeline } from "@narrativex/client-contracts";
import { planSubtitles, type PlannedSubtitle } from "../../../../shared/subtitle-planner";
import { chaptersApi } from "../../chapters/api/chapters.api";

export function useEditorSubtitles({
  projectId,
  storyVersionId,
  chapters,
}: Readonly<{
  projectId: string | null;
  storyVersionId: string | null;
  chapters: DesktopTimeline["chapters"];
}>): { cues: PlannedSubtitle[]; loading: boolean } {
  const needsSubtitleTextSource = chapters.some((chapter) => !chapter.subtitleText?.trim());
  const sources = useQuery({
    queryKey: ["editor", "subtitle-sources", projectId ?? "none", storyVersionId ?? "none"],
    queryFn: () => chaptersApi.listAll(projectId as string, storyVersionId as string),
    enabled: Boolean(projectId && storyVersionId && chapters.length && needsSubtitleTextSource),
    staleTime: 60_000,
  });

  const cues = useMemo(() => {
    const textByChapter = new Map(
      (sources.data ?? []).map((chapter) => [chapter.id, chapter.sourceText]),
    );
    return planSubtitles(
      chapters.flatMap((chapter) => {
        const subtitleText = chapter.subtitleText ?? textByChapter.get(chapter.chapterId);
        if (!subtitleText?.trim()) return [];
        return [{
          chapterId: chapter.chapterId,
          globalStartMs: chapter.startMs,
          globalEndMs: chapter.endMs,
          subtitleText,
          subtitleWordsJson: chapter.subtitleWordsJson ?? null,
        }];
      }),
    );
  }, [chapters, sources.data]);

  return { cues, loading: needsSubtitleTextSource && sources.isLoading };
}
