"use client";

import { Image as ImageIcon, Sparkles } from "lucide-react";
import type { ApiProjectCharacterDetail } from "@/features/characters/api/characters.api";

interface CharacterVisualsTabProps {
  character: ApiProjectCharacterDetail;
}

export function CharacterVisualsTab({ character }: Readonly<CharacterVisualsTabProps>) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-text-primary">Visual Reference Gallery</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Các ảnh mẫu, asset phong cách và prompt visual liên kết với nhân vật {character.canonicalName}.
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-xl border border-primary bg-primary px-3.5 py-2 text-xs font-bold text-white transition hover:bg-primary-hover"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Tạo thêm Visual</span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="group relative overflow-hidden rounded-2xl border border-border bg-surface-2 p-3 transition hover:border-primary/60"
          >
            <div className="aspect-[3/4] rounded-xl bg-surface-elevated flex items-center justify-center border border-border/80 text-text-dim">
              <div className="text-center p-3">
                <ImageIcon className="mx-auto h-8 w-8 text-text-dim" />
                <span className="text-xs font-medium text-text-secondary block mt-2">
                  Visual Asset #{item}
                </span>
                <span className="text-[10px] text-text-muted block mt-0.5">
                  {character.canonicalName} · v{character.version?.versionNumber ?? 1}.0
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="font-semibold text-text-primary">Góc chụp #{item}</span>
              <span className="rounded border border-badge-purple-border bg-badge-purple-bg px-1.5 py-0.5 text-[10px] font-bold text-badge-purple">
                Chính
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
