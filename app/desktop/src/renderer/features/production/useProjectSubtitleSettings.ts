import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectSubtitleSettings, SubtitleStyle } from "../../../shared/api-types";
import { DEFAULT_SUBTITLE_STYLE } from "../../../shared/subtitle-style";
import { productionApi } from "./api/production.api";
import { cacheSavedSubtitleSettings } from "./subtitle-settings-cache";
import { DesktopApiError } from "../../api/client";

const key = (projectId: string) => ["project-subtitle-settings", projectId] as const;
const defaults: ProjectSubtitleSettings = { enabled: true, style: DEFAULT_SUBTITLE_STYLE };

export function useProjectSubtitleSettings(projectId: string) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<{ projectId: string; settings: ProjectSubtitleSettings } | null>(null);
  const query = useQuery({
    queryKey: key(projectId), queryFn: () => productionApi.getSubtitleSettings(projectId),
    enabled: Boolean(projectId), retry: 1,
  });
  const settings = draft?.projectId === projectId ? draft.settings : query.data ?? defaults;
  const mutation = useMutation({
    mutationFn: (input: { projectId: string; settings: ProjectSubtitleSettings }) =>
      productionApi.saveSubtitleSettings(input.projectId, input.settings),
    onSuccess: async (saved, input) => {
      await cacheSavedSubtitleSettings(client, input.projectId, saved);
      setDraft((current) => current?.projectId === input.projectId &&
        JSON.stringify(current.settings) === JSON.stringify(input.settings) ? null : current);
    },
  });

  function update(patch: Partial<ProjectSubtitleSettings>) {
    if (!query.isSuccess || mutation.isPending) return;
    mutation.reset();
    setDraft({ projectId, settings: { ...settings, ...patch } });
  }

  const save = async (submitted = settings) => {
    if (!query.isSuccess) throw new Error("Chưa tải được tùy chỉnh phụ đề của Project.");
    return mutation.mutateAsync({ projectId, settings: submitted });
  };
  const error = query.error ?? (mutation.variables?.projectId === projectId ? mutation.error : null);
  const errorMessage = !error ? null : error instanceof DesktopApiError ? error.message : query.error
    ? "Không thể tải tùy chỉnh phụ đề. Kiểm tra kết nối backend rồi thử lại."
    : "Chưa lưu được tùy chỉnh phụ đề. Thay đổi vẫn được giữ; hãy kiểm tra kết nối và lưu lại.";

  return {
    subtitleSettings: settings,
    subtitlesEnabled: settings.enabled,
    subtitleStyle: settings.style,
    setSubtitlesEnabled: (enabled: boolean) => update({ enabled }),
    setSubtitleStyle: (style: SubtitleStyle) => update({ style }),
    resetSubtitleStyle: () => update({ style: { ...DEFAULT_SUBTITLE_STYLE } }),
    subtitleSettingsReady: query.isSuccess,
    subtitleSettingsLoading: query.isPending,
    subtitleSettingsSaving: mutation.isPending,
    subtitleSettingsDirty: Boolean(draft?.projectId === projectId && JSON.stringify(settings) !== JSON.stringify(query.data)),
    subtitleSettingsError: errorMessage,
    retrySubtitleSettings: () => void query.refetch(),
    saveSubtitleSettings: save,
  };
}
