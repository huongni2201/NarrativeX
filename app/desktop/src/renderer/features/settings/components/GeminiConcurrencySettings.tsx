import { RotateCcw, Sparkles } from "lucide-react";
import type { DesktopPreferences } from "../../../../preload/types";
import { Button } from "../../../components/ui/button";

const MIN_TABS = 1;
const MAX_TABS = 8;

export function GeminiConcurrencySettings({
  preferences,
  onUpdate,
  onReset,
}: Readonly<{
  preferences: DesktopPreferences | null;
  onUpdate: (field: "characterTabs" | "storyboardTabs", value: number) => void;
  onReset: () => void;
}>) {
  return (
    <section className="overflow-hidden border border-border-subtle bg-surface-panel">
      <header className="border-b border-border-subtle px-4 py-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-text-dim">Gemini</span>
        <h2 className="mt-0.5 text-[13px] font-semibold text-foreground">Generation Concurrency</h2>
        <p className="mt-1 max-w-xl text-[10px] leading-4 text-text-muted">
          Đây là giới hạn tổng trên toàn bộ browser pool, không nhân theo số browser đã thêm.
        </p>
      </header>
      <div className="divide-y divide-border-subtle">
        <ConcurrencyRow
          title="Character parallel tabs"
          value={preferences?.gemini.characterTabs ?? 2}
          environmentDefault={preferences?.gemini.environmentDefaults.characterTabs ?? 2}
          onChange={(value) => onUpdate("characterTabs", value)}
        />
        <ConcurrencyRow
          title="Storyboard parallel tabs"
          value={preferences?.gemini.storyboardTabs ?? 4}
          environmentDefault={preferences?.gemini.environmentDefaults.storyboardTabs ?? 4}
          onChange={(value) => onUpdate("storyboardTabs", value)}
        />
        <div className="grid min-h-14 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2">
          <span className="grid size-7 place-items-center text-text-muted"><RotateCcw size={16} /></span>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-foreground">Reset Gemini generation settings</div>
            <div className="text-[9px] text-text-dim">Restore Character and Storyboard concurrency to environment defaults. Browser logins are preserved.</div>
          </div>
          <Button size="sm" variant="outline" onClick={onReset}>Reset</Button>
        </div>
      </div>
    </section>
  );
}

function ConcurrencyRow({
  title,
  value,
  environmentDefault,
  onChange,
}: Readonly<{
  title: string;
  value: number;
  environmentDefault: number;
  onChange: (value: number) => void;
}>) {
  return (
    <div className="grid min-h-14 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2">
      <span className="grid size-7 place-items-center text-text-muted"><Sparkles size={16} /></span>
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
