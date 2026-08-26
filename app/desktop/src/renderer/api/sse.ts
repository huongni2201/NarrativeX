import type { DesktopSseEvent } from "../../preload/types";

export interface SseHandlers {
  onEvent(event: DesktopSseEvent): void;
  onError?(message: string): void;
}

export function subscribeSse(
  path: string,
  eventName: string,
  handlers: SseHandlers,
): () => void {
  return window.narrativex.api.subscribe(path, {
    onEvent: (event) => {
      if (event.event === eventName) handlers.onEvent(event);
    },
    onError: handlers.onError,
  });
}
