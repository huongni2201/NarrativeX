export type WhisperXEvidenceStatus = "NO_DATA" | "PASSED" | "WARNING" | "FAILED";

export function whisperXEvidenceStatus(
  summary?: { status?: string | null; timingMatch?: boolean | null } | null,
): WhisperXEvidenceStatus {
  if (!summary) return "NO_DATA";
  if (summary.status === "FAILED" || summary.timingMatch === false) return "FAILED";
  if (summary.status === "WARNING") return "WARNING";
  if (summary.status === "PASSED" && summary.timingMatch === true) return "PASSED";
  return "NO_DATA";
}
