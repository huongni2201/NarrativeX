import { useState } from "react";
import { Users, Mic2, Compass, ShieldCheck } from "lucide-react";
import type { DesktopWorkspaceState } from "../../workspace/queries/useProjectWorkspace";
import { CharactersScreen } from "../../characters/screens/CharactersScreen";
import { VoiceScreen } from "../../voices/screens/VoiceScreen";

export interface ProjectCanonScreenProps {
  projectId: string;
  workspace: DesktopWorkspaceState;
}

export function ProjectCanonScreen({ projectId, workspace }: ProjectCanonScreenProps) {
  const [activeTab, setActiveTab] = useState<"characters" | "voices" | "continuity">("characters");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Canon Navigation Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-dark px-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("characters")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[13px] font-medium transition-all ${
                activeTab === "characters"
                  ? "bg-primary-muted text-primary shadow-sm"
                  : "text-text-muted hover:text-foreground"
              }`}
            >
              <Users size={15} />
              <span>Nhân vật (Characters)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("voices")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[13px] font-medium transition-all ${
                activeTab === "voices"
                  ? "bg-primary-muted text-primary shadow-sm"
                  : "text-text-muted hover:text-foreground"
              }`}
            >
              <Mic2 size={15} />
              <span>Giọng đọc (Voices)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("continuity")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-[13px] font-medium transition-all ${
                activeTab === "continuity"
                  ? "bg-primary-muted text-primary shadow-sm"
                  : "text-text-muted hover:text-foreground"
              }`}
            >
              <Compass size={15} />
              <span>Bối cảnh & Tính liên tục (Continuity)</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-text-muted">
          <ShieldCheck size={14} className="text-success" />
          <span>Project Canon: Frozen & Authoritative</span>
        </div>
      </div>

      {/* Canon Content View */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "characters" && (
          <CharactersScreen projectId={projectId} characters={workspace.characters} />
        )}

        {activeTab === "voices" && (
          <VoiceScreen
            projectId={projectId}
            chapters={workspace.chapters}
            voices={workspace.voices}
            assets={workspace.assets}
          />
        )}

        {activeTab === "continuity" && (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-text-muted">
            <Compass size={44} className="mb-3 text-text-dim" />
            <h3 className="text-[16px] font-semibold text-foreground">Tính liên tục & Địa điểm (World Continuity)</h3>
            <p className="mt-1 max-w-md text-[13px] leading-relaxed text-text-secondary">
              Các sự kiện, bối cảnh không gian và nhân vật được tự động đồng bộ từ quá trình Phân tích Chương (Chapter Analyze) và đối chiếu với Project Canon.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
