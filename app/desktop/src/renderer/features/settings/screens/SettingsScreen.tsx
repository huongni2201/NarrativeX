import { useEffect, useState, type ReactNode } from "react";
import { Cpu, Database, HardDrive, Palette, RotateCcw } from "lucide-react";
import type { DesktopPreferenceResetScope } from "../../../../preload/types";
import { Button } from "../../../components/ui/button";
import { FeaturePage } from "../../workspace/components/FeaturePage";
import type { DesktopWorkspaceState } from "../../workspace/queries/useProjectWorkspace";

export function SettingsScreen({
  workspace,
}: Readonly<{
  workspace: DesktopWorkspaceState;
}>) {
  const [executorState, setExecutorState] = useState("Checking…");
  const [preferenceNotice, setPreferenceNotice] = useState<string | null>(null);

  useEffect(() => {
    void window.narrativex.localExecution
      .status()
      .then((status) => setExecutorState(`${status.state}${status.deviceId ? ` · ${status.deviceId}` : ""}`))
      .catch(() => setExecutorState("Unavailable"));
    void window.narrativex.preferences
      .get()
      .then(() => undefined)
      .catch((error) => setPreferenceNotice(error instanceof Error ? error.message : "Unable to load application settings."));
  }, []);

  async function resetPreferences(scope: DesktopPreferenceResetScope) {
    try {
      await window.narrativex.preferences.reset(scope);
      setPreferenceNotice(scope === "WINDOW" ? "Window layout reset." : "Application settings reset.");
    } catch (error) {
      setPreferenceNotice(error instanceof Error ? error.message : "Unable to reset application settings.");
    }
  }

  return (
    <FeaturePage
      title="Desktop Settings"
      description="Runtime diagnostics, project defaults và application-scoped Desktop preferences."
    >
      <div className="grid max-w-[1500px] gap-6 lg:grid-cols-2">
        <SettingsGroup
          eyebrow="System"
          title="Runtime & Storage"
          description="Trạng thái các dịch vụ và dữ liệu local mà Desktop đang sử dụng."
        >
          <SettingRow icon={<Cpu size={18} />} title="Local executor" value={executorState} />
          <SettingRow icon={<Database size={18} />} title="Backend workspace" value={workspace.status} />
          <SettingRow icon={<HardDrive size={18} />} title="Local assets" value={`${workspace.assets.length} assets`} />
        </SettingsGroup>

        <SettingsGroup
          eyebrow="Project"
          title="Project Defaults"
          description="Các preset hiện có được dùng làm nguồn cấu hình cho creative workflow."
        >
          <SettingRow icon={<Palette size={18} />} title="Style presets" value={`${workspace.presets.length} presets`} />
        </SettingsGroup>

        <div className="lg:col-span-2">
          <SettingsGroup
            eyebrow="Application"
            title="Reset Actions"
            description="Reset Desktop layout preferences."
          >
            <ResetRow
              title="Reset window layout"
              description="Forget the saved size/position and restore the default Desktop layout."
              onReset={() => void resetPreferences("WINDOW")}
            />
            <ResetRow
              title="Reset all application settings"
              description="Reset all application-scoped Desktop settings."
              onReset={() => void resetPreferences("ALL")}
            />
          </SettingsGroup>
          {preferenceNotice && (
            <p className="mt-2 text-[12px] text-text-muted">{preferenceNotice}</p>
          )}
        </div>
      </div>
    </FeaturePage>
  );
}

function SettingsGroup({
  eyebrow,
  title,
  description,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <section className="overflow-hidden rounded-lg border border-border-subtle bg-surface-panel shadow-sm">
      <header className="border-b border-border-subtle bg-surface-dark/60 px-5 py-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-dim">{eyebrow}</span>
        <h2 className="mt-0.5 text-[15px] font-semibold text-foreground">{title}</h2>
        <p className="mt-1 max-w-xl text-[12px] leading-5 text-text-muted">{description}</p>
      </header>
      <div className="divide-y divide-border-subtle">{children}</div>
    </section>
  );
}

function SettingRow({ icon, title, value }: Readonly<{ icon: ReactNode; title: string; value: string }>) {
  return (
    <div className="grid min-h-14 grid-cols-[36px_minmax(0,1fr)_minmax(160px,auto)] items-center gap-3.5 px-5 py-3">
      <span className="grid size-9 place-items-center rounded-md border border-border-subtle bg-surface-dark text-text-muted">{icon}</span>
      <span className="text-[13px] font-medium text-foreground">{title}</span>
      <span className="min-w-0 truncate text-right font-mono text-[12px] text-text-secondary" title={value}>{value}</span>
    </div>
  );
}

function ResetRow({
  title,
  description,
  onReset,
}: Readonly<{ title: string; description: string; onReset: () => void }>) {
  return (
    <div className="grid min-h-16 grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3.5 px-5 py-3">
      <span className="grid size-9 place-items-center rounded-md border border-border-subtle bg-surface-dark text-text-muted"><RotateCcw size={17} /></span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{title}</div>
        <div className="text-[12px] text-text-muted">{description}</div>
      </div>
      <Button size="default" variant="outline" onClick={onReset}>Reset</Button>
    </div>
  );
}
