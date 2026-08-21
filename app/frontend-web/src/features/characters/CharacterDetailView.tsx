"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronRight,
  Clapperboard,
  Edit3,
  FileText,
  Film,
  Folder,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  SlidersHorizontal,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { charactersApi } from "@/features/characters/api/characters.api";
import { projectsApi } from "@/features/projects/api/projects.api";
import { queryKeys } from "@/lib/query-keys";

interface CharacterDetailViewProps {
  characterId: number;
  projectId?: number;
}

type CharacterDetailTab = "overview" | "visuals" | "scenes" | "assets" | "notes" | "history";

// Demo reference visual images
const DEMO_VISUAL_REFERENCES = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=400&auto=format&fit=crop",
];

const DEMO_RELATIONSHIPS = [
  {
    id: 1,
    name: "Hạ Vy",
    roleNote: "Bạn thời thơ ấu",
    badgeLabel: "Thân thiết",
    badgeColorClass: "bg-purple-950/80 text-purple-300 border-purple-700/60",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop",
  },
  {
    id: 2,
    name: "Minh Đức",
    roleNote: "Đối tác",
    badgeLabel: "Đồng hành",
    badgeColorClass: "bg-blue-950/80 text-blue-300 border-blue-700/60",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=150&auto=format&fit=crop",
  },
  {
    id: 3,
    name: "Ông Trần",
    roleNote: "Người thầy / Cha nuôi",
    badgeLabel: "Kính trọng",
    badgeColorClass: "bg-emerald-950/80 text-emerald-400 border-emerald-500/40",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop",
  },
];

const DEMO_SCENES = [
  { id: 1, chapterName: "Chương 1: The First Lantern", role: "Chính", timestamp: "00:02:14" },
  { id: 2, chapterName: "Chương 2: The Hidden Truth", role: "Chính", timestamp: "00:03:22" },
  { id: 3, chapterName: "Chương 3: Test Chapter Empty State", role: "Chính", timestamp: "00:05:37" },
  { id: 4, chapterName: "Chương 5: The Festival Night", role: "Chính", timestamp: "00:12:08" },
];

