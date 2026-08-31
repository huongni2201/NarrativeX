import type {
  AnalyzeChapterInput,
  DesktopChapterDetails,
  DesktopChapterWorkspace,
  DesktopVoice,
} from "@narrativex/client-contracts";

export type ChapterAudioState = Readonly<{
  voices: DesktopVoice[];
  voiceId: string;
  speakingRate: string;
  workspace: DesktopChapterWorkspace | undefined;
  workspaceError: boolean;
  status: string | null;
  busy: boolean;
  ready: boolean;
  processing: boolean;
  controlsDisabled: boolean;
  generatePending: boolean;
  blockMessage: string | null;
  requestError: string | null;
  onVoiceChange: (voiceId: string) => void;
  onSpeakingRateChange: (value: string) => void;
  onCreate: () => void;
  onRefetchWorkspace: () => void;
}>;

export type ChapterEditorPanelProps = Readonly<{
  selected: DesktopChapterDetails | null;
  workspace: DesktopChapterWorkspace | undefined;
  canAnalyze: boolean;
  title: string;
  sourceText: string;
  busy: boolean;
  saveBusy: boolean;
  analyzeBusy: boolean;
  isDirty: boolean;
  notice: string | null;
  audio: ChapterAudioState;
  onTitleChange: (value: string) => void;
  onSourceTextChange: (value: string) => void;
  onBeginCreate: () => void;
  onCancel: () => void;
  onSave: () => void;
  onAnalyze: (input: AnalyzeChapterInput) => void;
  onOpenEditor: () => void;
}>;
