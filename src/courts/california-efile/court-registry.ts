/**
 * Registry mapping California counties to Tyler eFile court-specific values.
 *
 * Each county's entry describes:
 *  - searchTerm: what to type into the Court Location autocomplete
 *  - dropdownMatch: the exact (or partial) text of the dropdown option to click
 *  - caseCategoryAutoFilled: whether selecting the court auto-fills Case Category
 *  - caseTypePattern: prefix used to match Case Type dropdown options (e.g. "Small Claims")
 *
 * To add a new county, add an entry keyed by the lowercase county name.
 */

export interface CourtEntry {
  /** Text typed into the Court Location autocomplete input */
  searchTerm: string;
  /** Text of the dropdown option to select (matched via includes) */
  dropdownMatch: string;
  /** If true, selecting this court auto-fills Case Category — skip that step */
  caseCategoryAutoFilled: boolean;
  /** Prefix to match Case Type dropdown options (e.g. "Small Claims") */
  caseTypePattern: string;
  /** Court-specific Filing Code to select in the Filing Details modal */
  filingCode: string;
}

export const COURT_REGISTRY: Record<string, CourtEntry> = {
  'san mateo': {
    searchTerm: 'San Mateo small',
    dropdownMatch: 'San Mateo - Redwood City - Small Claims',
    caseCategoryAutoFilled: true,
    caseTypePattern: 'Small Claims',
    filingCode: "Plaintiff's Claim",
  },
  'santa clara': {
    searchTerm: 'Santa Clara',
    dropdownMatch: 'Santa Clara - Civil',
    caseCategoryAutoFilled: false,
    caseTypePattern: 'Small Claims',
    filingCode: 'Small Claims AB 3088 Declaration',
  },
};

/**
 * Look up a court entry by county name (case-insensitive).
 * Returns undefined if the county is not in the registry.
 */
export function lookupCourt(county: string): CourtEntry | undefined {
  return COURT_REGISTRY[county.toLowerCase().trim()];
}

/**
 * Select the correct Case Type option based on claim amount.
 *
 * Tyler eFile Case Type options look like:
 *   "Small Claims $0 - $1,500 - $30.00"
 *   "Small Claims $1,501 - $5,000 - $50.00"
 *   "Small Claims $5,001 - $12,500 - $75.00"
 *
 * This function finds the option whose dollar range contains the claim amount.
 * If no range match is found, returns the first option matching the pattern.
 */
export function pickCaseTypeByAmount(
  options: string[],
  pattern: string,
  claimAmount: number,
): string | undefined {
  const matching = options.filter(opt =>
    opt.toLowerCase().includes(pattern.toLowerCase()),
  );

  if (matching.length === 0) return undefined;

  // Try to find the tier that contains the claim amount
  for (const opt of matching) {
    const rangeMatch = opt.match(/\$([0-9,]+)\s*-\s*\$([0-9,]+)/);
    if (rangeMatch) {
      const low = parseFloat(rangeMatch[1].replace(/,/g, ''));
      const high = parseFloat(rangeMatch[2].replace(/,/g, ''));
      if (claimAmount >= low && claimAmount <= high) {
        return opt;
      }
    }
  }

  // Fallback: return last matching option (highest tier)
  return matching[matching.length - 1];
}
