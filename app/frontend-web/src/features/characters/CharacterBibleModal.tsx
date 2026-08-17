import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStudioStore } from "@/store/useStudioStore";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Lock,
  Plus,
  Edit3,
  Sparkles,
  LayoutDashboard,
  User,
  Brain,
  Shirt,
  Users2,
  History,
  FolderArchive,
  X,
  CheckCircle2,
  Camera,
  Layers,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isMockDataMode } from "@/lib/data-mode";
import { MOCK_CHARACTERS, MOCK_PROJECT_CHARACTERS, MOCK_PROJECTS } from "@/lib/mock-data";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const PROJECT_PAGE = 0;
const PROJECT_PAGE_SIZE = 20;

export const CharacterBibleModal: React.FC = () => {
  const {
    currentScreen,
    selectedCharacterId,
    selectedProjectId,
    closeCharacterBible,
  } = useStudioStore();
  const projectsQuery = useQuery({
    queryKey: queryKeys.projectsPage(PROJECT_PAGE, PROJECT_PAGE_SIZE),
    queryFn: () => api.listProjects({ page: PROJECT_PAGE, size: PROJECT_PAGE_SIZE }),
    enabled: !isMockDataMode,
  });
  const projects = isMockDataMode ? MOCK_PROJECTS : projectsQuery.data?.content ?? [];
  const characters = isMockDataMode ? MOCK_CHARACTERS : [];
  const projectCharacters = isMockDataMode ? MOCK_PROJECT_CHARACTERS : [];

  const [activeSubTab, setActiveSubTab] = useState("overview");
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  if (currentScreen !== "character-bible") return null;

  const character =
    characters.find((c) => c.id === selectedCharacterId) || characters[0];
  if (!character) return null;

  const projectCharacter =
    projectCharacters.find(
      (assignment) =>
        assignment.characterId === character.id && assignment.projectId === selectedProjectId
    ) ?? projectCharacters.find((assignment) => assignment.characterId === character.id);
  const assignedProject = projects.find((project) => String(project.id) === projectCharacter?.projectId);

  const subNavItems = [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "appearance", label: "Ngoại hình", icon: User },
    { id: "personality", label: "Tính cách", icon: Brain },
    { id: "costume", label: "Trang phục", icon: Shirt },
    { id: "relationships", label: "Quan hệ", icon: Users2 },
    { id: "history", label: "Lịch sử phát triển", icon: History },
    { id: "assets", label: "Tài sản liên quan", icon: FolderArchive },
  ];

  const handleCopyPrompt = () => {
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <Modal
      isOpen={currentScreen === "character-bible"}
      onClose={closeCharacterBible}
      maxWidth="6xl"
      className="p-0 border border-slate-800 bg-[#0d1420]"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#090e18]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              08. Chi tiết nhân vật (Character Bible)
            </h2>
          </div>
        </div>

        <button
          onClick={closeCharacterBible}
          aria-label="Đóng Character Bible"
          className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main 3-Column Layout matching Mockup 08 */}
      <div className="flex flex-col md:flex-row min-h-[580px]">
        {/* Column 1: Left Sub-Nav (w-52) */}
        <div className="w-full md:w-52 border-b md:border-b-0 md:border-r border-slate-800/80 p-3 space-y-1 bg-[#090e18]/80 shrink-0">
          {subNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
                  isActive
                    ? "bg-purple-900/40 text-purple-300 border border-purple-800/50 font-semibold shadow-[0_0_12px_rgba(124,58,237,0.15)]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", isActive ? "text-purple-400" : "text-slate-500")} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Column 2: Center Hero Portrait (w-72) */}
        <div className="w-full md:w-72 p-6 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-slate-800/80 bg-[#0a0f1d]/60 shrink-0 gap-4">
          <div className="relative w-full aspect-[3/4] max-w-[260px] rounded-2xl overflow-hidden border border-purple-500/40 shadow-[0_0_30px_rgba(124,58,237,0.25)] group">
            <img
              src={character.fullPortraitUrl || character.avatarUrl}
              alt={character.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 text-center">
              <span className="text-[11px] font-semibold text-white tracking-wider uppercase font-mono drop-shadow-md">
                MASTER PORTRAIT V{character.latestVersion.versionNumber}
              </span>
            </div>
          </div>

          <div className="w-full text-center">
            <button
              onClick={handleCopyPrompt}
              className="w-full py-1.5 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              {copiedPrompt ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Đã sao chép prompt</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sao chép consistency prompt</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Column 3: Right Details & Dynamic Content Tab (flex-1) */}
        <div className="flex-1 p-6 md:p-8 space-y-6 flex flex-col justify-between overflow-y-auto">
          {/* Tab 1: Tổng quan (Overview) */}
          {activeSubTab === "overview" && (
            <div className="space-y-5">
              {/* Header / Name & Version Badges */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-extrabold text-white tracking-tight">
                    {character.name}
                  </h1>
                  <Badge variant="primary" size="sm">
                    Version {character.latestVersion.versionNumber}
                  </Badge>
                  {character.latestVersion.status === "LOCKED" && (
                    <Badge variant="locked" size="sm">
                      <Lock className="w-3 h-3 text-slate-400" /> LOCKED
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-purple-400">
                    {assignedProject?.name ?? "Global Character Hub"}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {character.description}
                  </p>
                </div>
              </div>

              {/* Thông tin cơ bản Key-Value specs */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Thông tin cơ bản
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-3.5 rounded-xl bg-[#090e18] border border-slate-800/80 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Vai trò</span>
                    <span className="text-slate-200 font-semibold">
                      {projectCharacter?.role ?? "Canonical identity"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Giới tính</span>
                    <span className="text-slate-200 font-semibold">{character.gender}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Tuổi</span>
                    <span className="text-slate-200 font-semibold">{character.age}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Chiều cao</span>
                    <span className="text-slate-200 font-semibold">{character.height}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Màu tóc</span>
                    <span className="text-slate-200 font-semibold">{character.hairColor}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Màu mắt</span>
                    <span className="text-slate-200 font-semibold">{character.eyeColor}</span>
                  </div>
                </div>
              </div>

              {/* Reference Assets Grid (6 angles) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Reference Assets
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {character.referenceAssets?.length || 0}/6 slots
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {character.referenceAssets && character.referenceAssets.length > 0 ? (
                    character.referenceAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="group aspect-square rounded-lg overflow-hidden border border-slate-800 hover:border-purple-500/60 bg-slate-900 relative cursor-pointer"
                        title={asset.title}
                      >
                        <img
                          src={asset.imageUrl}
                          alt={asset.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="col-span-6 p-4 rounded-lg bg-[#090e18] border border-slate-800 text-center text-xs text-slate-400">
                      Chưa có reference assets bổ sung.
                    </div>
                  )}
                </div>

                {/* + Thêm tài sản button */}
                <button
                  type="button"
                  className="w-full py-2 px-3 rounded-lg border border-dashed border-slate-800 hover:border-purple-500/50 bg-[#090e18]/60 text-xs font-medium text-slate-300 hover:text-purple-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm tài sản</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Ngoại hình (Appearance) */}
          {activeSubTab === "appearance" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Chi tiết nhận diện ngoại hình</h3>
              <div className="p-4 rounded-xl bg-[#090e18] border border-slate-800 space-y-3 text-xs leading-relaxed text-slate-300">
                <p>{character.appearance || "Mái tóc vàng gợn sóng buông dài, đôi mắt ngọc lục bảo sắc sảo. Đường nét gương mặt thanh tú, khí chất vương tộc cao quý."}</p>
                <div className="border-t border-slate-800 pt-3 space-y-1">
                  <h4 className="font-semibold text-purple-400">Gợi ý ánh sáng và góc máy (Cinematic Guidelines):</h4>
                  <p className="text-slate-400">Ưu tiên góc chụp chân dung 3/4 (three-quarter view) với ánh sáng mềm ấm (warm rim light) để tôn lên mái tóc vàng và ngọc bích.</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Tính cách (Personality) */}
          {activeSubTab === "personality" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Tính cách & Tâm lý học nhân vật</h3>
              <div className="p-4 rounded-xl bg-[#090e18] border border-slate-800 space-y-3 text-xs leading-relaxed text-slate-300">
                <p>{character.personality || "Kiên cường, quả cảm, giàu lòng trắc ẩn nhưng đôi khi quá nghiêm khắc với bản thân trước sứ mệnh bảo vệ vương quốc."}</p>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/40">
                    <span className="font-semibold text-purple-300">Động lực cốt lõi:</span>
                    <p className="text-slate-400 mt-1">Khôi phục ánh sáng và phong ấn chúa tể bóng tối.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40">
                    <span className="font-semibold text-amber-300">Điểm yếu tâm lý:</span>
                    <p className="text-slate-400 mt-1">Nỗi sợ mất đi những người đồng đội thân yêu.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Trang phục (Costume) */}
          {activeSubTab === "costume" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Thiết kế phục trang & Phụ kiện</h3>
              <div className="p-4 rounded-xl bg-[#090e18] border border-slate-800 space-y-3 text-xs leading-relaxed text-slate-300">
                <p>{character.costume || "Trang phục chiến binh dạ quang Eldoria với đường nét thêu chỉ bạc và áo choàng lụa xanh sapphire."}</p>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-purple-300">
                  Prompt Token: `royal armor gown, ornate silver embroidery, sapphire blue silk mantle, crystal brooch`
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Quan hệ (Relationships) */}
          {activeSubTab === "relationships" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Mối quan hệ nhân vật</h3>
              <div className="p-4 rounded-xl bg-[#090e18] border border-slate-800 space-y-3 text-xs leading-relaxed text-slate-300">
                <p>{character.relationships || "Đồng đội thân thiết với Kael, được Lyria bảo hộ pháp thuật, Darius là người thầy huấn luyện kiếm thuật."}</p>
              </div>
            </div>
          )}

          {/* Tab 6: Lịch sử phát triển (History) */}
          {activeSubTab === "history" && (
            <div className="space-y-3 text-xs">
              <h3 className="text-sm font-bold text-white mb-2">Lịch sử các phiên bản (Version Snapshots)</h3>
              <div className="p-3 rounded-lg bg-[#090e18] border border-purple-800/60 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-purple-300">Version 2 (Current Master - LOCKED)</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">Khóa chuẩn nhận diện khuôn mặt và phục trang chiến trận.</p>
                </div>
                <Badge variant="locked" size="sm"><Lock className="w-3 h-3" /> LOCKED</Badge>
              </div>
              <div className="p-3 rounded-lg bg-[#090e18] border border-slate-800/80 flex items-center justify-between opacity-70">
                <div>
                  <span className="font-semibold text-slate-300">Version 1 (Initial Draft)</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">Bản phác thảo ý tưởng ban đầu trước khi duyệt character consistency.</p>
                </div>
                <Badge variant="neutral" size="sm">Archived</Badge>
              </div>
            </div>
          )}

          {/* Tab 7: Tài sản liên quan (Assets) */}
          {activeSubTab === "assets" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Tài sản render & LoRA checkpoint</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#090e18] border border-slate-800">
                  <Camera className="w-4 h-4 text-purple-400 mb-1" />
                  <span className="font-semibold text-slate-200">Face ID Embedding</span>
                  <p className="text-slate-400 text-[11px] mt-1">`eleanor_face_v2_1024.safetensors`</p>
                </div>
                <div className="p-3 rounded-xl bg-[#090e18] border border-slate-800">
                  <Layers className="w-4 h-4 text-purple-400 mb-1" />
                  <span className="font-semibold text-slate-200">Costume Consistency LoRA</span>
                  <p className="text-slate-400 text-[11px] mt-1">`eldoria_royal_armor_v2.safetensors`</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer Buttons matching Mockup */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
            <Button variant="secondary" size="md">
              <Edit3 className="w-3.5 h-3.5 mr-1.5" />
              <span>Chỉnh sửa</span>
            </Button>
            <Button
              variant="gradient"
              size="md"
              className="shadow-[0_0_20px_rgba(124,58,237,0.4)]"
            >
              <span>Tạo phiên bản mới</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
