import type { ReactNode } from "react";
import { AudioLines, Mic2, Volume2, X } from "lucide-react";

export function VoiceLibraryRail() {
  return (
    <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-surface-dark px-3 py-4">
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">Library</span>
          <h2 className="mt-0.5 text-[13px] font-semibold text-foreground">Voice &amp; TTS</h2>
        </div>
        <span aria-hidden="true" className="grid size-7 place-items-center text-text-muted">
          <X size={13} />
        </span>
      </div>

      <nav className="grid gap-0.5 py-3" aria-label="Voice library sections">
        <RailItem icon={<AudioLines size={14} />} label="Narration" />
        <RailItem icon={<Mic2 size={14} />} label="Voice catalog" active />
        <RailItem icon={<Volume2 size={14} />} label="Voice takes" />
      </nav>

      <div className="mt-2 border-t border-border-subtle pt-3 text-[10px] leading-4 text-text-muted">
        Library content dùng ở phạm vi workspace. Lọc, nghe thử và sử dụng voice cho project hiện tại.
      </div>

      <div className="mt-auto border-t border-border-subtle pt-3 text-[10px] text-text-muted">
        <span className="mr-1.5 inline-block size-1.5 rounded-full bg-success" />
        Local workspace
      </div>
    </aside>
  );
}

function RailItem({
  icon,
  label,
  active = false,
}: Readonly<{ icon: ReactNode; label: string; active?: boolean }>) {
  return (
    <div
      className={`relative flex h-8 items-center gap-2 rounded-sm px-2.5 text-left text-[10px] font-medium transition-colors ${
        active
          ? "bg-primary-muted text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
          : "text-text-muted hover:bg-surface-2 hover:text-text-secondary"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}
