export interface DesktopChapter {
  chapterId: string;
  orderIndex: number;
  title: string;
  startMs: number;
  endMs: number;
  audioReady: boolean;
  readyForRender: boolean;
  narrationAssetId?: string | null;
  audioSizeBytes?: number | null;
  audioChecksum?: string | null;
}

export interface DesktopChapterDetails {
  id: string;
  storyVersionId: string;
  orderIndex: number;
  title: string;
  sourceText: string;
  sourceHash: string;
  rowVersion: number;
}

export interface DesktopChapterWorkspace {
  chapter: DesktopChapterDetails;
  projectName: string;
  summary: {
    sceneCount: number;
    visualBeatCount: number;
    estimatedDurationSeconds: number;
  };
  pipeline: {
    analysis: ChapterWorkspaceStep;
    visualPlanning: ChapterWorkspaceStep;
    visualGeneration: ChapterWorkspaceProgress;
    audio: ChapterWorkspaceAudio;
    render: ChapterWorkspaceRender;
    sourceOutdated: boolean;
  };
  previewScenes: ChapterWorkspacePreviewScene[];
  capabilities: {
    canAnalyze: boolean;
    canGenerateVisuals: boolean;
    canGenerateAudio: boolean;
    canRender: boolean;
    visualGenerationBlockReason: string | null;
  };
}

export interface ChapterWorkspaceStep {
  status: string;
  completedAt: string | null;
}

export interface ChapterWorkspaceProgress {
  status: string;
  total: number;
  completed: number;
  failed: number;
}

export interface ChapterWorkspaceAudio extends ChapterWorkspaceStep {
  status: string;
  audioUrl: string | null;
  durationMs: number | null;
}

export interface ChapterWorkspaceRender extends ChapterWorkspaceStep {
  latestJobId: string | null;
  artifactId: number | null;
}

export interface ChapterWorkspacePreviewScene {
  id: string;
  orderIndex: number;
  title: string;
  durationSeconds: number | null;
  status: string;
  visualBeatCount: number;
  previewImageUrl: string | null;
}

export type ChapterTranslationStatus =
  | "LANGUAGE_SELECTION_REQUIRED"
  | "MULTILINGUAL"
  | "NOT_REQUIRED"
  | "PENDING_CONFIRMATION"
  | "COMPLETED";

export interface ChapterLanguageStatus {
  sourceVariantId: string;
  sourceContentHash: string;
  detectedLanguage: string | null;
  confidence: number | null;
  detector: string | null;
  projectLanguage: string;
  translationStatus: ChapterTranslationStatus;
  existingTranslationVariantId: string | null;
}

export interface ChapterContentVariant {
  id: string;
  chapterId: string;
  sourceVariantId: string | null;
  variantType: string;
  languageCode: string;
  content: string;
  contentHash: string;
  sourceContentHash: string | null;
  translationProvider: string | null;
  translationModel: string | null;
  translationStatus: string;
  createdAt: string;
}

export interface ConfirmChapterTranslationInput {
  sourceVariantId: string;
  sourceContentHash: string;
  targetLanguage: string;
}

export interface CreateChapterInput {
  storyVersionId?: string;
  orderIndex?: number;
  title: string;
  sourceText: string;
}

export interface UpdateChapterInput {
  title: string;
  sourceText: string;
  rowVersion: number;
}
