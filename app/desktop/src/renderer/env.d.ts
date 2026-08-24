import type { NarrativeXDesktopBridge } from "../preload/types";

declare global {
  interface Window {
    narrativex: NarrativeXDesktopBridge;
  }
}

export {};
