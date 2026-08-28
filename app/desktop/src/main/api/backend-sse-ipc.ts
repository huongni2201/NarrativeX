import { dialog, session, type WebContents } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
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
const MAX_VOICE_REFERENCE_BYTES = 50 * 1024 * 1024;

type BackendRequestOptions = Omit<
  Parameters<DesktopBackendApiService["request"]>[0],
  "path"
>;

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

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data?: T;
}

interface CsrfTokenData {
  token: string;
  headerName: string;
}

interface UploadIntentData {
  id: string;
  uploadUrl: string | null;
  uploadHeaders: Record<string, string>;
  status: string;
}

interface UploadFinalizeData {
  status: string;
  mediaAssetId: string | null;
}

export interface VoiceReferenceUploadResult {
  assetId: string;
  status: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
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

  registerVoiceReferenceUploadIpc(policy, apiProvider);
}

function registerVoiceReferenceUploadIpc(
  policy: RendererTrustPolicy,
  apiProvider: () => DesktopBackendApiService,
): void {
  registerTrustedIpcHandlerWithEvent(
    "desktop:api:upload-voice-reference",
    policy,
    async () => {
      const selected = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "Voice reference", extensions: ["mp3", "wav"] }],
      });
      const sourcePath = selected.filePaths[0];
      if (selected.canceled || !sourcePath) return null;

      const extension = extname(sourcePath).toLowerCase();
      const contentType = extension === ".wav" ? "audio/wav" : extension === ".mp3" ? "audio/mpeg" : null;
      if (!contentType) throw new Error("Voice reference chỉ hỗ trợ MP3 hoặc WAV.");

      const fileInfo = await stat(sourcePath);
      if (!fileInfo.isFile() || fileInfo.size <= 0) {
        throw new Error("Voice reference phải là file audio không rỗng.");
      }
      if (fileInfo.size > MAX_VOICE_REFERENCE_BYTES) {
        throw new Error("Voice reference vượt quá giới hạn 50MB.");
      }

      const bytes = await readFile(sourcePath);
      const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
      const originalFilename = basename(sourcePath);
      const idempotencyKey = `desktop-voice-${randomUUID()}`;
      const api = apiProvider();
      const csrf = await backendData<CsrfTokenData>(
        api,
        "/api/v1/auth/csrf",
        { method: "GET", headers: { Accept: "application/json" } },
      );
      const mutationHeaders = {
        Accept: "application/json",
        "Content-Type": "application/json",
        [csrf.headerName]: csrf.token,
      };

      const intent = await backendData<UploadIntentData>(
        api,
        "/api/v1/voice-references/upload-intents",
        {
          method: "POST",
          headers: { ...mutationHeaders, "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({
            type: "AUDIO",
            originalFilename,
            contentType,
            expectedSizeBytes: fileInfo.size,
            expectedSha256: checksumSha256,
          }),
          timeoutMs: 30_000,
        },
      );

      if (intent.uploadUrl) {
        const uploadUrl = validatePresignedUploadUrl(intent.uploadUrl);
        const uploadHeaders = new Headers(intent.uploadHeaders ?? {});
        if (!uploadHeaders.has("Content-Type")) uploadHeaders.set("Content-Type", contentType);
        const response = await session.defaultSession.fetch(uploadUrl.toString(), {
          method: "PUT",
          headers: uploadHeaders,
          body: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
          redirect: "error",
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(
            `Voice reference upload failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
          );
        }
      } else if (intent.status !== "READY") {
        throw new Error("Backend upload intent không cung cấp upload URL hợp lệ.");
      }

      const finalized = await backendData<UploadFinalizeData>(
        api,
        `/api/v1/voice-references/upload-intents/${encodeURIComponent(intent.id)}/finalize`,
        {
          method: "POST",
          headers: mutationHeaders,
          body: "{}",
          timeoutMs: 30_000,
        },
      );
      if (finalized.status === "REJECTED" || !finalized.mediaAssetId) {
        throw new Error("Voice reference bị từ chối khi backend xác minh file upload.");
      }

      return {
        assetId: finalized.mediaAssetId,
        status: finalized.status,
        originalFilename,
        contentType,
        sizeBytes: fileInfo.size,
        checksumSha256,
      } satisfies VoiceReferenceUploadResult;
    },
  );
}

async function backendData<T>(
  api: DesktopBackendApiService,
  path: string,
  request: BackendRequestOptions,
): Promise<T> {
  const response = await api.request({ ...request, path });
  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = JSON.parse(response.bodyText) as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }
  if (response.status < 200 || response.status >= 300 || !envelope?.success || envelope.data === undefined) {
    throw new Error(envelope?.message || response.statusText || `Backend request failed: ${path}`);
  }
  return envelope.data;
}

function validatePresignedUploadUrl(value: string): URL {
  const url = new URL(value);
  if (url.username || url.password) throw new Error("Presigned upload URL must not contain credentials.");
  if (url.protocol === "https:") return url;
  const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol === "http:" && localHost) return url;
  throw new Error("Presigned upload URL must use HTTPS.");
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
