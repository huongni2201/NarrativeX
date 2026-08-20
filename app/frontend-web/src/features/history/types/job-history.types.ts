export interface JobHistoryItem {
  jobId: string;
  projectId: number | null;
  projectName: string | null;
  jobType: string;
  status: string;
  progress: number;
  currentStep: string | null;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface JobHistoryPage {
  content: JobHistoryItem[];
  nextCursor: string | null;
  limit: number;
  hasNext: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

export function isJobHistoryItem(value: unknown): value is JobHistoryItem {
  return (
    isRecord(value) &&
    isString(value.jobId) &&
    isNullableNumber(value.projectId) &&
    isNullableString(value.projectName) &&
    isString(value.jobType) &&
    isString(value.status) &&
    isNumber(value.progress) &&
    isNullableString(value.currentStep) &&
    isNullableString(value.errorCode) &&
    isString(value.createdAt) &&
    isNullableString(value.completedAt)
  );
}

export function isJobHistoryPage(value: unknown): value is JobHistoryPage {
  return (
    isRecord(value) &&
    Array.isArray(value.content) &&
    value.content.every(isJobHistoryItem) &&
    isNullableString(value.nextCursor) &&
    isNumber(value.limit) &&
    isBoolean(value.hasNext)
  );
}
