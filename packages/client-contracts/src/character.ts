export interface DesktopCharacter {
  id: string;
  canonicalName: string;
  role?: string;
  sceneCount?: number;
  status?: string;
  pinnedCharacterVersionId?: string | null;
}
