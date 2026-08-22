"use client";

import type { ApiProjectCharacterDetail } from "@/features/characters/api/characters.api";

interface CharacterNotesTabProps {
  character: ApiProjectCharacterDetail;
}

export function CharacterNotesTab({ character }: Readonly<CharacterNotesTabProps>) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-5">
      <h2 className="text-base font-bold text-text-primary">Ghi chú sáng tạo & Character Bible</h2>
      {character.version?.bible && (
        <div className="space-y-2">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Bible</span>
          <div className="rounded-xl border border-border bg-surface-2 p-4 text-xs leading-relaxed text-text-primary whitespace-pre-wrap">
            {character.version.bible}
          </div>
        </div>
      )}
      {character.version?.visualPrompt && (
        <div className="space-y-2">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Visual Prompt</span>
          <div className="rounded-xl border border-border bg-surface-2 p-4 text-xs leading-relaxed text-text-primary whitespace-pre-wrap">
            {character.version.visualPrompt}
          </div>
        </div>
      )}
      {character.appearance?.appearancePrompt && (
        <div className="space-y-2">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Appearance Prompt</span>
          <div className="rounded-xl border border-border bg-surface-2 p-4 text-xs leading-relaxed text-text-primary whitespace-pre-wrap">
            {character.appearance.appearancePrompt}
          </div>
        </div>
      )}
    </div>
  );
}
