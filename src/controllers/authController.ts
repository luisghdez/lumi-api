import { FastifyReply, FastifyRequest } from "fastify";
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
} from "../services/oauthService";
import { asMessage, sendError } from "../utils/error";
import "@fastify/cookie";
import { ensureHttpsBase } from "../utils/url";
import { putTokens } from "../services/tokenStore";
import "@fastify/cookie";
/**
 * Starts OAuth by redirecting to the school's authorize endpoint.
 * GET /api/blackboard/auth/start?domain=utep.blackboard.com&clientId=...&sessionId=...
 */
export async function authStartHandler(
  request: FastifyRequest<{
    Querystring: { domain: string; clientId: string; state?: string; sessionId?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { domain, clientId, state, sessionId } = request.query;
    if (!domain) return sendError(reply, 400, "Missing 'domain' query param");
    if (!clientId) return sendError(reply, 400, "Missing 'clientId' query param");

    // Build dynamic authorize URL
    const authUrl = await buildAuthorizeUrl(domain, clientId, state);
    console.log("✅ Redirecting to:", authUrl);

    // Save session if provided
    if (sessionId) reply.setCookie("bb_session", sessionId, { httpOnly: true, path: "/" });

    return reply.redirect(authUrl);
  } catch (e) {
    sendError(reply, 500, asMessage(e));
  }
}

/**
 * OAuth callback receiver
 * GET /api/blackboard/auth/callback?code=...&domain=...&clientId=...&clientSecret=optional
 */
export async function authCallbackHandler(
  request: FastifyRequest<{ Querystring: { code?: string; state?: string; domain?: string; clientId?: string } }>,
  reply: FastifyReply
) {
  try {
    const code = request.query.code;
    const domain = request.query.domain || request.headers["x-bb-domain"];
    const clientId = request.query.clientId || "edf10d28-9fa6-4aa1-abab-ceb38b485e84";
    const sessionId =
      (request.headers["x-session-id"] as string) || (request.cookies["bb_session"] as string);

    if (!code) return sendError(reply, 400, "Missing 'code' in callback");
    if (!domain) return sendError(reply, 400, "Missing 'domain'");
    if (!sessionId) return sendError(reply, 400, "Missing sessionId");

    // Exchange the code for tokens
    const tok = await exchangeCodeForTokens(String(domain), code, clientId);
    const now = Date.now();
    const bundle = {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      tokenType: tok.token_type,
      scope: tok.scope,
      receivedAt: now,
      expiresAt: now + tok.expires_in * 1000,
    };

    const host = new URL(ensureHttpsBase(String(domain))).host;
    putTokens(sessionId, host, bundle);

    // ✅ Friendly success page instead of {}
    reply.type("text/html").send(`
      <html>
        <body style="font-family:sans-serif; text-align:center; padding-top:80px;">
          <h2>✅ Connected to Blackboard successfully!</h2>
          <p>You can close this tab and return to the Lumi Learn app.</p>
          <p style="color:#555;">Session: <b>${sessionId}</b></p>
        </body>
      </html>
    `);
  } catch (e) {
    sendError(reply, 500, asMessage(e));
  }
}