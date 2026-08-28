export interface GeminiModelCandidate {
  role: string | null;
  label: string;
  ariaLabel: string;
  title: string;
}

const MODEL_OPTION_ROLES = new Set([
  "button",
  "menuitem",
  "menuitemradio",
  "option",
  "radio",
]);

export function findGeminiModelCandidateIndex(
  candidates: readonly GeminiModelCandidate[],
  modelName: string,
): number {
  const target = normalizeModelText(modelName);
  if (!target) return -1;

  let bestIndex = -1;
  let bestScore = -1;
  candidates.forEach((candidate, index) => {
    const role = candidate.role?.trim().toLowerCase() ?? "";
    if (role && !MODEL_OPTION_ROLES.has(role)) return;

    const values = [candidate.ariaLabel, candidate.title, candidate.label].map(normalizeModelText);
    const exactScore = values.findIndex((value) => value === target);
    const prefixScore = values.findIndex((value) => value.startsWith(`${target} `));
    const matchScore = exactScore >= 0 ? 100 - exactScore : prefixScore >= 0 ? 80 - prefixScore : -1;
    if (matchScore < 0) return;

    const roleScore = role === "option" || role.startsWith("menuitem") || role === "radio" ? 10 : 0;
    const score = matchScore + roleScore;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function normalizeModelText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^gemini\s+/, "");
}
