export interface UserQuotaLimits {
  watermarkRequired: boolean;
  maxVideoQuality: string;
  maxLongformExportsMonth: number | null;
  maxShortExportsMonth: number | null;
  maxConcurrentExpensiveJobs: number;
  featureFlagsJson: string | null;
}

export interface UserQuotaUsage {
  longformExports: number;
  shortExports: number;
  expensiveJobsActive: number;
  creditsUsed: number | string;
}

export interface ApiUserQuota {
  tier: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  limits: UserQuotaLimits;
  usage: UserQuotaUsage;
  totalCredits: number | string;
  remainingCredits: number | string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNumericOrString(value: unknown): value is number | string {
  return (typeof value === "number" && Number.isFinite(value)) || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

export function isUserQuotaLimits(value: unknown): value is UserQuotaLimits {
  return (
    isRecord(value) &&
    isBoolean(value.watermarkRequired) &&
    isString(value.maxVideoQuality) &&
    isNullableNumber(value.maxLongformExportsMonth) &&
    isNullableNumber(value.maxShortExportsMonth) &&
    isNumber(value.maxConcurrentExpensiveJobs) &&
    isNullableString(value.featureFlagsJson)
  );
}

export function isUserQuotaUsage(value: unknown): value is UserQuotaUsage {
  return (
    isRecord(value) &&
    isNumber(value.longformExports) &&
    isNumber(value.shortExports) &&
    isNumber(value.expensiveJobsActive) &&
    isNumericOrString(value.creditsUsed)
  );
}

export function isApiUserQuota(value: unknown): value is ApiUserQuota {
  return (
    isRecord(value) &&
    isString(value.tier) &&
    isString(value.status) &&
    isString(value.periodStart) &&
    isString(value.periodEnd) &&
    isUserQuotaLimits(value.limits) &&
    isUserQuotaUsage(value.usage) &&
    isNumericOrString(value.totalCredits) &&
    isNumericOrString(value.remainingCredits)
  );
}
