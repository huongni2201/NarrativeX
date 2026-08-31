import { useEffect, useState, type ReactNode } from "react";
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
      <div className="grid max-w-[1040px] gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
        <SettingsGroup
          eyebrow="System"
          title="Runtime & Storage"
          description="Trạng thái các dịch vụ và dữ liệu local mà Desktop đang sử dụng."
        >
          <SettingRow icon={<Cpu size={16} />} title="Local executor" value={executorState} />
          <SettingRow icon={<Database size={16} />} title="Backend workspace" value={workspace.status} />
          <SettingRow icon={<HardDrive size={16} />} title="Local assets" value={`${workspace.assets.length} assets`} />
        </SettingsGroup>

        <SettingsGroup
          eyebrow="Project"
          title="Project Defaults"
          description="Các preset hiện có được dùng làm nguồn cấu hình cho creative workflow."
        >
          <SettingRow icon={<Palette size={16} />} title="Style presets" value={`${workspace.presets.length} presets`} />
        </SettingsGroup>
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
    <section className="overflow-hidden border border-border-subtle bg-surface-panel">
      <header className="border-b border-border-subtle px-4 py-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-text-dim">{eyebrow}</span>
        <h2 className="mt-0.5 text-[13px] font-semibold text-foreground">{title}</h2>
        <p className="mt-1 max-w-xl text-[10px] leading-4 text-text-muted">{description}</p>
      </header>
      <div className="divide-y divide-border-subtle">{children}</div>
    </section>
  );
}

function SettingRow({ icon, title, value }: Readonly<{ icon: ReactNode; title: string; value: string }>) {
  return (
    <div className="grid min-h-12 grid-cols-[28px_minmax(0,1fr)_minmax(140px,auto)] items-center gap-3 px-4 py-2">
      <span className="grid size-7 place-items-center text-text-muted">{icon}</span>
      <span className="text-[11px] font-medium text-foreground">{title}</span>
      <span className="min-w-0 truncate text-right text-[10px] text-text-muted" title={value}>{value}</span>
    </div>
  );
}