export function CharacterDetailView({
  characterId,
  projectId,
}: Readonly<CharacterDetailViewProps>) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CharacterDetailTab>("overview");

  // Fetch Project details if in project context
  const projectQuery = useQuery({
    queryKey: projectId ? queryKeys.project(projectId) : ["projects", "invalid"],
    queryFn: () => (projectId ? projectsApi.getById(projectId) : null),
    enabled: Boolean(projectId),
  });

  // Fetch Characters list to find current character
  const charactersQuery = useQuery({
    queryKey: queryKeys.characters,
    queryFn: () => charactersApi.list({ limit: 50 }),
  });

  const rawCharacter = useMemo(() => {
    const list = charactersQuery.data?.content ?? [];
    return list.find((c) => c.id === characterId) ?? null;
  }, [characterId, charactersQuery.data?.content]);

  const characterName = rawCharacter?.canonicalName || "Lâm Khang";
  const projectName = projectQuery.data?.name || "Lanterns of the Old Quarter";

  return (
    <div className="space-y-6">
      {/* 1. Breadcrumbs Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400">
        {projectId ? (
          <>
            <Link href="/projects" className="hover:text-purple-300 transition-colors font-medium">
              Dự án
            </Link>
            <span className="text-slate-600">/</span>
            <Link
              href={`/projects/${projectId}`}
              className="hover:text-purple-300 transition-colors font-semibold text-slate-300"
            >
              {projectName}
            </Link>
            <span className="text-slate-600">/</span>
            <button
              type="button"
              onClick={() => router.push(`/projects/${projectId}`)}
              className="hover:text-purple-300 transition-colors text-slate-400"
            >
              Nhân vật
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200 font-semibold">{characterName}</span>
          </>
        ) : (
          <>
            <Link href="/characters" className="hover:text-purple-300 transition-colors font-medium">
              Nhân vật
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200 font-semibold">{characterName}</span>
          </>
        )}
      </nav>

      {/* 2. Top Hero Card Banner */}
      <section className="flex flex-col md:flex-row gap-5 p-5 rounded-2xl bg-[#0d1420] border border-slate-800/90 shadow-2xl items-stretch">
        {/* Large Portrait Image */}
        <div className="relative w-full sm:w-48 md:w-52 lg:w-56 h-60 sm:h-auto sm:aspect-[4/5] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 shadow-xl group">
          <img
            src={DEMO_VISUAL_REFERENCES[0]}
            alt={characterName}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Info & Metrics */}
        <div className="flex min-w-0 flex-1 flex-col justify-between space-y-3">
          <div className="space-y-2">
            {/* Top Row: Name, Badges & Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                  {characterName}
                </h1>
                <span className="rounded-md border border-purple-700/60 bg-purple-950/80 px-2 py-0.5 text-xs font-bold text-purple-300">
                  Chính
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-950/80 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Hoàn thiện
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                  <span>Chỉnh sửa nhân vật</span>
                </button>

                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-purple-950/60 transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Tạo visual</span>
                </button>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-300/90 leading-relaxed max-w-3xl line-clamp-2">
              Một nghệ nhân chế tác đèn lồng trẻ của phố cổ. Mang trong mình khát vọng khôi phục ánh sáng truyền thống giữa thời cuộc đổi thay, anh âm thầm theo đuổi công lý cho sự thật về quá khứ gia đình.
            </p>

            {/* Date Meta */}
            <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] font-mono text-slate-400">
              <span>Tạo ngày: 18/08/2026</span>
              <span>•</span>
              <span>Cập nhật: 21/08/2026 • 08:26</span>
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Metric 1 */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-[#090e18]/80 p-2.5 px-3.5 shadow-inner">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <span className="block font-mono text-lg font-bold text-white leading-tight">8</span>
                <span className="text-[11px] text-slate-400">Scene xuất hiện</span>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-[#090e18]/80 p-2.5 px-3.5 shadow-inner">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div>
                <span className="block font-mono text-lg font-bold text-white leading-tight">16</span>
                <span className="text-[11px] text-slate-400">Visual assets</span>
              </div>
            </div>

            {/* Metric 3: Circular Completion Progress */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-[#090e18]/80 p-2.5 px-3.5 shadow-inner">
              <div>
                <span className="block font-mono text-lg font-bold text-purple-300 leading-tight">92%</span>
                <span className="text-[11px] text-slate-400">Hoàn thiện hồ sơ</span>
              </div>

              {/* Circular Ring */}
              <div className="relative flex h-8 w-8 items-center justify-center">
                <svg className="h-8 w-8 -rotate-90 transform" viewBox="0 0 36 36">
                  <path
                    className="text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-purple-500"
                    strokeDasharray="92, 100"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800/80 pb-3" role="tablist">
        <TabButton
          label="Tổng quan"
          icon={<LayoutDashboard className="h-4 w-4" />}
          active={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
        />
        <TabButton
          label="Visuals"
          icon={<ImageIcon className="h-4 w-4" />}
          active={activeTab === "visuals"}
          onClick={() => setActiveTab("visuals")}
        />
        <TabButton
          label="Xuất hiện"
          icon={<Film className="h-4 w-4" />}
          active={activeTab === "scenes"}
          onClick={() => setActiveTab("scenes")}
        />
        <TabButton
          label="Tài sản"
          icon={<Folder className="h-4 w-4" />}
          active={activeTab === "assets"}
          onClick={() => setActiveTab("assets")}
        />
        <TabButton
          label="Ghi chú"
          icon={<FileText className="h-4 w-4" />}
          active={activeTab === "notes"}
          onClick={() => setActiveTab("notes")}
        />
        <TabButton
          label="Lịch sử"
          icon={<History className="h-4 w-4" />}
          active={activeTab === "history"}
          onClick={() => setActiveTab("history")}
        />
      </div>

      {/* 4. Main Tab Content (Overview 2-Row 3-Column Grid) */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Row 1: Basic Info, Character Description & Relationships */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
            {/* Card 1: Basic Info */}
            <article className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0d1420] p-5 shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-100 font-bold text-sm border-b border-slate-800/80 pb-3">
                  <User className="h-4 w-4 text-purple-400" />
                  <h3>Thông tin cơ bản</h3>
                </div>

                <dl className="divide-y divide-slate-800/60 text-xs space-y-0">
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-slate-400">Tên đầy đủ</dt>
                    <dd className="font-semibold text-slate-100">{characterName}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-slate-400">Vai trò</dt>
                    <dd className="font-semibold text-purple-300">Chính</dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-slate-400">Tuổi</dt>
                    <dd className="font-mono text-slate-200">27</dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-slate-400">Nghề nghiệp</dt>
                    <dd className="text-slate-200">Nghệ nhân chế tác đèn lồng</dd>
                  </div>
                  <div className="py-2.5 space-y-1">
                    <dt className="text-slate-400">Tính cách nổi bật</dt>
                    <dd className="text-slate-200 leading-relaxed">
                      Kiên định, Tỉ mỉ, Trầm lặng, Nghĩa tình
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-slate-400">Trạng thái</dt>
                    <dd>
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-950/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Hoàn thiện
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            </article>

            {/* Card 2: Character Description & Personality Tags */}
            <article className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0d1420] p-5 shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-100 font-bold text-sm border-b border-slate-800/80 pb-3">
                  <FileText className="h-4 w-4 text-indigo-400" />
                  <h3>Mô tả nhân vật</h3>
                </div>

                <p className="text-xs leading-relaxed text-slate-300/90">
                  Lâm Khang sinh ra và lớn lên ở phố Hàng Mã. Từ nhỏ, anh đã theo cha học nghề làm đèn lồng. Sau một biến cố khiến gia đình tan vỡ, anh rời quê một thời gian để tìm kiếm sự thật. Trở về, Khang âm thầm khôi phục xưởng đèn cũ và gìn giữ nghề truyền thống của cha ông.
                </p>

                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  <h4 className="text-xs font-bold text-slate-300">Từ khóa tính cách</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {["Kiên định", "Tỉ mỉ", "Trầm lặng", "Nghĩa tình", "Sâu sắc", "Không bỏ cuộc"].map(
                      (tag) => (
                        <span
                          key={tag}
                          className="rounded-lg border border-purple-800/40 bg-purple-950/40 px-2.5 py-1 text-xs font-medium text-purple-300"
                        >
                          {tag}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </article>

            {/* Card 3: Character Relationships */}
            <article className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0d1420] p-5 shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-100 font-bold text-sm border-b border-slate-800/80 pb-3">
                  <Users className="h-4 w-4 text-cyan-400" />
                  <h3>Quan hệ nhân vật</h3>
                </div>

                <div className="divide-y divide-slate-800/60 text-xs">
                  {DEMO_RELATIONSHIPS.map((rel) => (
                    <div key={rel.id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={rel.avatarUrl}
                          alt={rel.name}
                          className="h-8 w-8 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <span className="block font-semibold text-slate-100">{rel.name}</span>
                          <span className="block text-[11px] text-slate-400">{rel.roleNote}</span>
                        </div>
                      </div>

                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${rel.badgeColorClass}`}
                      >
                        {rel.badgeLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors w-full"
              >
                <span>Xem tất cả mối quan hệ</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </article>
          </div>

          {/* Row 2: Visual References, Scenes & Creative Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
            {/* Card 4: Visual References */}
            <article className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0d1420] p-5 shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-100 font-bold text-sm border-b border-slate-800/80 pb-3">
                  <Sparkles className="h-4 w-4 text-pink-400" />
                  <h3>Visual references</h3>
                </div>

                {/* 4 Preview Images Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {DEMO_VISUAL_REFERENCES.map((url, index) => (
                    <div
                      key={index}
                      className="relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-inner group"
                    >
                      <img
                        src={url}
                        alt={`Reference ${index + 1}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors w-full"
              >
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Xem tất cả visual</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </article>

            {/* Card 5: Appearances in Scenes */}
            <article className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0d1420] p-5 shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-100 font-bold text-sm border-b border-slate-800/80 pb-3">
                  <Clapperboard className="h-4 w-4 text-amber-400" />
                  <h3>Xuất hiện trong scene</h3>
                </div>

                <div className="divide-y divide-slate-800/60 text-xs">
                  {DEMO_SCENES.map((scene) => (
                    <div key={scene.id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Film className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="truncate text-slate-200 font-medium">
                          {scene.chapterName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded border border-purple-700/50 bg-purple-950/80 px-1.5 py-0.2 text-[10px] font-bold text-purple-300">
                          {scene.role}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {scene.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors w-full"
              >
                <span>Xem tất cả scene</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </article>

            {/* Card 6: Creative Prompt & Consistency Notes */}
            <article className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0d1420] p-5 shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-100 font-bold text-sm border-b border-slate-800/80 pb-3">
                  <FileText className="h-4 w-4 text-teal-400" />
                  <h3>Prompt gợi ý / ghi chú sáng tạo</h3>
                </div>

                <ul className="space-y-2 text-xs leading-relaxed text-slate-300/90">
                  <li className="flex items-start gap-1.5">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>
                      Giữ nhất quán đặc điểm: tóc đen rối nhẹ, ánh mắt trầm, áo nâu/xám, phong cách phố cổ Hà Nội xưa.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>
                      Ánh sáng ấm từ đèn lồng, hậu cảnh phố cổ về đêm hoặc hoàng hôn.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>
                      Biểu cảm thường nghiêm túc, sâu tư, đôi khi ánh mắt kiên định.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>Tránh trang phục hiện đại, phụ kiện công nghệ.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>Tỉ lệ khung hình ưu tiên 16:9, 21:9 cho cảnh điện ảnh.</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors w-full"
              >
                <div className="flex items-center gap-1.5">
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Chỉnh sửa ghi chú</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </article>
          </div>
        </div>
      )}

      {activeTab !== "overview" && (
        <div className="rounded-2xl border border-slate-800/90 bg-[#0d1420] p-12 text-center text-xs text-slate-400">
          <p>Nội dung tab {activeTab} đang được đồng bộ và cập nhật.</p>
        </div>
      )}
    </div>
  );
}

function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
        active
          ? "border border-purple-600/70 bg-purple-950/40 text-purple-200 shadow-md shadow-purple-950/50"
          : "border border-slate-800/80 bg-[#0d1420]/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
      }`}
    >
      <span className={active ? "text-purple-300" : "text-slate-500"}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
