import type { WebContents } from "electron";
import type { DesktopBackendApiService, DesktopSseEvent } from "./backend-api-service";
import {
  registerTrustedIpcHandlerWithEvent,
  type RendererTrustPolicy,
} from "../security/renderer-security";

const SSE_EVENT_CHANNEL = "desktop:api:sse:event";
const SSE_ERROR_CHANNEL = "desktop:api:sse:error";
const RECONNECT_DELAY_MS = 1_500;
const GENERATION_EVENTS_PATH = /^\/api\/v1\/generation-jobs\/[0-9a-f-]{36}\/events$/iu;
const SUBSCRIPTION_ID = /^[0-9a-f-]{36}$/iu;
const TERMINAL_JOB_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELED"]);

interface StartSseInput {
  subscriptionId: string;
  path: string;
}

interface StopSseInput {
  subscriptionId: string;
}

interface ActiveSubscription {
  senderId: number;
  controller: AbortController;
}

export function registerBackendSseIpc(
  policy: RendererTrustPolicy,
  apiProvider: () => DesktopBackendApiService,
): void {
  const subscriptions = new Map<string, ActiveSubscription>();
  const trackedSenders = new Set<number>();

  const stop = (subscriptionId: string, senderId?: number) => {
    const active = subscriptions.get(subscriptionId);
    if (!active || (senderId !== undefined && active.senderId !== senderId)) return false;
    subscriptions.delete(subscriptionId);
    active.controller.abort();
    return true;
  };

  const stopForSender = (senderId: number) => {
    for (const [subscriptionId, active] of subscriptions) {
      if (active.senderId === senderId) stop(subscriptionId, senderId);
    }
    trackedSenders.delete(senderId);
  };

  registerTrustedIpcHandlerWithEvent("desktop:api:sse:start", policy, (event, input) => {
    if (!isStartSseInput(input)) throw new Error("Invalid desktop SSE subscription request.");
    if (subscriptions.has(input.subscriptionId)) {
      throw new Error("Desktop SSE subscription id is already active.");
    }

    const senderId = event.sender.id;
    const controller = new AbortController();
    subscriptions.set(input.subscriptionId, { senderId, controller });

    if (!trackedSenders.has(senderId)) {
      trackedSenders.add(senderId);
      event.sender.once("destroyed", () => stopForSender(senderId));
    }

    void runSubscription(
      apiProvider,
      event.sender,
      input,
      controller.signal,
      () => subscriptions.get(input.subscriptionId)?.controller === controller,
    ).finally(() => {
      const active = subscriptions.get(input.subscriptionId);
      if (active?.controller === controller) subscriptions.delete(input.subscriptionId);
    });

    return true;
  });

  registerTrustedIpcHandlerWithEvent("desktop:api:sse:stop", policy, (event, input) => {
    if (!isStopSseInput(input)) throw new Error("Invalid desktop SSE unsubscribe request.");
    return stop(input.subscriptionId, event.sender.id);
  });
}

async function runSubscription(
  apiProvider: () => DesktopBackendApiService,
  sender: WebContents,
  input: StartSseInput,
  signal: AbortSignal,
  isCurrent: () => boolean,
): Promise<void> {
  while (!signal.aborted && isCurrent() && !sender.isDestroyed()) {
    let terminalSnapshotSeen = false;
    try {
      await apiProvider().streamEvents(
        input.path,
        (event) => {
          sendEvent(sender, input.subscriptionId, event);
          if (isTerminalGenerationSnapshot(event)) terminalSnapshotSeen = true;
        },
        signal,
      );
    } catch (error) {
      if (signal.aborted || sender.isDestroyed() || !isCurrent()) return;
      sender.send(SSE_ERROR_CHANNEL, {
        subscriptionId: input.subscriptionId,
        message: error instanceof Error ? error.message : "Backend event stream failed.",
      });
    }

    if (terminalSnapshotSeen || signal.aborted || sender.isDestroyed() || !isCurrent()) return;
    await abortableDelay(RECONNECT_DELAY_MS, signal);
  }
}

function sendEvent(sender: WebContents, subscriptionId: string, event: DesktopSseEvent): void {
  if (sender.isDestroyed()) return;
  sender.send(SSE_EVENT_CHANNEL, { subscriptionId, event });
}

function isTerminalGenerationSnapshot(event: DesktopSseEvent): boolean {
  if (event.event !== "snapshot") return false;
  try {
    const payload = JSON.parse(event.data) as { status?: unknown };
    return typeof payload.status === "string" && TERMINAL_JOB_STATUSES.has(payload.status);
  } catch {
    return false;
  }
}

function abortableDelay(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, delayMs);
    signal.addEventListener("abort", finish, { once: true });
  });
}

function isStartSseInput(value: unknown): value is StartSseInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.subscriptionId === "string" &&
    SUBSCRIPTION_ID.test(input.subscriptionId) &&
    typeof input.path === "string" &&
    GENERATION_EVENTS_PATH.test(input.path)
  );
}

function isStopSseInput(value: unknown): value is StopSseInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.subscriptionId === "string" && SUBSCRIPTION_ID.test(input.subscriptionId);
}
