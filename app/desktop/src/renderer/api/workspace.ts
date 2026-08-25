import { projectsApi } from "../features/projects/api/projects.api";
import { assetsApi } from "./assets.api";
import { catalogApi } from "./catalog.api";
import { productionApi } from "./production.api";

/** Compatibility facade for existing editor orchestration. Feature code should import its API module directly. */
export const workspaceApi = {
  listProjects: projectsApi.list,
  getTimeline: productionApi.getTimeline,
  listAssets: assetsApi.list,
  listCharacters: catalogApi.listCharacters,
  listVoices: catalogApi.listVoices,
  listPresets: catalogApi.listPresets,
  startRender: productionApi.startRender,
  getRenderJob: productionApi.getRenderJob,
  preflight: productionApi.preflight,
};
