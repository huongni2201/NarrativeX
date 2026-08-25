import { projectsApi as api } from "../../../api/projects.api";

export const projectsApi = {
  list: api.list,
  create: api.create,
  addFavorite: api.addFavorite,
  removeFavorite: api.removeFavorite,
};
