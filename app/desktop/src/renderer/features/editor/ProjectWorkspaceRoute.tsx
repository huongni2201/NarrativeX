import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useProjectSessionStore } from "../projects/store/project-session.store";
import { EditorScreen } from "./EditorScreen";
import { screenFromWorkspacePath } from "./editor-navigation";

export function ProjectWorkspaceRoute() {
  const location = useLocation();
  const { projectId } = useParams<{ projectId: string }>();
  const setActiveProject = useProjectSessionStore((state) => state.setActiveProject);

  useEffect(() => {
    if (!projectId) return;
    setActiveProject(projectId);
    void window.narrativex.localProjects.touch(projectId).catch(() => undefined);
  }, [projectId, setActiveProject]);

  return <EditorScreen initialScreen={screenFromWorkspacePath(location.pathname)} />;
}
