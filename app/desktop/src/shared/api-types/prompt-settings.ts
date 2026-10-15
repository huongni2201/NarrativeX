/** Installation-wide Settings → Prompt contract. `revision` is a decimal string (BIGINT on the server). */
export interface PromptStyleProfile {
  id: string;
  name: string;
  positivePrompt: string;
  negativePrompt: string;
  characterRenderingPrompt: string;
}

interface PromptInstructions {
  chapterAnalysis: string;
  characterReference: string;
  storyboard: string;
  video: string;
}

export interface PromptSettings {
  formatVersion: number;
  /** Revision being edited. The server rejects a Save whose revision is no longer current. */
  revision: string;
  activeStyleId: string;
  styles: PromptStyleProfile[];
  instructions: PromptInstructions;
  videoNegativePrompt: string;
}

export interface PromptSettingsView {
  settings: PromptSettings;
  effectiveHash: string;
  /** Packaged defaults, used for "reset to defaults". */
  defaults: PromptSettings;
}
