import { charactersApi } from "../features/characters/api/characters.api";
import { presetsApi } from "../features/presets/api/presets.api";
import { voicesApi } from "../features/voices/api/voices.api";

/** @deprecated Feature code should import the owning API module directly. */
export const catalogApi = {
  listCharacters: charactersApi.list,
  createCharacter: charactersApi.create,
  assignCharacter: charactersApi.assign,
  listVoices: voicesApi.list,
  listPresets: presetsApi.list,
};
