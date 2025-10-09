import axios, { AxiosInstance } from "axios";
import { ensureHttpsBase } from "../utils/url";
import { getTokens, putTokens, isExpired, TokenBundle } from "./tokenStore";
import { refreshTokens } from "./oauthService";

/**
 * Create a Blackboard API HTTP client with proper auth header.
 */
function bbHttp(domain: string, accessToken: string): AxiosInstance {
  const base = ensureHttpsBase(domain);
  return axios.create({
    baseURL: `${base}/learn/api/public/v1`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    timeout: 15000,
  });
}

/**
 * Ensure that a stored access token is valid, refreshing if necessary.
 */
async function ensureValidToken(sessionId: string, domain: string): Promise<TokenBundle> {
  const bundle = getTokens(sessionId, domain);
  if (!bundle) throw new Error("No token found for this session/domain");

  // ✅ Not expired → return as-is
  if (!isExpired(bundle)) return bundle;

  // ✅ Expired, but no refresh token
  if (!bundle.refreshToken)
    throw new Error("Access token expired and no refresh token available");

  console.log(`🔄 Refreshing token for ${domain} (session ${sessionId})...`);

  // Refresh the token using Blackboard’s token endpoint
  const rt = await refreshTokens(domain, bundle.refreshToken);

  const refreshed: TokenBundle = {
    accessToken: rt.access_token,
    refreshToken: rt.refresh_token ?? bundle.refreshToken,
    tokenType: rt.token_type,
    scope: rt.scope,
    receivedAt: Date.now(),
    expiresAt: Date.now() + rt.expires_in * 1000,
  };

  // Save new token bundle
  putTokens(sessionId, domain, refreshed);

  console.log(`✅ Token refreshed for ${domain}`);
  return refreshed;
}

/**
 * Fetch the logged-in user's profile info.
 * Requires /learn/api/public/v1/users/me permission.
 */
export async function getMe(sessionId: string, domain: string) {
  const bundle = await ensureValidToken(sessionId, domain);
  const http = bbHttp(domain, bundle.accessToken);
  const { data } = await http.get("/users/me");
  return data;
}

/**
 * Fetch courses for the logged-in user.
 * Blackboard supports query params like ?role=Student
 */
export async function getCourses(
  sessionId: string,
  domain: string,
  params?: Record<string, string>
) {
  const bundle = await ensureValidToken(sessionId, domain);
  const http = bbHttp(domain, bundle.accessToken);
  const { data } = await http.get("/courses", { params });
  return data;
}