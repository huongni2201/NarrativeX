import React, { useMemo, useState } from "react";
import { MOCK_CHARACTERS, MOCK_PROJECT_CHARACTERS } from "@/lib/mock-data";
import { Tabs } from "@/components/ui/Tabs";
import { Sparkles } from "lucide-react";

interface Step4DemoResultsProps {
  onBack: () => void;
}

const resultTabs = [
  { id: "characters", label: "Nhân vật" },
  { id: "locations", label: "Địa điểm" },
  { id: "chapters", label: "Chương & Cảnh" },
  { id: "visual_beats", label: "Visual Beats" },
];

export function Step4DemoResults({ onBack }: Readonly<Step4DemoResultsProps>) {
  const [activeTab, setActiveTab] = useState("characters");
  const assignmentsByCharacterId = useMemo(
    () => new Map(MOCK_PROJECT_CHARACTERS.map((assignment) => [assignment.characterId, assignment])),
    [],
  );
  const characters = MOCK_CHARACTERS.slice(0, 4);

  return (
    <div className="min-h-[480px] space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">Demo data</p>
          <h2 className="mt-1 text-xl font-bold text-white">Kết quả phân tích mẫu</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Màn này chỉ được tải trong mock/test runtime; production API mode không đóng gói fixture vào entry path.
          </p>
        </div>
        <button type="button" onClick={onBack} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
          Chỉnh sửa
        </button>
      </div>

      <Tabs tabs={resultTabs} activeTab={activeTab} onChange={setActiveTab} variant="underlined" />

      {activeTab === "characters" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {characters.map((character) => (
            <article key={character.id} className="overflow-hidden rounded-xl border border-slate-800 bg-[#0a0f1d]">
              <img src={character.avatarUrl} alt={character.name} className="aspect-[3/4] w-full object-cover" />
              <div className="p-3">
                <h3 className="text-sm font-semibold text-slate-100">{character.name}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {assignmentsByCharacterId.get(character.id)?.role ?? "Reusable identity"}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeTab !== "characters" && (
        <div className="rounded-xl border border-dashed border-slate-700 bg-[#0a0f1d] p-8 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-purple-400" />
          <p className="mt-3 text-sm font-semibold text-slate-200">Demo preview</p>
          <p className="mt-1 text-xs text-slate-400">Dữ liệu chi tiết của tab này sẽ đến từ analysis API thật.</p>
        </div>
      )}
    </div>
  );
}
