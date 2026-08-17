import { authApi } from "@/features/auth/api/auth.api";
import { projectsApi } from "@/features/projects/api/projects.api";

export {
  API_BASE_URL,
  ApiClientError,
  ApiProtocolError,
  apiErrorMessage,
  apiRequest,
  apiUrl,
  parseErrorResponse,
} from "@/shared/api/client";
export type { ProjectListParams } from "@/features/projects/api/projects.api";

/**
 * Backwards-compatible facade while feature modules migrate to domain APIs.
 * New code should prefer authApi/projectsApi directly.
 */
export const api = {
  getCurrentUser: authApi.getCurrentUser,
  logout: authApi.logout,
  googleLoginUrl: authApi.googleLoginUrl,
  listProjects: projectsApi.list,
  createProject: projectsApi.create,
  createStoryVersion: projectsApi.createStoryVersion,
  enqueueAnalysis: projectsApi.enqueueAnalysis,
};
