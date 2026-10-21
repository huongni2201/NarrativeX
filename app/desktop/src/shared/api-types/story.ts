export type StoryBeatReviewStatus = "NOT_READY" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
type AudioCueType = "NARRATOR" | "DIALOGUE" | "INNER_MONOLOGUE" | "SYSTEM";
type AudioCueStatus = "DRAFT" | "READY" | "APPROVED" | "REJECTED";
type AdaptationAction = "KEEP_EXACT" | "LIGHT_EDIT" | "COMPRESS" | "VISUAL_PRIMARY";

interface DesktopAudioCue {
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

type DramaticIntent =
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

type RetentionRole =
  | "HOOK"
  | "INCITING"
  | "ESCALATION"
  | "MIDPOINT_SHIFT"
  | "CLIMAX"
  | "TWIST"
  | "RESOLUTION"
  | "COOLDOWN";

export type GenerationStrategy =
  | "TEXT_TO_VIDEO"
  | "IMAGE_TO_VIDEO"
  | "FIRST_LAST_FRAME"
  | "MULTI_KEYFRAME"
  | "VIDEO_EXTEND"
  | "VIDEO_RETAKE";

type ShotStatus =
  | "PLANNED"
  | "REFERENCE_PREPARING"
  | "READY"
  | "QUEUED"
  | "GENERATING"
  | "GENERATED"
  | "VALIDATING"
  | "PASSED"
  | "FAILED"
  | "BLOCKED"
  | "RETRY_READY"
  | "MANUAL_REVIEW"
  | "SELECTED";

type TakeValidationStatus =
  | "PENDING"
  | "RUNNING"
  | "GENERATED"
  | "VALIDATING"
  | "PASSED"
  | "FAILED";

type VideoQAFailureCategory =
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

interface TakeValidationResult {
  passed: boolean;
  failureCategory?: VideoQAFailureCategory | null;
  failureReason?: string | null;
  retryRecommendation?: string | null;
  score?: number | null;
}

interface WhisperXSummary {
  expectedText: string | null;
  recognizedText: string | null;
  coverage: number | null;
  confidence: number | null;
  timingMatch: boolean | null;
  status: "PASSED" | "WARNING" | "FAILED" | null;
}

export type TakeQualityLevel = "GOOD" | "REVIEW" | "DEFECT" | "UNMEASURED";

export interface TakeQualityWarning {
  code: string;
  category: VideoQAFailureCategory;
  severity: "REVIEW" | "DEFECT";
  measured: number;
  threshold: number;
}

/** Raw worker measurements; absent fields were not measured. */
export interface TakeQualityMetrics {
  status: "MEASURED" | "UNAVAILABLE";
  scorerVersion: string;
  reason?: string | null;
  freezeHeadMs?: number | null;
  freezeTotalMs?: number | null;
  motionMean?: number | null;
  sceneCutCount?: number | null;
  flickerStddev?: number | null;
  blackTotalMs?: number | null;
  silenceTotalMs?: number | null;
  integratedLufs?: number | null;
  peakDbfs?: number | null;
  meanY?: number | null;
  meanU?: number | null;
  meanV?: number | null;
}

/** Advisory automatic QC; it never replaces technical validation or the editor's review. */
export interface TakeQuality {
  level: TakeQualityLevel;
  thresholdsVersion?: string;
  warnings: TakeQualityWarning[];
  metrics?: TakeQualityMetrics | null;
}

export interface DesktopTake {
  id: string;
  jobId?: string | null;
  generationJobId?: string | null;
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
  metricsJson?: string | null;
  whisperXSummary?: WhisperXSummary | null;
  quality?: TakeQuality | null;
}

export interface DesktopSelectedTake {
  shotId: string;
  takeId: string;
  sourceInMs: number;
  sourceOutMs: number;
  rowVersion: number;
  reviewFingerprint?: string | null;
  reviewChecklistJson?: string | null;
  reviewedAt?: string | null;
  selectedAt?: string;
  updatedAt?: string;
}

export interface TakeContentReviewChecklist {
  characterWardrobe: boolean;
  settingContinuity: boolean;
  actionMotion: boolean;
  dialogueVoice: boolean;
  lipSync: boolean;
}

interface DesktopShotGenerationAttempt {
  id: string;
  shotId: string;
  attemptNumber: number;
  strategy: GenerationStrategy;
  provider: string;
  model: string;
  status:
    | "QUEUED"
    | "GENERATING"
    | "VALIDATING"
    | "PASSED"
    | "FAILED"
    | "BLOCKED"
    | "MANUAL_REVIEW";
  progress?: number | null;
  currentStep?: string | null;
  failureCategory?: VideoQAFailureCategory | null;
  failureReason?: string | null;
  outputMediaAssetId?: string | null;
}

interface ShotPreflight {
  ready: boolean;
  blockers: string[];
  warnings: string[];
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
  activeAttempt?: DesktopShotGenerationAttempt | null;
  preflight?: ShotPreflight | null;
}

export interface ChapterProductionAudioCue {
  id: string;
  storyBeatId: string;
  orderIndex: number;
  cueType: AudioCueType;
  speakerProjectCharacterId?: string | null;
  speakerName?: string | null;
  adaptedText?: string | null;
  status: "DRAFT" | "READY" | "APPROVED" | "REJECTED";
  characterId?: string | null;
  voiceProfileId?: string | null;
  voiceReferenceAssetId?: string | null;
  voiceReady: boolean;
  rowVersion: number;
}

export interface ChapterProductionVisualBeat {
  id: string;
  sceneId: string;
  storyBeatId?: string | null;
  orderIndex: number;
  title: string;
  visualIntent: string;
  dramaticIntent?: DramaticIntent;
  retentionRole?: RetentionRole | null;
  reviewStatus: StoryBeatReviewStatus;
  previewMediaAssetId?: string | null;
  prompt?: string | null;
  audioCues: ChapterProductionAudioCue[];
  shotSequence?: DesktopShotSequence | null;
}

export interface ShotAudioCueAllocation {
  audioCueId: string;
  shotId: string;
  audioCueRowVersion: number;
}

export interface ShotAudioCueAllocationSet {
  sequenceId: string;
  rowVersion: number;
  allocations: ShotAudioCueAllocation[];
}

interface ChapterProductionScene {
  id: string;
  orderIndex: number;
  title: string;
  visualBeats: ChapterProductionVisualBeat[];
}

export interface ChapterProductionResponse {
  chapterId: string;
  chapterTitle: string;
  chapterOrderIndex: number;
  totalShots: number;
  readyShots: number;
  selectedShots: number;
  overallProgressPercent: number;
  status: string;
  scenes: ChapterProductionScene[];
}

export interface DesktopShotSequence {
  id: string;
  visualBeatId: string;
  orderIndex: number;
  shots: DesktopShot[];
}

interface DesktopStoryVisualBeat {
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

interface DesktopStoryBeatTiming {
  startMs: number | null;
  endMs: number | null;
  durationMs: number | null;
}

type StoryBeatPersistenceState = "PERSISTED" | "SYNTHETIC";

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
  reviewStatus: StoryBeatReviewStatus;
  audioCues: DesktopAudioCue[];
  visualBeats: DesktopStoryVisualBeat[];
  timing: DesktopStoryBeatTiming;
  rowVersion: number;
  persistenceState: StoryBeatPersistenceState;
  createdAt?: string;
  updatedAt?: string;
}

interface DesktopStoryScene {
  id: string;
  chapterId: string;
  orderIndex: number;
  title: string;
  status: string;
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
