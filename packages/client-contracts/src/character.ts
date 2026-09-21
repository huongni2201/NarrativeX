import type { VoiceReferenceScope } from "./narration";

export interface DesktopCharacterVoiceProfile {
  id?: string | null;
  characterId: string;
  versionNumber: number;
  referenceAssetId?: string | null;
  referenceScope: VoiceReferenceScope;
  language: string;
  accent?: string | null;
  voiceDescription?: string | null;
  deliveryBaseline?: string | null;
  status?: string | null;
  lockedAt?: string | null;
}

export interface DesktopCharacter {
  id: string;
  canonicalName: string;
  role?: string;
  sceneCount?: number;
  status?: string;
  pinnedCharacterVersionId?: string | null;
  pinnedVoiceProfileId?: string | null;
  voiceProfile?: DesktopCharacterVoiceProfile | null;
  voiceProfiles?: DesktopCharacterVoiceProfile[];
  aliases?: string[];
  projectAliases?: string[];
  importance?: number;
  groups?: string[];
  workspaceId?: string | null;
  assignmentId?: string;
  projectId?: string;
  rowVersion?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DesktopCharacterVersion {
  id?: string | null;
  versionNumber?: number | null;
  status?: string | null;
  bible?: string | null;
  visualPrompt?: string | null;
  prompt?: string | null;
  lockedAt?: string | null;
  lockedBy?: string | null;
}

export interface DesktopCharacterVersionReference {
  assetId: string;
  role: string;
  priority: number;
}

export interface DesktopCharacterAppearance {
  ageState?: string | null;
  hairstyle?: string | null;
  injury?: string | null;
  wardrobeContext?: string | null;
  appearancePrompt?: string | null;
}

export interface DesktopCharacterDetail extends DesktopCharacter {
  version?: DesktopCharacterVersion | null;
  appearance?: DesktopCharacterAppearance | null;
}
