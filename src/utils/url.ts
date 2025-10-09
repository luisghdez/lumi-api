/**
 * URL helpers for Blackboard API
 * Ensures consistent HTTPS and builds callback URLs.
 */

export function ensureHttpsBase(domain: string): string {
    const d = domain.trim();
    if (d.startsWith("http://")) return d.replace("http://", "https://");
    if (d.startsWith("https://")) return d;
    return `https://${d}`;
  }
  
  /**
   * Returns the full redirect URI for OAuth callbacks,
   * based on your .env PUBLIC_BASE_URL
   */
  export function buildRedirectUri(): string {
    const base = process.env.PUBLIC_BASE_URL!;
    return `${base.replace(/\/$/, "")}/api/blackboard/auth/callback`;
  }