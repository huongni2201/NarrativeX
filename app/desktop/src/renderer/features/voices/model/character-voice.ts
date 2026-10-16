import type { DesktopCharacterVoiceProfiles } from "../../../../shared/api-types/character";

export function currentCharacterVoice(state: DesktopCharacterVoiceProfiles | undefined) {
  if (!state) return null;
  const pinned = state.profiles.find(profile => profile.id === state.pinnedVoiceProfileId);
  const profile = pinned ?? state.profiles
    .filter(profile => profile.status === "ACTIVE")
    .sort((a, b) => b.versionNumber - a.versionNumber)[0];
  return profile?.status === "ACTIVE" ? profile : null;
}

export function characterVoiceReady(state: DesktopCharacterVoiceProfiles | undefined) {
  const voice = currentCharacterVoice(state);
  return Boolean(voice?.id && voice.voiceDescription?.trim());
}
