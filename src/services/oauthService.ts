import axios from "axios";

/**
 * Normalize domain (accepts utep.blackboard.com, adds https:// if missing)
 */
export function ensureHttpsBase(domain: string): string {
  let d = domain.trim();
  if (!d.startsWith("http")) d = "https://" + d;
  const url = new URL(d);
  return `https://${url.host}`;
}

/**
 * Discover Blackboard OAuth endpoints dynamically
 */
export async function discoverOAuthEndpoints(domain: string) {
  const base = ensureHttpsBase(domain);
  const wellKnown = `${base}/learn/api/public/v1/.well-known/openid-configuration`;

  try {
    const res = await axios.get(wellKnown);
    return {
      authorization_endpoint: res.data.authorization_endpoint,
      token_endpoint: res.data.token_endpoint,
    };
  } catch {
    // Blackboard fallback
    return {
      authorization_endpoint: `${base}/learn/api/public/v1/oauth2/authorize`,
      token_endpoint: `${base}/learn/api/public/v1/oauth2/token`,
    };
  }
}

/**
 * Build the authorize URL dynamically using user's clientId
 */
export async function buildAuthorizeUrl(domain: string, clientId: string, state?: string) {
  const { authorization_endpoint } = await discoverOAuthEndpoints(domain);
  const redirectUri = "https://d07fda465f79.ngrok-free.app/api/blackboard/auth/callback";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  if (state) params.set("state", state);

  return `${authorization_endpoint}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens (any Blackboard instance)
 */
export async function exchangeCodeForTokens(
  domain: string,
  code: string,
  clientId: string,
  clientSecret?: string
) {
  const { token_endpoint } = await discoverOAuthEndpoints(domain);
  const redirectUri = "http://localhost:3000/api/blackboard/auth/callback";

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  const res = await axios.post(token_endpoint, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  // Blackboard’s response typically includes:
  // access_token, expires_in, token_type, refresh_token (optional), scope
  return res.data as {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope?: string;
  };
}

/**
 * Refresh an access token using a refresh token (any Blackboard instance)
 */
export async function refreshTokens(
  domain: string,
  refreshToken: string,
  clientId?: string,
  clientSecret?: string
) {
  const { token_endpoint } = await discoverOAuthEndpoints(domain);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  if (clientId) body.set("client_id", clientId);
  if (clientSecret) body.set("client_secret", clientSecret);

  const res = await axios.post(token_endpoint, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return res.data as {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope?: string;
  };
}