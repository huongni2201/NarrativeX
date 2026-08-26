import { ArrowDownAZ, ChevronDown, Grid2X2, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VoiceSortMode } from "../voice-filters";

export type VoiceViewMode = "grid" | "list";

type Props = Readonly<{
  query: string;
  language: string;
  gender: string;
  provider: string;
  tag: string;
  sortMode: VoiceSortMode;
  viewMode: VoiceViewMode;
  languageOptions: string[];
  genderOptions: string[];
  providerOptions: string[];
  tagOptions: string[];
  onQueryChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onSortChange: (value: VoiceSortMode) => void;
  onViewModeChange: (value: VoiceViewMode) => void;
}>;

export function VoiceFiltersBar({
  query,
  language,
  gender,
  provider,
  tag,
  sortMode,
  viewMode,
  languageOptions,
  genderOptions,
  providerOptions,
  tagOptions,
  onQueryChange,
  onLanguageChange,
  onGenderChange,
  onProviderChange,
  onTagChange,
  onSortChange,
  onViewModeChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-border bg-[var(--voice-filter-bar)] px-5 py-3">
      <label className="min-w-[220px] flex-1 text-[9px] text-text-muted">
        <span className="sr-only">Tìm voice</span>
        <span className="flex h-9 items-center gap-2 rounded-md border border-input bg-surface-input px-2.5">
          <Search size={14} />
          <Input
            className="h-7 border-0 bg-transparent px-0 text-[10px] focus-visible:ring-1 focus-visible:ring-primary/70"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm kiếm tên, giọng đọc, ngôn ngữ…"
          />
        </span>
      </label>

      <FilterSelect
        label="Ngôn ngữ"
        value={language}
        onChange={onLanguageChange}
        options={languageOptions}
      />
      <FilterSelect
        label="Giới tính"
        value={gender}
        onChange={onGenderChange}
        options={genderOptions}
      />
      <FilterSelect
        label="Nhà cung cấp"
        value={provider}
        onChange={onProviderChange}
        options={providerOptions}
      />
      <FilterSelect label="Thẻ" value={tag} onChange={onTagChange} options={tagOptions} />

      <label className="grid gap-1 text-[9px] text-text-muted">
        <span>Sắp xếp</span>
        <span className="flex h-9 items-center gap-1 rounded-md border border-border bg-surface-input px-2">
          <select
            className="h-7 bg-transparent text-[10px] text-foreground outline-none"
            value={sortMode}
            onChange={(event) => onSortChange(event.target.value as VoiceSortMode)}
          >
            <option value="name-asc">Tên A–Z</option>
            <option value="name-desc">Tên Z–A</option>
          </select>
          <ArrowDownAZ size={13} />
        </span>
      </label>

      <div className="ml-auto flex h-9 items-center gap-1 rounded-md border border-border bg-surface-input p-1">
        <Button
          variant={viewMode === "grid" ? "default" : "ghost"}
          size="icon"
          aria-label="Hiển thị dạng lưới"
          onClick={() => onViewModeChange("grid")}
          className="size-7"
        >
          <Grid2X2 size={14} />
        </Button>
        <Button
          variant={viewMode === "list" ? "default" : "ghost"}
          size="icon"
          aria-label="Hiển thị dạng danh sách"
          onClick={() => onViewModeChange("list")}
          className="size-7"
        >
          <List size={14} />
        </Button>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}>) {
  return (
    <label className="grid gap-1 text-[9px] text-text-muted">
      <span>{label}</span>
      <span className="flex h-9 items-center gap-1 rounded-md border border-border bg-surface-input px-2">
        <select
          className="min-w-[76px] flex-1 bg-transparent text-[10px] text-foreground outline-none"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="all">Tất cả</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown size={13} />
      </span>
    </label>
  );
}
