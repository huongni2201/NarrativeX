import type { DesktopProviderHealth } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client.ts";

export const healthApi = {
  getProviderHealth: () => apiRequest<DesktopProviderHealth>("/api/v1/provider-health"),
};