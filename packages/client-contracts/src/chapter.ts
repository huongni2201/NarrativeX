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
