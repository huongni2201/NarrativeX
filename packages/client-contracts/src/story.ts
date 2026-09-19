export type StoryBeatReviewStatus = "NOT_READY" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
export type AudioCueType = "NARRATOR" | "DIALOGUE" | "INNER_MONOLOGUE" | "SYSTEM";
export type AudioCueStatus = "DRAFT" | "READY" | "APPROVED" | "REJECTED";
export type AdaptationAction = "KEEP_EXACT" | "LIGHT_EDIT" | "COMPRESS" | "VISUAL_PRIMARY";

export interface DesktopAudioCue {
  id: string;
  storyBeatId: string;
  orderIndex: number;
  cueType: AudioCueType;
  speakerProjectCharacterId?: string | null;
  speakerName?: string | null;
  sourceStart?: number | null;
  sourceEnd?: number | null;
  adaptationAction: AdaptationAction;
  adaptedText?: string | null;
  deliveryHint?: string | null;
  narrationTextStart?: number | null;
  narrationTextEnd?: number | null;
  audioStartMs?: number | null;
  audioEndMs?: number | null;
  status: AudioCueStatus;
  rowVersion: number;
}

export interface DesktopStoryVisualBeat {
  id: string;
  sceneId: string;
  storyBeatId?: string | null;
  orderIndex: number;
  title: string;
  visualIntent: string;
  visualSummary?: string | null;
  visualDescription?: string | null;
  visualDirectionJson?: string | null;
  reviewStatus: StoryBeatReviewStatus;
  motionMode: "STILL" | "PAN" | "ZOOM_IN" | "ZOOM_OUT" | "DYNAMIC";
  relativeWeight: number;
  visualFocus: string;
  aspectRatioOverride?: string | null;
  textStart?: number | null;
  textEnd?: number | null;
  sourceAnchorJson?: string | null;
  previewMediaAssetId?: string | null;
  prompt?: string | null;
  rowVersion: number;
}

export interface DesktopStoryBeatTiming {
  startMs: number | null;
  endMs: number | null;
  durationMs: number | null;
}

export type StoryBeatPersistenceState = "PERSISTED" | "SYNTHETIC";

export interface DesktopStoryBeat {
  id: string;
  sceneId: string;
  orderIndex: number;
  title?: string | null;
  purpose: string;
  summary: string;
  importance: string;
  sourceStart?: number | null;
  sourceEnd?: number | null;
  sourceAnchorJson?: string | null;
  storyFunctionsJson?: string | null;
  continuityStateJson?: string | null;
  reviewStatus: StoryBeatReviewStatus;
  audioCues: DesktopAudioCue[];
  visualBeats: DesktopStoryVisualBeat[];
  timing: DesktopStoryBeatTiming;
  rowVersion: number;
  persistenceState: StoryBeatPersistenceState;
  createdAt?: string;
  updatedAt?: string;
}

export interface DesktopStoryScene {
  id: string;
  chapterId: string;
  orderIndex: number;
  title: string;
  status: string;
  summary?: string | null;
  mood?: string | null;
  lighting?: string | null;
  timeOfDay?: string | null;
  locationText?: string | null;
  projectLocationId?: string | null;
  storyBeats: DesktopStoryBeat[];
  approvedBeatCount: number;
  totalBeatCount: number;
}

export interface DesktopChapterStory {
  chapterId: string;
  chapterTitle: string;
  chapterOrderIndex: number;
  storyboardRevisionId?: string | null;
  scenes: DesktopStoryScene[];
}

export interface DesktopProductionBeatStatus {
  storyBeatId: string;
  title: string;
  audioReady: boolean;
  alignmentReady: boolean;
  visualsTotal: number;
  visualsReady: number;
  visualsFailed: number;
  visualsRunning: number;
  status: "READY" | "RUNNING" | "PARTIAL" | "FAILED" | "PENDING";
}

export interface DesktopProductionStatus {
  chapterId: string;
  storyReady: boolean;
  narrationScriptReady: boolean;
  audioReady: boolean;
  alignmentReady: boolean;
  totalStoryBeats: number;
  readyStoryBeats: number;
  totalVisualBeats: number;
  readyVisualBeats: number;
  failedVisualBeats: number;
  runningVisualBeats: number;
  timelineReady: boolean;
  renderReady: boolean;
  overallProgressPercent: number;
  beats: DesktopProductionBeatStatus[];
}

export interface CreateStoryBeatInput {
  title?: string;
  purpose?: string;
  summary: string;
  importance?: string;
  sourceStart?: number;
  sourceEnd?: number;
}

export interface UpdateStoryBeatInput {
  title?: string;
  purpose?: string;
  summary?: string;
  importance?: string;
  reviewStatus?: StoryBeatReviewStatus;
  rowVersion: number;
}

export interface CreateAudioCueInput {
  cueType: AudioCueType;
  speakerProjectCharacterId?: string | null;
  adaptationAction?: AdaptationAction;
  adaptedText?: string | null;
  deliveryHint?: string | null;
  sourceStart?: number | null;
  sourceEnd?: number | null;
}

export interface UpdateAudioCueInput {
  cueType?: AudioCueType;
  speakerProjectCharacterId?: string | null;
  adaptationAction?: AdaptationAction;
  adaptedText?: string | null;
  deliveryHint?: string | null;
  status?: AudioCueStatus;
  rowVersion: number;
}

export interface UpdateStoryBeatReviewStatusInput {
  status: StoryBeatReviewStatus;
  rowVersion: number;
}

export interface StoryBeatMutationResponse {
  id: string;
  sceneId: string;
  orderIndex: number;
  purpose: string;
  summary: string;
  importance: string;
  reviewStatus: StoryBeatReviewStatus;
  rowVersion: number;
}

export interface DesktopJobHistoryItem {
  jobId: string;
  projectId: string;
  projectName: string;
  jobType: string;
  status: string;
  progress: number;
  currentStep?: string | null;
  errorCode?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface DesktopJobHistoryPage {
  content: DesktopJobHistoryItem[];
  nextCursor?: string | null;
  limit: number;
  hasNext: boolean;
}

export interface DesktopProviderHealth {
  vertexGemini: {
    status: string;
    model: string;
    location: string;
    configured: boolean;
  };
}
