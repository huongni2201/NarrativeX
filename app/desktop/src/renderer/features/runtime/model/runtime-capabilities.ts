import type {
  GenerationStrategy,
  RuntimeCapabilityView,
  VideoRuntimeCapability,
} from "@narrativex/client-contracts";

export type { RuntimeCapabilityView, VideoRuntimeCapability };

export const DEFAULT_FALLBACK_CAPABILITY: VideoRuntimeCapability = {
  available: true,
  provider: "ltx",
  model: "ltx-2.5-nvfp4",
  profile: "ltx-2.5-22b-distilled-int8-native-av-v1",
  strategies: ["TEXT_TO_VIDEO"],
  supportedAspectRatios: ["16:9"],
  resolutionProfiles: [{ width: 1280, height: 720, fps: 24 }],
  audioModes: ["LTX_NATIVE_AV"],
};

export function isStrategySupported(
  strategy: GenerationStrategy,
  capability?: VideoRuntimeCapability | null,
): boolean {
  if (!capability || !capability.strategies || capability.strategies.length === 0) {
    return strategy === "TEXT_TO_VIDEO";
  }
  return capability.strategies.includes(strategy);
}
