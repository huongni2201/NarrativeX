import type { ReactNode } from "react";
import { AudioLines, Mic2, Sparkles, Volume2, X } from "lucide-react";

export function VoiceLibraryRail() {
  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-[var(--voice-rail)] px-4 py-4">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <span className="text-[9px] font-bold uppercase tracking-[.18em] text-text-muted">
            Library
          </span>
          <h2 className="mt-1 text-sm font-semibold">Voice &amp; TTS</h2>
        </div>
        <span aria-hidden="true" className="grid size-7 place-items-center text-text-muted">
          <X size={14} />
        </span>
      </div>

      <nav className="grid gap-1 py-3" aria-label="Voice library sections">
        <RailItem icon={<AudioLines size={15} />} label="Narration" />
        <RailItem icon={<Mic2 size={15} />} label="Voice catalog" active />
        <RailItem icon={<Volume2 size={15} />} label="Voice takes" />
      </nav>

      <div className="mt-3 rounded-md border border-primary/20 bg-primary-muted/60 p-3 text-[10px] leading-5 text-text-secondary">
        <Sparkles className="mb-2 text-primary-hover" size={15} />
        <p>
          Library content dùng ở phạm vi toàn workspace. Bạn có thể lọc, nghe thử và sử dụng cho
          dự án.
        </p>
      </div>

      <div className="mt-auto border-t border-border pt-3 text-[10px] text-text-muted">
        <span className="mr-1.5 inline-block size-1.5 rounded-full bg-success" />
        Local workspace
        <span className="float-right">v1.0.0</span>
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
      className={`flex h-9 items-center gap-2 rounded-md px-2.5 text-left text-[10px] ${
        active ? "bg-primary-muted text-foreground" : "text-text-secondary"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}
