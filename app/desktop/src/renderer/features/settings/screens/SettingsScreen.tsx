import { useEffect, useState, type ReactNode } from "react";
import { Cpu, Database, HardDrive, Palette, RotateCcw, Sparkles } from "lucide-react";
import type { DesktopPreferences, DesktopPreferenceResetScope } from "../../../../preload/types";
import { Button } from "../../../components/ui/button";
import { FeaturePage } from "../../workspace/components/FeaturePage";
import type { DesktopWorkspaceState } from "../../workspace/queries/useProjectWorkspace";

const MIN_TABS = 1;
const MAX_TABS = 8;

export function SettingsScreen({
  workspace,
}: Readonly<{
  workspace: DesktopWorkspaceState;
}>) {
  const [executorState, setExecutorState] = useState("Checking…");
  const [preferences, setPreferences] = useState<DesktopPreferences | null>(null);
  const [preferenceNotice, setPreferenceNotice] = useState<string | null>(null);

  useEffect(() => {
    void window.narrativex.localExecution
      .status()
      .then((status) => setExecutorState(`${status.state}${status.deviceId ? ` · ${status.deviceId}` : ""}`))
      .catch(() => setExecutorState("Unavailable"));
    void window.narrativex.preferences
      .get()
      .then(setPreferences)
      .catch((error) => setPreferenceNotice(error instanceof Error ? error.message : "Unable to load personalized settings."));
  }, []);

  async function updateGemini(field: "characterTabs" | "storyboardTabs", value: number) {
    if (!preferences) return;
    const clamped = Math.min(MAX_TABS, Math.max(MIN_TABS, value));
    try {
      const next = await window.narrativex.preferences.updateGemini({ [field]: clamped });
      setPreferences(next);
      setPreferenceNotice("Saved. New Gemini queues will use this concurrency.");
    } catch (error) {
      setPreferenceNotice(error instanceof Error ? error.message : "Unable to save Gemini settings.");
    }
  }

  async function resetPreferences(scope: DesktopPreferenceResetScope) {
    try {
      const next = await window.narrativex.preferences.reset(scope);
      setPreferences(next);
      setPreferenceNotice(
        scope === "GEMINI"
          ? "Gemini settings reset to environment defaults."
          : scope === "WINDOW"
            ? "Window layout reset."
            : "All personalized settings reset.",
      );
    } catch (error) {
      setPreferenceNotice(error instanceof Error ? error.message : "Unable to reset personalized settings.");
    }
  }

  return (
    <FeaturePage
      title="Desktop Settings"
      description="Runtime diagnostics, project defaults và personalized Desktop preferences."
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

        <div className="lg:col-span-2">
          <SettingsGroup
            eyebrow="Personalization"
            title="Gemini Image Generation"
            description="Mỗi user có cấu hình riêng trên máy này. Thay đổi concurrency được áp dụng cho queue Gemini tiếp theo."
          >
            <ConcurrencyRow
              icon={<Sparkles size={16} />}
              title="Character parallel tabs"
              value={preferences?.gemini.characterTabs ?? 2}
              environmentDefault={preferences?.gemini.environmentDefaults.characterTabs ?? 2}
              onChange={(value) => void updateGemini("characterTabs", value)}
            />
            <ConcurrencyRow
              icon={<Sparkles size={16} />}
              title="Storyboard parallel tabs"
              value={preferences?.gemini.storyboardTabs ?? 4}
              environmentDefault={preferences?.gemini.environmentDefaults.storyboardTabs ?? 4}
              onChange={(value) => void updateGemini("storyboardTabs", value)}
            />
            <ResetRow
              title="Reset Gemini generation settings"
              description="Remove this user's overrides and use environment defaults again."
              onReset={() => void resetPreferences("GEMINI")}
            />
            <ResetRow
              title="Reset window layout"
              description="Forget this user's saved size/position and restore the default Desktop layout."
              onReset={() => void resetPreferences("WINDOW")}
            />
            <ResetRow
              title="Reset all personalized settings"
              description="Reset only the current user's Gemini and window preferences on this device."
              onReset={() => void resetPreferences("ALL")}
            />
          </SettingsGroup>
          {preferenceNotice && (
            <p className="mt-2 text-[10px] text-text-muted">{preferenceNotice}</p>
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

function ConcurrencyRow({
  icon,
  title,
  value,
  environmentDefault,
  onChange,
}: Readonly<{
  icon: ReactNode;
  title: string;
  value: number;
  environmentDefault: number;
  onChange: (value: number) => void;
}>) {
  return (
    <div className="grid min-h-14 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2">
      <span className="grid size-7 place-items-center text-text-muted">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-foreground">{title}</div>
        <div className="text-[9px] text-text-dim">Environment default: {environmentDefault} · allowed 1–8</div>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={value <= MIN_TABS} onClick={() => onChange(value - 1)} aria-label={`Decrease ${title}`}>
          −
        </Button>
        <span className="w-8 text-center text-[11px] font-semibold text-foreground">{value}</span>
        <Button size="sm" variant="outline" disabled={value >= MAX_TABS} onClick={() => onChange(value + 1)} aria-label={`Increase ${title}`}>
          +
        </Button>
      </div>
    </div>
  );
}

function ResetRow({
  title,
  description,
  onReset,
}: Readonly<{ title: string; description: string; onReset: () => void }>) {
  return (
    <div className="grid min-h-14 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2">
      <span className="grid size-7 place-items-center text-text-muted"><RotateCcw size={16} /></span>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-foreground">{title}</div>
        <div className="text-[9px] text-text-dim">{description}</div>
      </div>
      <Button size="sm" variant="outline" onClick={onReset}>Reset</Button>
    </div>
  );
}
