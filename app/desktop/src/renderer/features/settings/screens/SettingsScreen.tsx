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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
        <SettingCard icon={<Cpu size={18} />} title="Local executor" value={executorState} />
        <SettingCard icon={<Database size={18} />} title="Backend workspace" value={workspace.status} />
        <SettingCard icon={<HardDrive size={18} />} title="Local assets" value={`${workspace.assets.length} assets`} />
        <SettingCard icon={<Palette size={18} />} title="Style presets" value={`${workspace.presets.length} presets`} />
      </div>
    </FeaturePage>
  );
}

function SettingCard({ icon, title, value }: Readonly<{ icon: React.ReactNode; title: string; value: string }>) {
  return <section className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"><span className="text-primary-hover">{icon}</span><div><h2 className="text-xs font-semibold">{title}</h2><p className="mt-1 text-[10px] text-muted-foreground">{value}</p></div></section>;
}
