export type ScreenType =
  | "auth"
  | "overview"
  | "project-workspace"
  | "dashboard"
  | "wizard"
  | "characters"
  | "character-bible"
  | "assets"
  | "presets";

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
export type ImageQuality = "Standard" | "High";

export interface Project {
  id: string;
  title: string;
  name?: string;
  status?: string;
  description: string;
  updatedAt: string;
  progress: number;
  isFavorite: boolean;
  coverImage: string;
  genre: string;
  language: string;
  aspectRatio: AspectRatio;
  quality: ImageQuality;
  characterCount: number;
  locationCount: number;
  chapterCount: number;
  sceneCount: number;
  visualBeatsCount: number;
}

export interface CharacterReferenceAsset {
  id: string;
  title: string;
  imageUrl: string;
  type: "front" | "side" | "expression" | "action" | "costume" | "portrait";
}

export type CharacterVersionStatus = "DRAFT" | "GENERATING" | "REVIEW" | "LOCKED" | "REJECTED";

export interface CharacterVersionSummary {
  versionNumber: number;
  status: CharacterVersionStatus;
  lockedAt?: string;
}

export type CharacterLifecycleStatus = "IN_USE" | "DRAFT" | "ARCHIVED";
export type CharacterRoleCategory = "main" | "supporting" | "minor";

export interface Character {
  id: string;
  name: string;
  canonicalIdentity: string;
  aliases?: string[];
  ownerId?: string;
  workspaceId?: string;
  status?: CharacterLifecycleStatus | "ACTIVE" | "ARCHIVED";
  roleCategory?: CharacterRoleCategory;
  group?: string;
  appearancesCount?: number;
  updatedAt?: string;
  latestVersion: CharacterVersionSummary;
  avatarUrl: string;
  fullPortraitUrl: string;
  description: string;
  gender: string;
  age: number | string;
  height: string;
  hairColor: string;
  eyeColor: string;
  appearance?: string;
  personality?: string;
  costume?: string;
  relationships?: string;
  referenceAssets: CharacterReferenceAsset[];
}

export interface ProjectCharacter {
  id: string;
  projectId: string;
  characterId: string;
  role: string;
  importance: number;
  projectAliases: string[];
  storyMetadata?: string;
  groups: string[];
  pinnedCharacterVersionId?: string;
  status: "ACTIVE" | "REMOVED";
}

export interface AnalysisChecklistItem {
  id: string;
  label: string;
  status: "completed" | "in_progress" | "pending";
}

export interface AnalysisState {
  progress: number;
  currentMessage: string;
  checklist: AnalysisChecklistItem[];
  counts: {
    characters: number;
    locations: number;
    chapters: number;
    scenes: number;
    visualBeats: number;
  };
}

export interface ProjectWizardDraft {
  title: string;
  description: string;
  genre: string;
  language: string;
  aspectRatio: AspectRatio;
  quality: ImageQuality;
  storyText: string;
  rightsAttestationAccepted: boolean;
  step: 1 | 2 | 3 | 4;
}

// Legacy API types for backend contract compatibility
export interface CreateProjectInput {
  name: string;
  description?: string;
  imageAspectRatio?: AspectRatio;
  imageQualityTier?: string;
}

export interface GenerationJob {
  id: number;
  status: string;
  progress?: number;
}

export interface StoryVersion {
  id: number;
  versionNumber: number;
  content: string;
}
