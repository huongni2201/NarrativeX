import type { ApiResponse } from "@narrativex/client-contracts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks only the envelope. Feature payloads remain unknown until their caller validates them. */
export function parseSuccessEnvelope(bodyText: string): ApiResponse<unknown> {
  const value: unknown = JSON.parse(bodyText);
  if (!isRecord(value) || value.success !== true || typeof value.message !== "string" || typeof value.timestamp !== "string") {
    throw new Error("Invalid API success envelope.");
  }
  return value as unknown as ApiResponse<unknown>;
}
