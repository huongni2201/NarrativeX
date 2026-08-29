import { useQuery } from "@tanstack/react-query";
import { narrationApi } from "../../generation/api/narration.api";
import { voicesApi } from "../api/voices.api";

const PREVIEW_URL_REFRESH_SKEW_MS = 60_000;

export function useVoiceReferenceAsset(assetId: string | null) {
  return useQuery({
    queryKey: ["voice-references", assetId ?? "none"],
    queryFn: () => voicesApi.getReference(assetId as string),
    enabled: Boolean(assetId),
    refetchInterval: (current) => {
      const status = current.state.data?.status;
      return status && status !== "READY" && status !== "REJECTED" ? 1_500 : false;
    },
  });
}

export function useVoicePreviewResult(
  projectId: string,
  jobId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["voice-preview-result", projectId, jobId ?? "none"],
    queryFn: () => narrationApi.getPreviewResult(projectId, jobId as string),
    enabled: Boolean(jobId && enabled),
    retry: 2,
    staleTime: 8 * 60_000,
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => {
      const expiresAt = current.state.data?.expiresAt;
      if (!expiresAt) return false;
      const expiresAtMs = Date.parse(expiresAt);
      if (!Number.isFinite(expiresAtMs)) return false;
      return Math.max(expiresAtMs - Date.now() - PREVIEW_URL_REFRESH_SKEW_MS, 1_000);
    },
    refetchIntervalInBackground: false,
  });
}
