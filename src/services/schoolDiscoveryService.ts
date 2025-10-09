/**
 * Lightweight discovery: either search from a local list or accept direct domains.
 * You can expand this to query a central directory if available.
 */

const KNOWN = [
    { id: "utep", name: "University of Texas at El Paso", domain: "utep.blackboard.com" },
    { id: "nmsu", name: "New Mexico State University", domain: "learn.nmsu.edu" }
  ];
  
  export function searchSchoolsByName(q: string) {
    const s = q.toLowerCase();
    return KNOWN.filter(k => k.name.toLowerCase().includes(s) || k.id.includes(s));
  }
  
  export function normalizeDomainInput(input: string): string {
    // Accept "utep.blackboard.com" or full https URL; return domain only
    const trimmed = input.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        return new URL(trimmed).host;
      } catch {
        return trimmed.replace(/^https?:\/\//, "").replace(/\/+$/, "");
      }
    }
    return trimmed.replace(/\/+$/, "");
  }