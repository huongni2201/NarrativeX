import { apiRequest } from "./client";

export interface DesktopProject {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  isStarred?: boolean;
  metrics?: { totalChapters: number; totalScenes: number; estimatedDurationSeconds: number };
}

export interface DesktopAsset {
  id: string;
  type: "AUDIO" | "IMAGE" | "VIDEO";
  origin: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  durationMs: number | null;
}

export interface DesktopCharacter {
  id: string;
  canonicalName: string;
  role?: string;
  sceneCount?: number;
  status?: string;
  pinnedCharacterVersionId?: string | null;
}

export interface DesktopVoice {
  id: string;
  provider: string;
  name: string;
  language: string;
  gender: string | null;
  sampleUrl: string | null;
}

export interface DesktopPreset {
  name: string;
  description: string;
  thumbnail: string | null;
  tags: string[];
  category?: string;
}

export interface DesktopTimelineBeat {
  chapterId: string;
  sceneIndex: number;
  beatIndex: number;
  visualBeatId: string;
  title: string;
  visualIntent: string;
  cameraMovement: string;
  assetStrategy: string;
  mediaAssetId: string | null;
  startMs: number;
  endMs: number;
  durationMs: number;
  assetReady: boolean;
}

export interface DesktopTimeline {
  projectId: string;
  storyVersionId: string;
  totalDurationMs: number;
  aspectRatio: string;
  readyForRender: boolean;
  chapters: Array<{ chapterId: string; orderIndex: number; title: string; startMs: number; endMs: number; audioReady: boolean; readyForRender: boolean }>;
  beats: DesktopTimelineBeat[];
}

export interface DesktopRenderJob {
  jobId: string;
  type: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED" | "UNKNOWN" | "STALLED" | "PAUSED_COST_LIMIT";
  progress: number;
  currentStep: string | null;
  errorCode: string | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function string(value: unknown): value is string {
  return typeof value === "string";
}

function nullableString(value: unknown): value is string | null {
  return value === null || string(value);
}

function isProject(value: unknown): value is DesktopProject {
  return record(value) && string(value.id) && string(value.name) && string(value.status);
}

function isProjectsPage(value: unknown): value is { content: DesktopProject[]; nextCursor: string | null } {
  return record(value) && Array.isArray(value.content) && value.content.every(isProject) && nullableString(value.nextCursor);
}

function isAsset(value: unknown): value is DesktopAsset {
  return record(value) && string(value.id) && (value.type === "AUDIO" || value.type === "IMAGE" || value.type === "VIDEO") && string(value.originalFilename) && string(value.status);
}

function isAssetPage(value: unknown): value is { items: DesktopAsset[]; nextCursor: string | null } {
  return record(value) && Array.isArray(value.items) && value.items.every(isAsset) && nullableString(value.nextCursor);
}

function isCharacter(value: unknown): value is DesktopCharacter {
  return record(value) && string(value.id) && string(value.canonicalName);
}

function isCharacterPage(value: unknown): value is { content: DesktopCharacter[]; nextCursor: string | null } {
  return record(value) && Array.isArray(value.content) && value.content.every(isCharacter) && nullableString(value.nextCursor);
}

function isVoice(value: unknown): value is DesktopVoice {
  return record(value) && string(value.id) && string(value.name) && string(value.language);
}

function isBeat(value: unknown): value is DesktopTimelineBeat {
  return record(value) && string(value.chapterId) && string(value.visualBeatId) && string(value.title) && typeof value.startMs === "number" && typeof value.endMs === "number" && typeof value.durationMs === "number";
}

function isTimeline(value: unknown): value is DesktopTimeline {
  return record(value) && string(value.projectId) && typeof value.totalDurationMs === "number" && Array.isArray(value.beats) && value.beats.every(isBeat) && Array.isArray(value.chapters);
}

function isPreset(value: unknown): value is DesktopPreset {
  return record(value) && string(value.name) && string(value.description) && (value.thumbnail === null || string(value.thumbnail)) && Array.isArray(value.tags);
}

function isRenderJob(value: unknown): value is DesktopRenderJob {
  return record(value) && string(value.jobId) && string(value.type) && string(value.status) && typeof value.progress === "number" && (value.currentStep === null || string(value.currentStep)) && (value.errorCode === null || string(value.errorCode));
}

export const workspaceApi = {
  listProjects: () => apiRequest<{ content: DesktopProject[]; nextCursor: string | null }>("/api/v1/projects/dashboard?limit=50&sort=NEWEST", {}, 20_000).then((value) => {
    if (!isProjectsPage(value)) throw new Error("Projects response không đúng contract.");
    return value;
  }),
  getTimeline: (projectId: string) => apiRequest<DesktopTimeline>(`/api/v1/projects/${encodeURIComponent(projectId)}/production/timeline`).then((value) => {
    if (!isTimeline(value)) throw new Error("Production timeline response không đúng contract.");
    return value;
  }),
  listAssets: (params = "limit=100") => apiRequest<{ items: DesktopAsset[]; nextCursor: string | null }>(`/api/v1/assets?${params}`).then((value) => {
    if (!isAssetPage(value)) throw new Error("Assets response không đúng contract.");
    return value;
  }),
  listCharacters: (projectId: string) => apiRequest<{ content: DesktopCharacter[]; nextCursor: string | null }>(`/api/v1/projects/${encodeURIComponent(projectId)}/characters?limit=100`).then((value) => {
    if (!isCharacterPage(value)) throw new Error("Characters response không đúng contract.");
    return value;
  }),
  listVoices: () => apiRequest<DesktopVoice[]>("/api/v1/voices").then((value) => {
    if (!Array.isArray(value) || !value.every(isVoice)) throw new Error("Voices response không đúng contract.");
    return value;
  }),
  listPresets: () => Promise.all(["VISUAL_STYLE", "IMAGE", "MOTION", "OUTFIT", "RENDER"].map((category) => apiRequest<DesktopPreset[]>(`/api/v1/style-presets?category=${category}`).then((value) => {
    if (!Array.isArray(value) || !value.every(isPreset)) throw new Error("Presets response không đúng contract.");
    return value.map((preset) => ({ ...preset, category }));
  }))).then((groups) => groups.flat()),
  startRender: (projectId: string, resolution: "720p" | "1080p" = "1080p") => apiRequest<DesktopRenderJob>(`/api/v1/projects/${encodeURIComponent(projectId)}/production/render`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ resolution, format: "mp4", beatOverrides: [] }),
  }).then((value) => {
    if (!isRenderJob(value)) throw new Error("Render job response không đúng contract.");
    return value;
  }),
  getRenderJob: (jobId: string) => apiRequest<DesktopRenderJob>(`/api/v1/generation-jobs/${encodeURIComponent(jobId)}`).then((value) => {
    if (!isRenderJob(value)) throw new Error("Generation job response không đúng contract.");
    return value;
  }),
};
