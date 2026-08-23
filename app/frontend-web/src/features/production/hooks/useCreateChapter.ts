import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { chaptersApi } from "@/features/chapters/api/chapters.api";
import { queryKeys } from "@/lib/query-keys";
import { apiErrorMessage } from "@/shared/api/client";
import type { CreateChapterInput } from "../components/CreateChapterModal";
import type { ProjectId } from "@/types/api";

export function useCreateChapter(
  projectId: ProjectId,
  options: Readonly<{ onCreated?: () => void }> = {},
) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ title, sourceText }: CreateChapterInput) =>
      chaptersApi.create(projectId, {
        title: title.trim(),
        sourceText: sourceText.trim(),
      }),
    onSuccess: (createdChapter) => {
      options.onCreated?.();
      queryClient.invalidateQueries({ queryKey: queryKeys.projectOverview(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      router.push(`/projects/${projectId}/chapters/${createdChapter.id}`);
    },
  });

  const submit = (input: CreateChapterInput) => mutation.mutate(input);

  return {
    ...mutation,
    errorMessage: mutation.error ? apiErrorMessage(mutation.error, "Không thể tạo Chapter.") : null,
    submit,
  };
}
