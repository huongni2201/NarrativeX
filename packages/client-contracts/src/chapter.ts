export interface DesktopChapter {
  chapterId: string;
  orderIndex: number;
  title: string;
  startMs: number;
  endMs: number;
  audioReady: boolean;
  readyForRender: boolean;
}
