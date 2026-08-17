"use client";

import { useMemo, useState } from "react";
import type { Character, Project, ProjectCharacter } from "@/types/studio";
import {
  characterLibraryStats,
  createCharacterLibraryIndexes,
  DEFAULT_CHARACTER_FILTERS,
  filterAndSortCharacters,
  hasActiveCharacterFilters,
  type CharacterAdvancedFilters,
  type CharacterCategory,
  type CharacterFilters,
  type CharacterSort,
  type CharacterViewMode,
} from "../model/character-library";

export function useCharacterLibrary(
  characters: Character[],
  projects: Project[],
  projectCharacters: ProjectCharacter[],
  groupsCount: number,
) {
  const [filters, setFilters] = useState<CharacterFilters>(DEFAULT_CHARACTER_FILTERS);
  const [viewMode, setViewMode] = useState<CharacterViewMode>("grid");
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);

  const indexes = useMemo(
    () => createCharacterLibraryIndexes(projects, projectCharacters),
    [projectCharacters, projects],
  );
  const filteredCharacters = useMemo(
    () => filterAndSortCharacters(characters, filters, indexes),
    [characters, filters, indexes],
  );
  const stats = useMemo(
    () => characterLibraryStats(characters, projects, groupsCount),
    [characters, groupsCount, projects],
  );

  const patchFilters = (patch: Partial<CharacterFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));
  const patchAdvanced = (patch: CharacterAdvancedFilters) =>
    setFilters((current) => ({
      ...current,
      advanced: { ...current.advanced, ...patch },
    }));

  return {
    filters,
    filteredCharacters,
    stats,
    indexes,
    viewMode,
    isMoreFiltersOpen,
    hasActiveFilters: hasActiveCharacterFilters(filters),
    setProject: (project: string) => patchFilters({ project }),
    setRole: (role: string) => patchFilters({ role }),
    setGender: (gender: string) => patchFilters({ gender }),
    setStatus: (status: string) => patchFilters({ status }),
    setGroup: (group: string) => patchFilters({ group }),
    setCategory: (category: CharacterCategory) => patchFilters({ category }),
    setSort: (sort: CharacterSort) => patchFilters({ sort }),
    setSearch: (search: string) => patchFilters({ search }),
    setAdvanced: patchAdvanced,
    setViewMode,
    setIsMoreFiltersOpen,
    resetFilters: () => setFilters(DEFAULT_CHARACTER_FILTERS),
  };
}
