"use client";

import { ChevronDown, LayoutGrid, List, Plus, RotateCcw, Search, Shield, SlidersHorizontal, Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CharacterCard } from "./CharacterCard";
import { CharacterListView } from "./CharacterListView";
import { useCharacterLibrary } from "./hooks/useCharacterLibrary";
import { MOCK_CHARACTERS, MOCK_GROUPS, MOCK_PROJECT_CHARACTERS, MOCK_PROJECTS } from "@/lib/mock-data";
import { useStudioStore } from "@/store/useStudioStore";
import type { CharacterCategory, CharacterSort } from "./model/character-library";

const selectClass = "bg-[#111827] border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer hover:border-slate-600 transition-colors";

export function CharacterLibraryDemo() {
  const openCharacterBible = useStudioStore((state) => state.openCharacterBible);
  const vm = useCharacterLibrary(
    MOCK_CHARACTERS,
    MOCK_PROJECTS,
    MOCK_PROJECT_CHARACTERS,
    MOCK_GROUPS.length,
  );

  const assignmentByCharacterId = vm.indexes.assignmentByCharacterId;
  const projectById = vm.indexes.projectById;
  const groupsByName = new Map(MOCK_GROUPS.map((group) => [group.name, group]));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Thư viện nhân vật</h1>
          <p className="mt-1 text-xs text-slate-400">Quản lý nhân vật và diện mạo trên các dự án.</p>
        </div>
        <Button onClick={() => openCharacterBible(MOCK_CHARACTERS[0]?.id ?? "")} variant="primary" className="self-start sm:self-auto">
          <Plus className="mr-2 h-4 w-4" /> Tạo nhân vật
        </Button>
      </header>

      <section className="rounded-2xl border border-slate-800/80 bg-[#0b101c]/90 p-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={vm.filters.search}
                onChange={(event) => vm.setSearch(event.target.value)}
                placeholder="Tìm kiếm nhân vật..."
                className="w-full rounded-xl border border-slate-700/70 bg-[#111827] py-2 pl-9 pr-8 text-xs text-slate-200 outline-none focus:border-purple-500"
              />
              {vm.filters.search && (
                <button type="button" onClick={() => vm.setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white" aria-label="Xóa tìm kiếm">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <FilterSelect value={vm.filters.project} onChange={vm.setProject} label="Tất cả dự án" options={MOCK_PROJECTS.map((project) => [project.id, project.name ?? project.title])} />
            <FilterSelect value={vm.filters.role} onChange={vm.setRole} label="Tất cả vai trò" options={[["main", "Nhân vật chính"], ["supporting", "Nhân vật phụ"], ["minor", "Quần chúng"]]} />
            <FilterSelect value={vm.filters.status} onChange={vm.setStatus} label="Tất cả trạng thái" options={[["in_use", "Đang sử dụng"], ["draft", "Bản nháp"], ["archived", "Lưu trữ"], ["locked", "Đã khóa"]]} />

            <button
              type="button"
              onClick={() => vm.setIsMoreFiltersOpen(!vm.isMoreFiltersOpen)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700/70 bg-[#111827] px-3 py-2 text-xs text-slate-300 hover:border-purple-600 hover:text-white"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Bộ lọc nâng cao
            </button>
            {vm.hasActiveFilters && (
              <button type="button" onClick={vm.resetFilters} className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300">
                <RotateCcw className="h-3 w-3" /> Đặt lại
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select value={vm.filters.sort} onChange={(event) => vm.setSort(event.target.value as CharacterSort)} className={selectClass}>
                <option value="recent">Cập nhật gần đây</option>
                <option value="name_asc">Tên A-Z</option>
                <option value="name_desc">Tên Z-A</option>
                <option value="most_used">Xuất hiện nhiều</option>
                <option value="version">Phiên bản</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="flex rounded-xl border border-slate-700/70 bg-[#111827] p-0.5">
              <ViewButton active={vm.viewMode === "grid"} label="Lưới" onClick={() => vm.setViewMode("grid")}><LayoutGrid className="h-4 w-4" /></ViewButton>
              <ViewButton active={vm.viewMode === "list"} label="Danh sách" onClick={() => vm.setViewMode("list")}><List className="h-4 w-4" /></ViewButton>
            </div>
          </div>
        </div>

        {vm.isMoreFiltersOpen && (
          <div className="mt-3 grid gap-4 border-t border-slate-800 pt-3 text-xs sm:grid-cols-3">
            <FilterSelect value={vm.filters.gender} onChange={vm.setGender} label="Tất cả giới tính" options={[["female", "Nữ"], ["male", "Nam"], ["other", "Khác"]]} />
            <FilterSelect value={vm.filters.group} onChange={vm.setGroup} label="Tất cả nhóm" options={MOCK_GROUPS.map((group) => [group.name, group.name])} />
            <div className="flex items-center gap-4 text-slate-300">
              <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(vm.filters.advanced.onlyLocked)} onChange={(event) => vm.setAdvanced({ onlyLocked: event.target.checked })} /> Đã khóa</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(vm.filters.advanced.hasReferences)} onChange={(event) => vm.setAdvanced({ hasReferences: event.target.checked })} /> Có ảnh mẫu</label>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Tổng số" value={vm.stats.total} onClick={() => vm.resetFilters()} />
        <Metric label="Đang sử dụng" value={vm.stats.inUse} onClick={() => vm.setStatus("in_use")} />
        <Metric label="Bản nháp" value={vm.stats.draft} onClick={() => vm.setStatus("draft")} />
        <Metric label="Lưu trữ" value={vm.stats.archived} onClick={() => vm.setStatus("archived")} />
        <Metric label="Dự án" value={vm.stats.acrossProjects} />
        <Metric label="Nhóm" value={vm.stats.groupsCount} onClick={() => vm.setCategory("groups")} />
      </section>

      <nav className="flex gap-6 overflow-x-auto border-b border-slate-800 text-xs font-semibold" aria-label="Phân loại nhân vật">
        {([
          ["all", "Tất cả", vm.stats.total],
          ["main", "Nhân vật chính", vm.stats.mainCount],
          ["supporting", "Nhân vật phụ", vm.stats.supportingCount],
          ["minor", "Quần chúng", vm.stats.minorCount],
          ["groups", "Nhóm / Phe phái", vm.stats.groupsCount],
        ] as const).map(([id, label, count]) => (
          <button key={id} type="button" onClick={() => vm.setCategory(id as CharacterCategory)} className={`shrink-0 border-b-2 px-1 pb-3 ${vm.filters.category === id ? "border-purple-500 text-purple-300" : "border-transparent text-slate-400 hover:text-white"}`}>
            {label} <span className="ml-1 font-mono text-[10px]">{count}</span>
          </button>
        ))}
      </nav>

      {vm.filters.category === "groups" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_GROUPS.map((group) => {
            const members = MOCK_CHARACTERS.filter((character) => character.group === group.name);
            return (
              <button key={group.id} type="button" onClick={() => { vm.setGroup(group.name); vm.setCategory("all"); }} className="rounded-2xl border border-slate-800 bg-[#0b101c] p-5 text-left transition hover:border-purple-500/50">
                <div className="flex items-center gap-3"><Shield className="h-5 w-5 text-purple-400" /><div><h3 className="font-bold text-slate-100">{group.name}</h3><p className="text-[11px] text-slate-400">{members.length} nhân vật</p></div></div>
                <p className="mt-3 text-xs leading-5 text-slate-400">{groupsByName.get(group.name)?.description}</p>
              </button>
            );
          })}
        </div>
      ) : vm.filteredCharacters.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0b101c]/60 py-16 text-center">
          <Users className="mx-auto h-8 w-8 text-purple-400" />
          <h3 className="mt-3 font-semibold text-slate-200">Không tìm thấy nhân vật</h3>
          {vm.hasActiveFilters && <Button size="sm" variant="secondary" onClick={vm.resetFilters} className="mt-4">Đặt lại bộ lọc</Button>}
        </div>
      ) : vm.viewMode === "list" ? (
        <CharacterListView characters={vm.filteredCharacters} projectCharacters={MOCK_PROJECT_CHARACTERS} projects={MOCK_PROJECTS} onSelectCharacter={openCharacterBible} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {vm.filteredCharacters.map((character) => {
            const assignment = assignmentByCharacterId.get(character.id);
            const project = assignment ? projectById.get(assignment.projectId) : undefined;
            return <CharacterCard key={character.id} character={character} projectCharacter={assignment} projectName={project?.name ?? project?.title} onClick={() => openCharacterBible(character.id)} />;
          })}
        </div>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: readonly (readonly [string, string])[] }) {
  return <div className="relative"><select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}><option value="all">{label}</option>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /></div>;
}

function Metric({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  const content = <><p className="text-xs text-slate-400">{label}</p><p className="mt-2 font-mono text-3xl font-bold text-slate-100">{value}</p></>;
  return onClick ? <button type="button" onClick={onClick} className="rounded-2xl border border-slate-800 bg-[#0b101c]/90 p-4 text-left hover:border-purple-500/40">{content}</button> : <div className="rounded-2xl border border-slate-800 bg-[#0b101c]/90 p-4">{content}</div>;
}

function ViewButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={`rounded-lg p-1.5 ${active ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}>{children}</button>;
}
