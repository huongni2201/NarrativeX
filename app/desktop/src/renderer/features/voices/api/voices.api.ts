import type { DesktopVoice } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";
import { assertContract, isNullableString, isNumber, isRecord, isString } from "../../../api/guards";

function isVoice(value: unknown): value is DesktopVoice {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.provider) &&
    isString(value.name) &&
    isString(value.language) &&
    isNullableString(value.gender) &&
    isNullableString(value.sampleUrl)
  );
}

export interface VoiceReferenceAsset {
  id: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  status: string;
}

function isVoiceReferenceAsset(value: unknown): value is VoiceReferenceAsset {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.originalFilename) &&
    isString(value.contentType) &&
    isNumber(value.sizeBytes) &&
    isString(value.sha256) &&
    isString(value.status)
  );
}

export const voicesApi = {
  list: () =>
    apiRequest<unknown>("/api/v1/voices").then((value) => {
      assertContract(
        Array.isArray(value) && value.every(isVoice),
        "Voices response không đúng contract.",
      );
      return value;
    }),
  getReference: (assetId: string) =>
    apiRequest<unknown>(`/api/v1/voice-references/${encodeURIComponent(assetId)}`).then((value) => {
      assertContract(isVoiceReferenceAsset(value), "Voice reference response không đúng contract.");
      return value;
    }),
};
