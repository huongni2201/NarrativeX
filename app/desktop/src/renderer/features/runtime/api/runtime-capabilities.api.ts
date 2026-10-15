import type { RuntimeCapabilityView } from "../../../../shared/api-types";
import { apiRequest } from "../../../api/client.ts";

export const runtimeCapabilitiesApi = {
  getCapabilities: () => apiRequest<RuntimeCapabilityView>("/api/v1/runtime/capabilities"),
};
