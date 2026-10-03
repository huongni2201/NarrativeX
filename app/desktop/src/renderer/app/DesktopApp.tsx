import { DesktopProviders } from "./providers";
import { DesktopRouter } from "./DesktopRouter";
import { RenderRecoveryDialog } from "../features/production/components/RenderRecoveryDialog";

export function DesktopApp() {
  return (
    <DesktopProviders>
      <DesktopRouter />
      <RenderRecoveryDialog />
    </DesktopProviders>
  );
}

