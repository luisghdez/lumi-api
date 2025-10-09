import { FastifyReply, FastifyRequest } from "fastify";
import { sendError } from "../utils/error";
import { searchSchoolsByName } from "../services/schoolDiscoveryService";

/**
 * GET /api/blackboard/schools/search?name=utep
 * Returns candidates (id, name, domain). You can just pass domain to /auth/start.
 */
export async function schoolSearchHandler(
  request: FastifyRequest<{ Querystring: { name?: string } }>,
  reply: FastifyReply
) {
  const q = (request.query.name || "").trim();
  if (!q) return sendError(reply, 400, "Missing 'name' query");
  const results = searchSchoolsByName(q);
  reply.send({ results });
}