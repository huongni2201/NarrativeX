import { DesktopProviders } from "./providers";
import { DesktopRouter } from "./DesktopRouter";

export function DesktopApp() {
  return (
    <DesktopProviders>
      <DesktopRouter />
    </DesktopProviders>
  );
}
