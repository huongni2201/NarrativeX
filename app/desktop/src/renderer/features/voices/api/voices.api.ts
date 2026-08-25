import type { DesktopVoice } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";
import { assertContract, isRecord, isString } from "../../../api/guards";

function isVoice(value: unknown): value is DesktopVoice {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.language)
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
};
