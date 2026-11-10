/**
 * Rules-based triage helpers. These are deterministic keyword matchers, not machine learning:
 * each category's keywords are configured per municipality. Output is a *suggestion* shown to
 * the resident, who always makes the final choice.
 */
export interface CategoryForSuggestion {
  id: string;
  name: string;
  keywords: string[];
}

export interface CategorySuggestion {
  categoryId: string;
  name: string;
  matched: string[];
}

export function suggestCategories(
  description: string,
  categories: CategoryForSuggestion[],
): CategorySuggestion[] {
  const text = ` ${description.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return categories
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      matched: c.keywords.filter(
        (k) => text.includes(` ${k.toLowerCase()} `) || text.includes(` ${k.toLowerCase()}s `),
      ),
    }))
    .filter((s) => s.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length)
    .slice(0, 3);
}

const EMERGENCY_TERMS = [
  "fire",
  "smoke",
  "gas leak",
  "smell gas",
  "explosion",
  "injured",
  "injury",
  "bleeding",
  "unconscious",
  "not breathing",
  "heart attack",
  "overdose",
  "gun",
  "shooting",
  "weapon",
  "assault",
  "robbery",
  "break in",
  "crash",
  "accident",
  "downed power line",
  "power line down",
  "live wire",
  "drowning",
  "carbon monoxide",
  "emergency",
];

/**
 * True when a description contains wording that suggests an emergency. Used only to show a
 * stronger "call 911" prompt. MunicipalOS never dispatches emergency services.
 */
export function looksLikeEmergency(description: string): boolean {
  const text = ` ${description.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return EMERGENCY_TERMS.some((t) => text.includes(` ${t} `));
}
