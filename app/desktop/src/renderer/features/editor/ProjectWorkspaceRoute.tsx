import { useLocation } from "react-router-dom";
import { EditorScreen } from "./EditorScreen";
import { screenFromWorkspacePath } from "./editor-navigation";

export function ProjectWorkspaceRoute() {
  const location = useLocation();
  return <EditorScreen initialScreen={screenFromWorkspacePath(location.pathname)} />;
}
