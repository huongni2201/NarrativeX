import { shell } from "electron";

export class DesktopAuthService {
  constructor(private readonly backendBaseUrl: string) {}

  async login(): Promise<void> {
    const startUrl = new URL("/api/v1/auth/desktop/start", `${this.backendBaseUrl}/`);
    startUrl.searchParams.set("redirect_uri", "narrativex://auth/callback");
    await shell.openExternal(startUrl.toString());
  }
}
