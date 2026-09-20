import { useEffect } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { AssetsScreen } from "../assets/screens/AssetsScreen";
import { ChapterWorkspaceScreen } from "../chapters/screens/ChapterWorkspaceScreen";
import { ProjectCanonScreen } from "../canon/screens/ProjectCanonScreen";
import { JobsScreen } from "../jobs/screens/JobsScreen";
import { useRenderController } from "../production/useRenderController";
import { RenderScreen } from "../production/screens/RenderScreen";
import { useProjectSessionStore } from "../projects/store/project-session.store";
import { SettingsScreen } from "../settings/screens/SettingsScreen";
import { WorkspaceShell } from "../workspace/components/WorkspaceShell";
import { useProjectWorkspace } from "../workspace/queries/useProjectWorkspace";
import { screenFromWorkspacePath } from "../workspace/workspace-navigation";
import { EditorScreen } from "./EditorScreen";

export function ProjectWorkspaceRoute() {
  const location = useLocation();
  const { projectId } = useParams<{ projectId: string }>();
  const setActiveProject = useProjectSessionStore((state) => state.setActiveProject);
  const screen = screenFromWorkspacePath(location.pathname);
  const { workspace } = useProjectWorkspace(projectId ?? null, screen);
  const projectName = workspace.projects.find((project) => project.id === projectId)?.name;
  const renderController = useRenderController({
    projectId: projectId ?? "",
    timeline: workspace.timeline,
    projectName,
  });

  useEffect(() => {
    if (!projectId) return;
    setActiveProject(projectId);
    void window.narrativex.localProjects.touch(projectId).catch(() => undefined);
  }, [projectId, setActiveProject]);

  if (!projectId) return <Navigate to="/projects" replace />;

  return (
    <WorkspaceShell projectId={projectId} screen={screen} workspace={workspace}>
      {screen === "chapters" && (
        <ChapterWorkspaceScreen
          projectId={projectId}
          projectName={projectName ?? "Project hiện tại"}
          chapters={workspace.chapters}
          timeline={workspace.timeline}
          initialStage={location.pathname.includes("/story") ? "story" : "source"}
        />
      )}
      {screen === "canon" && (
        <ProjectCanonScreen projectId={projectId} workspace={workspace} />
      )}
      {screen === "editor" && (
        <EditorScreen workspace={workspace} renderController={renderController} />
      )}
      {screen === "assets" && (
        <AssetsScreen
          projectId={projectId}
          assets={workspace.assets}
          chapters={workspace.chapters}
          timeline={workspace.timeline}
        />
      )}
      {screen === "jobs" && (
        <JobsScreen projectId={projectId} workspace={workspace} />
      )}
      {screen === "render" && (
        <RenderScreen timeline={workspace.timeline} controller={renderController} />
      )}
      {screen === "settings" && (
        <SettingsScreen workspace={workspace} />
      )}
    </WorkspaceShell>
  );
}
