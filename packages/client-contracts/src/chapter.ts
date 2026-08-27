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
    audioGenerationBlockReason: string | null;
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
  latestJobId: string | null;
  voiceId: string | null;
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
