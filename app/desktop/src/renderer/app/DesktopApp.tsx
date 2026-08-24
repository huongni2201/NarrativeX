import { DesktopProviders } from "./providers";
import { DesktopRouter } from "./DesktopRouter";
import { AuthGuard } from "../features/auth/AuthGuard";

export function DesktopApp() {
  return (
    <DesktopProviders>
      <AuthGuard><DesktopRouter /></AuthGuard>
    </DesktopProviders>
  );
}
