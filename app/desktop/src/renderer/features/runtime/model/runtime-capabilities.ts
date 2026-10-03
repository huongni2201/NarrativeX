import type {
  GenerationStrategy,
  RuntimeCapabilityStatus,
  RuntimeCapabilityView,
  VideoRuntimeCapability,
} from "@narrativex/client-contracts";

export type { RuntimeCapabilityStatus, RuntimeCapabilityView, VideoRuntimeCapability };

export const DEFAULT_FALLBACK_CAPABILITY: VideoRuntimeCapability = {
  available: false,
  status: "UNAVAILABLE",
  provider: "ltx",
  model: "ltx-2.5-22b-distilled-int8",
  profile: "ltx-2.5-22b-distilled-int8-native-av-v1",
  strategies: [],
  supportedAspectRatios: [],
  resolutionProfiles: [],
  audioModes: [],
  reason: "Runtime capability unavailable or worker offline",
};

export function isStrategySupported(
  strategy: GenerationStrategy,
  capability?: VideoRuntimeCapability | null,
): boolean {
  if (
    !capability ||
    !capability.available ||
    !capability.strategies ||
    capability.strategies.length === 0
  ) {
    return false;
  }
  return capability.strategies.includes(strategy);
}
