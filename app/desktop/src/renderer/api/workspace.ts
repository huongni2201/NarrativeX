import { assetsApi } from "../features/assets/api/assets.api";
import { charactersApi } from "../features/characters/api/characters.api";
import { presetsApi } from "../features/presets/api/presets.api";
import { productionApi } from "../features/production/api/production.api";
import { projectsApi } from "../features/projects/api/projects.api";
import { voicesApi } from "../features/voices/api/voices.api";

/** @deprecated Compatibility facade for the legacy giant editor only. */
export const workspaceApi = {
  listProjects: projectsApi.list,
  getTimeline: productionApi.getTimeline,
  listAssets: assetsApi.list,
  listCharacters: charactersApi.list,
  listVoices: voicesApi.list,
  listPresets: presetsApi.list,
  startRender: productionApi.startRender,
  getRenderJob: productionApi.getRenderJob,
  preflight: productionApi.preflight,
};
