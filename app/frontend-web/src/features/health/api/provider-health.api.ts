import { apiRequest } from "@/shared/api/client";
import { type ProviderHealth, isProviderHealth } from "../types/provider-health.types";

export const providerHealthApi = {
  get: () => apiRequest<ProviderHealth>("/api/v1/provider-health", {}, isProviderHealth),
};
