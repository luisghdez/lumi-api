export interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope?: string;
  receivedAt: number;
  expiresAt: number;
}

// In-memory store: Map<sessionId+domain, TokenBundle>
const tokenMap = new Map<string, TokenBundle>();

function key(sessionId: string, domain: string) {
  return `${sessionId}:${domain.toLowerCase()}`;
}

export function putTokens(sessionId: string, domain: string, bundle: TokenBundle) {
  tokenMap.set(key(sessionId, domain), bundle);
}

export function getTokens(sessionId: string, domain: string): TokenBundle | undefined {
  return tokenMap.get(key(sessionId, domain));
}

export function isExpired(bundle: TokenBundle): boolean {
  return Date.now() >= bundle.expiresAt - 5000; // 5s buffer
}

export function clearTokens(sessionId: string, domain: string) {
  tokenMap.delete(key(sessionId, domain));
}