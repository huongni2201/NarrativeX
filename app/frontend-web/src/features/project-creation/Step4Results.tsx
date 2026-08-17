import React, { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { isMockDataMode } from "@/lib/data-mode";
import { MOCK_CHARACTERS, MOCK_PROJECT_CHARACTERS } from "@/lib/mock-data";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Edit3, ArrowRight, Check, Sparkles, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Step4Props {
  onBack: () => void;
}

export const Step4Results: React.FC<Step4Props> = ({ onBack }) => {
  const { setScreen, openCharacterBible } = useStudioStore();
  const [activeTab, setActiveTab] = useState("characters");
  const characters = isMockDataMode ? MOCK_CHARACTERS : [];
  const projectCharacters = isMockDataMode ? MOCK_PROJECT_CHARACTERS : [];

  const resultTabs = [
    { id: "characters", label: "Nhân vật" },
    { id: "locations", label: "Địa điểm" },
    { id: "chapters", label: "Chương & Cảnh" },
    { id: "visual_beats", label: "Visual Beats" },
  ];

  const mainCharacters = characters.slice(0, 4);

  return (
    <div className="space-y-6 min-h-[480px]">
      {/* Header with Title and Quick Edit */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Kết quả phân tích</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            AI đã hoàn tất việc trích xuất và khởi tạo cấu trúc cho toàn bộ câu chuyện.
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Chỉnh sửa</span>
        </button>
      </div>

      {/* Counts are supplied by the analysis result in the next backend contract. */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/50 text-center">
          <div className="text-2xl font-extrabold text-white font-mono">—</div>
          <div className="text-xs text-purple-300 font-medium">Nhân vật</div>
        </div>
        <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/50 text-center">
          <div className="text-2xl font-extrabold text-white font-mono">—</div>
          <div className="text-xs text-purple-300 font-medium">Địa điểm</div>
        </div>
        <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/50 text-center">
          <div className="text-2xl font-extrabold text-white font-mono">—</div>
          <div className="text-xs text-purple-300 font-medium">Chương</div>
        </div>
        <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/50 text-center">
          <div className="text-2xl font-extrabold text-white font-mono">—</div>
          <div className="text-xs text-purple-300 font-medium">Cảnh</div>
        </div>
        <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/50 text-center">
          <div className="text-2xl font-extrabold text-white font-mono">—</div>
          <div className="text-xs text-purple-300 font-medium">Visual Beats</div>
        </div>
      </div>

      {/* Result Category Tabs */}
      <div className="border-b border-slate-800 pb-2">
        <Tabs
          tabs={resultTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="underlined"
        />
      </div>

      {/* Tab: Nhân vật Content */}
      {activeTab === "characters" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Nhân vật chính</h3>
            <button
              onClick={() => setScreen("characters")}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium"
            >
              Xem tất cả &gt;
            </button>
          </div>

          {characters.length > 0 ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {mainCharacters.map((char) => (
              <div
                key={char.id}
                onClick={() => openCharacterBible(char.id)}
                className="group relative bg-[#0a0f1d] hover:bg-[#111a29] border border-slate-800 hover:border-purple-500/60 rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
              >
                {/* Close/Remove Tag */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-black/60 hover:bg-black/90 flex items-center justify-center text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>

                {/* Portrait */}
                <div className="aspect-[3/4] w-full overflow-hidden bg-slate-900 relative">
                  <img
                    src={char.avatarUrl}
                    alt={char.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d] via-transparent to-black/20" />
                </div>

                {/* Meta info */}
                <div className="p-3 text-center space-y-1">
                  <h4 className="font-semibold text-sm text-slate-100 group-hover:text-purple-300 transition-colors">
                    {char.name}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {projectCharacters.find((assignment) => assignment.characterId === char.id)?.role ??
                      "Reusable identity"}
                  </p>
                </div>
              </div>
            ))}
          </div> : <p className="rounded-xl border border-slate-800/80 bg-[#0a0f1d] p-5 text-xs leading-5 text-slate-400">Kết quả nhân vật sẽ xuất hiện sau khi backend hoàn tất analysis job.</p>}
        </div>
      )}

      {/* Tab: Địa điểm Content */}
      {activeTab === "locations" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              name: "Thánh Điện Eldoria",
              desc: "Cung điện cổ đại với tháp pha lê ánh sáng",
              img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop",
            },
            {
              name: "Thung Lũng Valen",
              desc: "Vùng đất phủ sương mù dày đặc và rừng rậm cổ thụ",
              img: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=400&auto=format&fit=crop",
            },
            {
              name: "Pháo Đài Bão Tuyết",
              desc: "Căn cứ tiền tiêu trấn giữ phương Bắc băng giá",
              img: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&auto=format&fit=crop",
            },
          ].map((loc, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-[#0a0f1d] border border-slate-800 flex gap-3 items-center"
            >
              <img
                src={loc.img}
                alt={loc.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div>
                <h4 className="font-semibold text-sm text-slate-200">{loc.name}</h4>
                <p className="text-xs text-slate-400">{loc.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Chương & Cảnh */}
      {activeTab === "chapters" && (
        <div className="space-y-3">
          {[
            { ch: "Chương 1", title: "Khởi Đầu Của Bóng Tối", scenes: 6 },
            { ch: "Chương 2", title: "Lời Tiên Tri Cổ Đại", scenes: 8 },
            { ch: "Chương 3", title: "Cuộc Hội Ngộ Tại Eldoria", scenes: 5 },
          ].map((c, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-[#0a0f1d] border border-slate-800 flex items-center justify-between"
            >
              <div>
                <span className="text-xs text-purple-400 font-semibold">{c.ch}:</span>
                <span className="text-sm text-slate-200 font-medium ml-2">{c.title}</span>
              </div>
              <Badge variant="neutral">{c.scenes} cảnh</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Visual Beats */}
      {activeTab === "visual_beats" && (
        <div className="p-6 rounded-xl bg-[#0a0f1d] border border-slate-800 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-purple-400 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-200">
            Visual Beats sẽ được cập nhật từ analysis job
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Hệ thống đã chuẩn bị đầy đủ prompt keyframe, camera movement và consistency tokens cho các cảnh quay.
          </p>
        </div>
      )}
    </div>
  );
};
