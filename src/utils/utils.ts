export function ensureHttpsBase(domain: string): string {
    const d = domain.trim();
    if (d.startsWith("http://")) return d.replace("http://", "https://");
    if (d.startsWith("https://")) return d;
    return `https://${d}`;
  }
  
  export function buildRedirectUri(): string {
    const base = process.env.PUBLIC_BASE_URL!;
    return `${base.replace(/\/$/, "")}/api/blackboard/auth/callback`;
  }