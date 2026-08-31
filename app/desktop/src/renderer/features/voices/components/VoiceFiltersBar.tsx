import { ArrowDownAZ, Grid2X2, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VoiceSortMode } from "../model/voice-filters";

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
    <div className="flex flex-wrap items-end gap-2 border-b border-border-subtle bg-surface-dark px-5 py-2.5">
      <label className="min-w-[220px] flex-1 text-[10px] font-medium text-text-muted">
        <span className="sr-only">Tìm voice</span>
        <span className="relative block">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-text-muted" />
          <Input
            className="pl-8"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm kiếm tên, giọng đọc, ngôn ngữ…"
          />
        </span>
      </label>

      <FilterSelect label="Ngôn ngữ" value={language} onChange={onLanguageChange} options={languageOptions} />
      <FilterSelect label="Giới tính" value={gender} onChange={onGenderChange} options={genderOptions} />
      <FilterSelect label="Nhà cung cấp" value={provider} onChange={onProviderChange} options={providerOptions} />
      <FilterSelect label="Thẻ" value={tag} onChange={onTagChange} options={tagOptions} />

      <label className="grid gap-1.5 text-[10px] font-medium text-text-muted">
        <span className="inline-flex items-center gap-1.5"><ArrowDownAZ size={11} /> Sắp xếp</span>
        <Select value={sortMode} onValueChange={(value) => onSortChange(value as VoiceSortMode)}>
          <SelectTrigger className="min-w-[112px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Tên A–Z</SelectItem>
            <SelectItem value="name-desc">Tên Z–A</SelectItem>
          </SelectContent>
        </Select>
      </label>

      <div className="ml-auto flex h-8 items-center gap-0.5 border-l border-border-subtle pl-2">
        <Button
          variant={viewMode === "grid" ? "outline" : "ghost"}
          size="icon-sm"
          aria-label="Hiển thị dạng lưới"
          onClick={() => onViewModeChange("grid")}
        >
          <Grid2X2 size={13} />
        </Button>
        <Button
          variant={viewMode === "list" ? "outline" : "ghost"}
          size="icon-sm"
          aria-label="Hiển thị dạng danh sách"
          onClick={() => onViewModeChange("list")}
        >
          <List size={13} />
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
    <label className="grid gap-1.5 text-[10px] font-medium text-text-muted">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-w-[96px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
