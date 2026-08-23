import { apiRequest } from "@/shared/api/client";
import { isRenderArtifact, type RenderArtifact } from "./artifacts.types";

export const artifactsApi = {
  getByJobId: (jobId: string) =>
    apiRequest<RenderArtifact>(
      `/api/v1/artifacts/by-job/${encodeURIComponent(jobId)}`,
      {},
      isRenderArtifact,
    ),
  getById: (id: number | string) =>
    apiRequest<RenderArtifact>(
      `/api/v1/artifacts/${encodeURIComponent(String(id))}`,
      {},
      isRenderArtifact,
    ),
};

export const renderArtifactsApi = artifactsApi;
