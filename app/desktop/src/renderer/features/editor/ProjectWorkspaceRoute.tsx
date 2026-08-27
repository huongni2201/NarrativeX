import { useEffect } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { AssetsScreen } from "../assets/screens/AssetsScreen";
import { ChaptersScreen } from "../chapters/screens/ChaptersScreen";
import { CharactersScreen } from "../characters/screens/CharactersScreen";
import { ImagesScreen } from "../generation/screens/ImagesScreen";
import { RenderScreen } from "../production/screens/RenderScreen";
import { useProjectSessionStore } from "../projects/store/project-session.store";
import { SettingsScreen } from "../settings/screens/SettingsScreen";
import { StoryboardScreen } from "../storyboard/screens/StoryboardScreen";
import { VoiceScreen } from "../voices/screens/VoiceScreen";
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

  useEffect(() => {
    if (!projectId) return;
    setActiveProject(projectId);
    void window.narrativex.localProjects.touch(projectId).catch(() => undefined);
  }, [projectId, setActiveProject]);

  if (!projectId) return <Navigate to="/projects" replace />;

  return (
    <WorkspaceShell projectId={projectId} screen={screen} workspace={workspace}>
      {screen === "editor" && <EditorScreen workspace={workspace} />}
      {screen === "chapters" && (
        <ChaptersScreen
          projectId={projectId}
          projectName={workspace.projects.find((project) => project.id === projectId)?.name ?? "Project hiện tại"}
          storyVersionId={workspace.timeline?.storyVersionId ?? null}
          chapters={workspace.chapters}
          voices={workspace.voices}
          timeline={workspace.timeline}
          workspaceStatus={workspace.status}
          projectsCount={workspace.projects.length}
          assetsCount={workspace.assets.length}
          charactersCount={workspace.characters.length}
        />
      )}
      {screen === "storyboard" && (
        <StoryboardScreen
          projectId={projectId}
          chapters={workspace.chapters}
          timeline={workspace.timeline}
        />
      )}
      {screen === "characters" && (
        <CharactersScreen projectId={projectId} characters={workspace.characters} />
      )}
      {screen === "images" && (
        <ImagesScreen
          projectId={projectId}
          chapters={workspace.chapters}
          timeline={workspace.timeline}
        />
      )}
      {screen === "voice" && (
        <VoiceScreen
          projectId={projectId}
          chapters={workspace.chapters}
          voices={workspace.voices}
          assets={workspace.assets}
        />
      )}
      {screen === "assets" && (
        <AssetsScreen projectId={projectId} assets={workspace.assets} />
      )}
      {screen === "render" && (
        <RenderScreen projectId={projectId} timeline={workspace.timeline} />
      )}
      {screen === "settings" && <SettingsScreen workspace={workspace} />}
    </WorkspaceShell>
  );
}
