export interface ApiProject {
  id: number;
  name: string;
  status: string;
  sourceLanguage: string;
  narrationLanguage: string;
  metadataLanguage: string;
  imageAspectRatio: string;
  imageQualityTier: string;
  rowVersion: number;
}

export interface ApiStoryVersion {
  id: number;
  projectId: number;
  versionNumber: number;
  status: string;
  moderationDecision: string;
  rightsAttested: boolean;
  rightsPolicyVersion: string;
  rightsBasis: string;
  rightsAttestedAt: string | null;
  contentCharacterCount: number;
}

export interface ApiGenerationJob {
  jobId: string;
  type: string;
  status: string;
  progress: number;
  currentStep: string;
  entityType: string;
  entityId: number;
  errorCode: string | null;
}

export interface ApiAuthUser {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface CreateProjectApiInput {
  name: string;
  sourceLanguage?: string;
  narrationLanguage?: string;
  metadataLanguage?: string;
  imageAspectRatio?: string;
  imageQualityTier?: string;
}

export interface CreateStoryVersionApiInput {
  content: string;
  sourceLanguage?: string;
  rightsAttestationAccepted: boolean;
  rightsPolicyVersion?: string;
  rightsBasis?: string;
}

export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

export type ApiDataGuard<T> = (value: unknown) => value is T;

export interface PaginationResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiFieldError {
  field: string;
  code?: string;
  messageKey?: string;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  status: number;
  code: string;
  message: string;
  path?: string;
  correlationId?: string;
  errors?: ApiFieldError[];
  timestamp: string;
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

export function isApiResponse<T = unknown>(
  value: unknown,
  dataGuard?: ApiDataGuard<T>,
): value is ApiResponse<T> {
  if (
    !isRecord(value) ||
    value.success !== true ||
    !isString(value.message) ||
    !isString(value.timestamp) ||
    !("data" in value)
  ) {
    return false;
  }

  return dataGuard ? dataGuard(value.data) : true;
}

export function isPaginationResponse<T = unknown>(
  value: unknown,
  itemGuard?: ApiDataGuard<T>,
): value is PaginationResponse<T> {
  if (
    !isRecord(value) ||
    !Array.isArray(value.content) ||
    !isNumber(value.page) ||
    !Number.isInteger(value.page) ||
    !isNumber(value.size) ||
    !Number.isInteger(value.size) ||
    !isNumber(value.totalElements) ||
    !Number.isInteger(value.totalElements) ||
    !isNumber(value.totalPages) ||
    !Number.isInteger(value.totalPages) ||
    !isBoolean(value.first) ||
    !isBoolean(value.last) ||
    !isBoolean(value.hasNext) ||
    !isBoolean(value.hasPrevious)
  ) {
    return false;
  }

  return itemGuard ? value.content.every(itemGuard) : true;
}

export function isApiProject(value: unknown): value is ApiProject {
  return (
    isRecord(value) &&
    isNumber(value.id) &&
    isString(value.name) &&
    isString(value.status) &&
    isString(value.sourceLanguage) &&
    isString(value.narrationLanguage) &&
    isString(value.metadataLanguage) &&
    isString(value.imageAspectRatio) &&
    isString(value.imageQualityTier) &&
    isNumber(value.rowVersion)
  );
}

export function isApiStoryVersion(value: unknown): value is ApiStoryVersion {
  return (
    isRecord(value) &&
    isNumber(value.id) &&
    isNumber(value.projectId) &&
    isNumber(value.versionNumber) &&
    isString(value.status) &&
    isString(value.moderationDecision) &&
    isBoolean(value.rightsAttested) &&
    isString(value.rightsPolicyVersion) &&
    isString(value.rightsBasis) &&
    (value.rightsAttestedAt === null || isString(value.rightsAttestedAt)) &&
    isNumber(value.contentCharacterCount)
  );
}

export function isApiGenerationJob(value: unknown): value is ApiGenerationJob {
  return (
    isRecord(value) &&
    isString(value.jobId) &&
    isString(value.type) &&
    isString(value.status) &&
    isNumber(value.progress) &&
    isString(value.currentStep) &&
    isString(value.entityType) &&
    isNumber(value.entityId) &&
    (value.errorCode === null || isString(value.errorCode))
  );
}

export function isApiAuthUser(value: unknown): value is ApiAuthUser {
  return (
    isRecord(value) &&
    isString(value.id) &&
    (value.displayName === null || isString(value.displayName)) &&
    (value.email === null || isString(value.email)) &&
    (value.avatarUrl === null || isString(value.avatarUrl))
  );
}

export function isApiFieldError(value: unknown): value is ApiFieldError {
  return (
    isRecord(value) &&
    isString(value.field) &&
    (value.code === undefined || isString(value.code)) &&
    (value.messageKey === undefined || isString(value.messageKey)) &&
    (value.message === undefined || isString(value.message))
  );
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  if (
    !isRecord(value) ||
    value.success !== false ||
    !isNumber(value.status) ||
    !isString(value.code) ||
    !isString(value.message) ||
    !isString(value.timestamp)
  ) {
    return false;
  }

  return value.errors === undefined ||
    (Array.isArray(value.errors) && value.errors.every(isApiFieldError));
}
