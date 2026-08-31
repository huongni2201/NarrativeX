import { useEffect, useState } from "react";
import { Cpu, Database, HardDrive, Palette } from "lucide-react";
import { FeaturePage } from "../../workspace/components/FeaturePage";
import type { DesktopWorkspaceState } from "../../workspace/queries/useProjectWorkspace";

export function SettingsScreen({
  workspace,
}: Readonly<{
  workspace: DesktopWorkspaceState;
}>) {
  const [executorState, setExecutorState] = useState("Checking…");

  useEffect(() => {
    void window.narrativex.localExecution
      .status()
      .then((status) => setExecutorState(`${status.state}${status.deviceId ? ` · ${status.deviceId}` : ""}`))
      .catch(() => setExecutorState("Unavailable"));
  }, []);

  return (
    <FeaturePage
      title="Desktop Settings"
      description="Runtime diagnostics và project defaults được đọc từ desktop/backend contracts thay vì hard-code trong editor."
    >
      <div className="max-w-3xl divide-y divide-border-subtle border-y border-border-subtle">
        <SettingRow icon={<Cpu size={16} />} title="Local executor" value={executorState} />
        <SettingRow icon={<Database size={16} />} title="Backend workspace" value={workspace.status} />
        <SettingRow icon={<HardDrive size={16} />} title="Local assets" value={`${workspace.assets.length} assets`} />
        <SettingRow icon={<Palette size={16} />} title="Style presets" value={`${workspace.presets.length} presets`} />
      </div>
    </FeaturePage>
  );
}

function SettingRow({ icon, title, value }: Readonly<{ icon: React.ReactNode; title: string; value: string }>) {
  return (
    <section className="grid min-h-14 grid-cols-[24px_minmax(0,1fr)_minmax(120px,auto)] items-center gap-3 px-2 py-2.5">
      <span className="grid size-6 place-items-center text-text-muted">{icon}</span>
      <h2 className="text-[12px] font-medium text-foreground">{title}</h2>
      <p className="min-w-0 truncate text-right text-[11px] text-text-muted" title={value}>{value}</p>
    </section>
  );
}
