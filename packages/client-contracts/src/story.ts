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

export type DramaticIntent =
  | "SETUP"
  | "QUESTION"
  | "TENSION"
  | "ESCALATION"
  | "REVEAL"
  | "REACTION"
  | "PAYOFF"
  | "RELIEF"
  | "TRANSITION"
  | "CLIFFHANGER";

export type RetentionRole =
  | "HOOK"
  | "INCITING"
  | "ESCALATION"
  | "MIDPOINT_SHIFT"
  | "CLIMAX"
  | "TWIST"
  | "RESOLUTION"
  | "COOLDOWN";

export type AttentionEventType =
  | "NEW_INFORMATION"
  | "QUESTION"
  | "REVEAL"
  | "CONFLICT"
  | "CHARACTER_ENTRANCE"
  | "LOCATION_CHANGE"
  | "VISUAL_CHANGE"
  | "SOUND_CHANGE"
  | "REACTION"
  | "PAYOFF"
  | "PACING_RISK";

export interface AttentionEvent {
  eventType: AttentionEventType;
  timeOffsetMs: number;
  description: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
}

export interface HookPlan {
  id: string;
  chapterId: string;
  promise: string;
  conflict: string;
  curiosityQuestion: string;
  visualHook: string;
  dialogueHook: string;
  withheldInformation: string;
  payoffBeatId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RetentionMap {
  id: string;
  chapterId: string;
  tensionCurve: number[];
  openQuestions: string[];
  resolvedQuestions: string[];
  attentionEvents: AttentionEvent[];
  pacingWarnings: string[];
}

export type GenerationStrategy =
  | "TEXT_TO_VIDEO"
  | "IMAGE_TO_VIDEO"
  | "FIRST_LAST_FRAME"
  | "MULTI_KEYFRAME"
  | "VIDEO_EXTEND"
  | "VIDEO_RETAKE";

export type ShotStatus =
  | "PLANNED"
  | "REFERENCE_PREPARING"
  | "READY"
  | "QUEUED"
  | "GENERATING"
  | "GENERATED"
  | "VALIDATING"
  | "PASSED"
  | "FAILED"
  | "RETRY_READY"
  | "MANUAL_REVIEW"
  | "SELECTED";

export type TakeValidationStatus =
  | "PENDING"
  | "RUNNING"
  | "GENERATED"
  | "VALIDATING"
  | "PASSED"
  | "FAILED";

export type VideoQAFailureCategory =
  | "FACE_IDENTITY"
  | "CHARACTER_CONSISTENCY"
  | "ANATOMY"
  | "MOTION"
  | "TEMPORAL_ARTIFACT"
  | "CAMERA"
  | "COMPOSITION"
  | "PROMPT_ADHERENCE"
  | "CONTINUITY"
  | "DURATION"
  | "TECHNICAL_OUTPUT";

export interface TakeValidationResult {
  passed: boolean;
  failureCategory?: VideoQAFailureCategory | null;
  failureReason?: string | null;
  retryRecommendation?: string | null;
  score?: number | null;
}

export interface DesktopTake {
  id: string;
  shotId: string;
  attemptNumber: number;
  provider: string;
  model: string;
  generationMode: GenerationStrategy;
  outputAssetId?: string | null;
  sourceDurationMs?: number | null;
  validationResult?: TakeValidationResult | null;
  status: TakeValidationStatus;
  createdAt?: string;
}

export interface DesktopSelectedTake {
  shotId: string;
  takeId: string;
  sourceInMs: number;
  sourceOutMs: number;
}

export interface DesktopShot {
  id: string;
  sequenceId: string;
  orderIndex: number;
  narrativePurpose: string;
  retentionRole?: RetentionRole | null;
  subjects: string[];
  locationRef?: string | null;
  startState: string;
  action: string;
  endState: string;
  composition: string;
  camera: string;
  subjectMotion: string;
  cameraMotion: string;
  environmentMotion: string;
  targetDurationMs: number;
  generationStrategy: GenerationStrategy;
  qualityProfile: string;
  continuityFromShotId?: string | null;
  continuityToShotId?: string | null;
  status: ShotStatus;
  takes: DesktopTake[];
  selectedTake?: DesktopSelectedTake | null;
}

export interface DesktopShotSequence {
  id: string;
  visualBeatId: string;
  orderIndex: number;
  shots: DesktopShot[];
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
  dramaticIntent?: DramaticIntent;
  emotion?: string | null;
  retentionRole?: RetentionRole | null;
  shotSequence?: DesktopShotSequence | null;
  motionMode?: "STILL" | "PAN" | "ZOOM_IN" | "ZOOM_OUT" | "DYNAMIC";
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
