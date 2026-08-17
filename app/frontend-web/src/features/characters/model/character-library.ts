import type { Character, Project, ProjectCharacter } from "@/types/studio";

export type CharacterCategory = "all" | "main" | "supporting" | "minor" | "groups";
export type CharacterSort = "recent" | "name_asc" | "name_desc" | "most_used" | "version";
export type CharacterViewMode = "grid" | "list";

export interface CharacterAdvancedFilters {
  minAppearances?: number;
  onlyLocked?: boolean;
  hasReferences?: boolean;
}

export interface CharacterFilters {
  project: string;
  role: string;
  gender: string;
  status: string;
  group: string;
  category: CharacterCategory;
  sort: CharacterSort;
  search: string;
  advanced: CharacterAdvancedFilters;
}

export interface CharacterLibraryIndexes {
  assignmentByCharacterId: Map<string, ProjectCharacter>;
  projectById: Map<string, Project>;
}

export const DEFAULT_CHARACTER_FILTERS: CharacterFilters = {
  project: "all",
  role: "all",
  gender: "all",
  status: "all",
  group: "all",
  category: "all",
  sort: "recent",
  search: "",
  advanced: {},
};

const roleTokens = {
  main: ["chính", "nữ chính", "nam chính"],
  supporting: ["phụ", "pháp sư", "thánh nữ", "cấm vệ quân", "quân sư"],
  minor: ["quần chúng", "cung thủ", "cuồng nộ", "y giả"],
} as const;

function normalized(value?: string) {
  return value?.trim().toLocaleLowerCase("vi") ?? "";
}

function matchesRole(character: Character, assignment: ProjectCharacter | undefined, role: string) {
  if (role === "all") return true;
  if (character.roleCategory === role) return true;
  const assignmentRole = normalized(assignment?.role);
  const tokens = roleTokens[role as keyof typeof roleTokens];
  return tokens?.some((token) => assignmentRole.includes(token)) ?? false;
}

function actualStatus(character: Character) {
  if (character.status) return character.status;
  return character.latestVersion.status === "LOCKED" ? "IN_USE" : "DRAFT";
}

export function createCharacterLibraryIndexes(
  projects: Project[],
  projectCharacters: ProjectCharacter[],
): CharacterLibraryIndexes {
  return {
    assignmentByCharacterId: new Map(projectCharacters.map((item) => [item.characterId, item])),
    projectById: new Map(projects.map((project) => [String(project.id), project])),
  };
}

export function filterAndSortCharacters(
  characters: Character[],
  filters: CharacterFilters,
  indexes: CharacterLibraryIndexes,
) {
  const query = normalized(filters.search);
  const filtered = characters.filter((character) => {
    const assignment = indexes.assignmentByCharacterId.get(character.id);
    const project = assignment ? indexes.projectById.get(assignment.projectId) : undefined;
    const locked = character.latestVersion.status === "LOCKED";
    const status = actualStatus(character);

    const matchesSearch =
      !query ||
      normalized(character.name).includes(query) ||
      normalized(character.canonicalIdentity).includes(query) ||
      normalized(character.description).includes(query) ||
      normalized(character.group).includes(query) ||
      character.aliases?.some((alias) => normalized(alias).includes(query)) ||
      normalized(assignment?.role).includes(query) ||
      normalized(project?.name ?? project?.title).includes(query);

    const matchesProject = filters.project === "all" || assignment?.projectId === filters.project;
    const roleFilter = filters.category === "groups" ? "all" : filters.category !== "all" ? filters.category : filters.role;
    const roleMatches = matchesRole(character, assignment, roleFilter);
    const matchesGender =
      filters.gender === "all" ||
      (filters.gender === "female" && ["nữ", "female"].includes(normalized(character.gender))) ||
      (filters.gender === "male" && ["nam", "male"].includes(normalized(character.gender))) ||
      (filters.gender === "other" && !["nữ", "female", "nam", "male"].includes(normalized(character.gender)));
    const matchesStatus =
      filters.status === "all" ||
      (filters.status === "in_use" && ["IN_USE", "ACTIVE"].includes(status)) ||
      (filters.status === "draft" && status === "DRAFT") ||
      (filters.status === "archived" && status === "ARCHIVED") ||
      (filters.status === "locked" && locked);
    const matchesGroup =
      filters.group === "all" || character.group === filters.group || assignment?.groups.includes(filters.group);
    const matchesAdvanced =
      (!filters.advanced.onlyLocked || locked) &&
      (!filters.advanced.hasReferences || character.referenceAssets.length > 0) &&
      (!filters.advanced.minAppearances || (character.appearancesCount ?? 0) >= filters.advanced.minAppearances);

    return Boolean(
      matchesSearch &&
        matchesProject &&
        roleMatches &&
        matchesGender &&
        matchesStatus &&
        matchesGroup &&
        matchesAdvanced,
    );
  });

  return [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case "name_asc":
        return a.name.localeCompare(b.name, "vi");
      case "name_desc":
        return b.name.localeCompare(a.name, "vi");
      case "most_used":
        return (b.appearancesCount ?? 0) - (a.appearancesCount ?? 0);
      case "version":
      case "recent":
      default:
        return b.latestVersion.versionNumber - a.latestVersion.versionNumber;
    }
  });
}

export function characterLibraryStats(characters: Character[], projects: Project[], groupsCount: number) {
  let inUse = 0;
  let draft = 0;
  let archived = 0;
  let mainCount = 0;
  let supportingCount = 0;
  let minorCount = 0;

  for (const character of characters) {
    const status = actualStatus(character);
    if (status === "IN_USE" || status === "ACTIVE") inUse += 1;
    if (status === "DRAFT") draft += 1;
    if (status === "ARCHIVED") archived += 1;
    if (character.roleCategory === "main") mainCount += 1;
    if (character.roleCategory === "supporting") supportingCount += 1;
    if (character.roleCategory === "minor") minorCount += 1;
  }

  return {
    total: characters.length,
    inUse,
    draft,
    archived,
    acrossProjects: projects.length,
    mainCount,
    supportingCount,
    minorCount,
    groupsCount,
  };
}

export function hasActiveCharacterFilters(filters: CharacterFilters) {
  return (
    filters.project !== "all" ||
    filters.role !== "all" ||
    filters.gender !== "all" ||
    filters.status !== "all" ||
    filters.group !== "all" ||
    filters.category !== "all" ||
    filters.search.trim() !== "" ||
    Boolean(filters.advanced.onlyLocked) ||
    Boolean(filters.advanced.hasReferences) ||
    Boolean(filters.advanced.minAppearances)
  );
}
