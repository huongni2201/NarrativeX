import { AudioLines, AudioWaveform, Library, Mic2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import type { DesktopWorkspaceState } from "../../workspace/queries/useProjectWorkspace";
import { CharacterVoicesScreen } from "./CharacterVoicesScreen";
import { VieNeuVoicesScreen } from "./VieNeuVoicesScreen";
import { VoiceScreen } from "./VoiceScreen";

const tabs = [
  { id: "characters", label: "Giọng nhân vật", icon: Mic2 },
  { id: "narration", label: "Lời kể", icon: AudioLines },
  { id: "vieneu", label: "Giọng VieNeu", icon: AudioWaveform },
  { id: "library", label: "Thư viện giọng", icon: Library },
] as const;

export function AudioWorkspaceScreen({ projectId, workspace }: Readonly<{ projectId: string; workspace: DesktopWorkspaceState }>) {
  const [params, setParams] = useSearchParams();
  const tab = tabs.find(item => item.id === params.get("tab"))?.id ?? "characters";
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <nav aria-label="Các mục âm thanh" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle bg-surface-dark px-4 py-2">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined}
          onClick={() => setParams(previous => { const next = new URLSearchParams(previous); next.set("tab", id); return next; })}
          className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === id ? "bg-primary-muted text-primary" : "text-text-muted hover:bg-surface-2 hover:text-foreground"}`}>
          <Icon size={16} />{label}
        </button>)}
      </nav>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div hidden={tab !== "characters"} className="h-full">
          <CharacterVoicesScreen projectId={projectId} characters={workspace.characters} loading={workspace.status === "loading"} />
        </div>
        <div hidden={tab !== "vieneu"} className="h-full">
          <VieNeuVoicesScreen voices={workspace.voices} loading={workspace.status === "loading"} error={workspace.error} />
        </div>
        <div hidden={tab === "characters" || tab === "vieneu"} className="h-full">
          <VoiceScreen projectId={projectId} chapters={workspace.chapters} voices={workspace.voices} assets={workspace.assets} section={tab === "narration" ? "narration" : "library"} />
        </div>
      </div>
    </div>
  );
}
