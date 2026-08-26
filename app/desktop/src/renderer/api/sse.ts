export interface SseHandlers {
  onEvent(event: MessageEvent<string>): void;
  onError?(error: Event): void;
}

let backendBaseUrlPromise: Promise<string> | null = null;

function backendBaseUrl(): Promise<string> {
  backendBaseUrlPromise ??= window.narrativex.localExecution
    .status()
    .then((status) => status.backendBaseUrl)
    .catch((error) => {
      backendBaseUrlPromise = null;
      throw error;
    });
  return backendBaseUrlPromise;
}

export function subscribeSse(
  path: string,
  eventName: string,
  handlers: SseHandlers,
): () => void {
  let closed = false;
  let source: EventSource | null = null;

  void backendBaseUrl()
    .then((baseUrl) => {
      if (closed) return;
      const url = new URL(path, baseUrl);
      source = new EventSource(url.toString(), { withCredentials: true });
      source.addEventListener(eventName, handlers.onEvent as EventListener);
      if (handlers.onError) source.addEventListener("error", handlers.onError);
    })
    .catch(() => {
      if (!closed) handlers.onError?.(new Event("error"));
    });

  return () => {
    closed = true;
    if (!source) return;
    source.removeEventListener(eventName, handlers.onEvent as EventListener);
    if (handlers.onError) source.removeEventListener("error", handlers.onError);
    source.close();
    source = null;
  };
}
