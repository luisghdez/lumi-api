import { FastifyReply, FastifyRequest } from "fastify";
import { asMessage, sendError } from "../utils/error";
import { normalizeDomainInput } from "../services/schoolDiscoveryService";
import { getMe, getCourses } from "../services/blackboardApiService";

/**
 * GET /api/blackboard/me?domain=utep.blackboard.com
 * Headers: X-Session-Id: <your-session-id>
 */
export async function meHandler(
  request: FastifyRequest<{ Querystring: { domain: string } }>,
  reply: FastifyReply
) {
  try {
    const sessionId = request.headers["x-session-id"] as string;
    if (!sessionId) return sendError(reply, 400, "Missing X-Session-Id header");

    const domain = normalizeDomainInput(request.query.domain);
    const data = await getMe(sessionId, domain);

    reply.send({ success: true, data });
  } catch (e) {
    sendError(reply, 500, asMessage(e));
  }
}

/**
 * GET /api/blackboard/courses?domain=utep.blackboard.com
 * Optional query params are forwarded: e.g., role=Student
 * Headers: X-Session-Id: <your-session-id>
 */
export async function coursesHandler(
  request: FastifyRequest<{ Querystring: { domain: string; [k: string]: string } }>,
  reply: FastifyReply
) {
  try {
    const sessionId = request.headers["x-session-id"] as string;
    if (!sessionId) return sendError(reply, 400, "Missing X-Session-Id header");

    const { domain, ...rest } = request.query;
    const normalized = normalizeDomainInput(domain);

    const data = await getCourses(sessionId, normalized, rest);
    reply.send({ success: true, data });
  } catch (e) {
    sendError(reply, 500, asMessage(e));
  }
}