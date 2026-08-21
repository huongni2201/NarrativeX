import { apiRequest } from "@/shared/api/client";

export interface ApiMediaAsset {
  id: string;
  type: "AUDIO" | "IMAGE" | "VIDEO";
  origin: string;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  durationMs: number | null;
  status: string;
  createdAt: string;
}

function isApiMediaAsset(value: unknown): value is ApiMediaAsset {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ApiMediaAsset>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.originalFilename === "string" &&
    typeof candidate.status === "string"
  );
}

export const assetsApi = {
  list: (params: { type?: string; status?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    return apiRequest<ApiMediaAsset[]>(
      `/api/v1/assets${query.size ? `?${query.toString()}` : ""}`,
      {},
      (value): value is ApiMediaAsset[] => Array.isArray(value) && value.every(isApiMediaAsset),
    );
  },
  approve: (id: string) =>
    apiRequest<ApiMediaAsset>(`/api/v1/assets/${encodeURIComponent(id)}/approve`, { method: "POST" }, isApiMediaAsset),
  delete: (id: string) =>
    apiRequest<void>(`/api/v1/assets/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
