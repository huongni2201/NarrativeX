import type { RuntimeCapabilityView } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client.ts";

export const runtimeCapabilitiesApi = {
  getCapabilities: () => apiRequest<RuntimeCapabilityView>("/api/v1/runtime/capabilities"),
};
