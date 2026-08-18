export type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface ApiProject {
  id: number;
  name: string;
  status: ProjectStatus;
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
  contentCharacterCount: number;
}

export interface ApiChapterSummary {
  id: number;
  storyVersionId: number;
  orderIndex: number;
  title: string;
  sourceHash: string;
  rowVersion: number;
}

export interface ApiChapter extends ApiChapterSummary {
  sourceText: string;
}

export interface ApiChapterWorkspaceSummary {
  sceneCount: number;
  visualBeatCount: number;
  estimatedDurationSeconds: number;
}

export interface ApiChapterWorkspacePipelineStep {
  status: string;
  completedAt: string | null;
}

export interface ApiChapterWorkspaceProgressStep {
  status: string;
  total: number;
  completed: number;
  failed: number;
}

export interface ApiChapterWorkspacePreviewScene {
  id: number;
  orderIndex: number;
  title: string;
  durationSeconds: number | null;
  status: string;
  visualBeatCount: number;
  previewImageUrl: string | null;
}

export interface ApiChapterWorkspace {
  chapter: ApiChapter;
  projectName: string;
  summary: ApiChapterWorkspaceSummary;
  pipeline: {
    analysis: ApiChapterWorkspacePipelineStep;
    visualPlanning: ApiChapterWorkspacePipelineStep;
    visualGeneration: ApiChapterWorkspaceProgressStep;
    audio: ApiChapterWorkspacePipelineStep;
    render: ApiChapterWorkspacePipelineStep;
    sourceOutdated: boolean;
  };
  previewScenes: ApiChapterWorkspacePreviewScene[];
  capabilities: {
    canAnalyze: boolean;
    canGenerateVisuals: boolean;
    canGenerateAudio: boolean;
    canRender: boolean;
  };
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
}

export interface CreateChapterApiInput {
  storyVersionId: number;
  orderIndex: number;
  title: string;
  sourceText: string;
}

export interface UpdateChapterApiInput {
  title: string;
  sourceText: string;
}

export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

export type ApiDataGuard<T> = (value: unknown) => value is T;

export interface CursorPage<T> {
  content: T[];
  nextCursor: string | null;
  limit: number;
  hasNext: boolean;
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

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return value === "DRAFT" || value === "ACTIVE" || value === "ARCHIVED";
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

export function isCursorPage<T = unknown>(
  value: unknown,
  itemGuard?: ApiDataGuard<T>,
): value is CursorPage<T> {
  if (
    !isRecord(value) ||
    !Array.isArray(value.content) ||
    !(value.nextCursor === null || isString(value.nextCursor)) ||
    !isNumber(value.limit) ||
    !Number.isInteger(value.limit) ||
    !isBoolean(value.hasNext)
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
    isProjectStatus(value.status) &&
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
    isNumber(value.contentCharacterCount)
  );
}

export function isApiChapterSummary(value: unknown): value is ApiChapterSummary {
  return (
    isRecord(value) &&
    isNumber(value.id) &&
    isNumber(value.storyVersionId) &&
    isNumber(value.orderIndex) &&
    isString(value.title) &&
    isString(value.sourceHash) &&
    isNumber(value.rowVersion)
  );
}

export function isApiChapter(value: unknown): value is ApiChapter {
  return isRecord(value) && isApiChapterSummary(value) && isString(value.sourceText);
}

function isApiChapterWorkspacePipelineStep(
  value: unknown,
): value is ApiChapterWorkspacePipelineStep {
  return isRecord(value) && isString(value.status) && isNullableString(value.completedAt);
}

function isApiChapterWorkspaceProgressStep(
  value: unknown,
): value is ApiChapterWorkspaceProgressStep {
  return (
    isRecord(value) &&
    isString(value.status) &&
    isNumber(value.total) &&
    isNumber(value.completed) &&
    isNumber(value.failed)
  );
}

function isApiChapterWorkspacePreviewScene(
  value: unknown,
): value is ApiChapterWorkspacePreviewScene {
  return (
    isRecord(value) &&
    isNumber(value.id) &&
    isNumber(value.orderIndex) &&
    isString(value.title) &&
    isNullableNumber(value.durationSeconds) &&
    isString(value.status) &&
    isNumber(value.visualBeatCount) &&
    isNullableString(value.previewImageUrl)
  );
}

export function isApiChapterWorkspace(value: unknown): value is ApiChapterWorkspace {
  if (
    !isRecord(value) ||
    !isApiChapter(value.chapter) ||
    !isString(value.projectName) ||
    !isRecord(value.summary) ||
    !isNumber(value.summary.sceneCount) ||
    !isNumber(value.summary.visualBeatCount) ||
    !isNumber(value.summary.estimatedDurationSeconds) ||
    !isRecord(value.pipeline) ||
    !isApiChapterWorkspacePipelineStep(value.pipeline.analysis) ||
    !isApiChapterWorkspacePipelineStep(value.pipeline.visualPlanning) ||
    !isApiChapterWorkspaceProgressStep(value.pipeline.visualGeneration) ||
    !isApiChapterWorkspacePipelineStep(value.pipeline.audio) ||
    !isApiChapterWorkspacePipelineStep(value.pipeline.render) ||
    !isBoolean(value.pipeline.sourceOutdated) ||
    !Array.isArray(value.previewScenes) ||
    !value.previewScenes.every(isApiChapterWorkspacePreviewScene) ||
    !isRecord(value.capabilities)
  ) {
    return false;
  }

  return (
    isBoolean(value.capabilities.canAnalyze) &&
    isBoolean(value.capabilities.canGenerateVisuals) &&
    isBoolean(value.capabilities.canGenerateAudio) &&
    isBoolean(value.capabilities.canRender)
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

  return (
    value.errors === undefined ||
    (Array.isArray(value.errors) && value.errors.every(isApiFieldError))
  );
}
