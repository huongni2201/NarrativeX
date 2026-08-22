"use client";

import type { ApiProjectAsset } from "@/features/projects/api/project-resources.types";

interface CharacterAssetsTabProps {
  projectAssets: ApiProjectAsset[];
}

export function CharacterAssetsTab({ projectAssets }: Readonly<CharacterAssetsTabProps>) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-4">
      <h2 className="text-base font-bold text-text-primary">Tài sản kịch bản (Assets)</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projectAssets.length > 0 ? (
          projectAssets.map((asset) => (
            <div key={asset.id} className="rounded-xl border border-border bg-surface-2 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary">{asset.name}</span>
                <span className="text-[10px] rounded border border-border px-1.5 py-0.5 text-text-muted">
                  {asset.assetType}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">{asset.storageKey}</p>
            </div>
          ))
        ) : (
          <div className="col-span-full py-8 text-center text-xs text-text-muted">
            Chưa có tài sản nào được đăng ký cho nhân vật này.
          </div>
        )}
      </div>
    </div>
  );
}
