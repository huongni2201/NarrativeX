import { apiRequest } from "@/shared/api/client";
import { type ApiUserQuota, isApiUserQuota } from "../types/user-quota.types";

export const userQuotaApi = {
  get: () => apiRequest<ApiUserQuota>("/api/v1/users/me/quota", {}, isApiUserQuota),
};
