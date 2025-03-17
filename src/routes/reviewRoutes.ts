import { FastifyInstance } from "fastify";
import { reviewController } from "../controllers/reviewController";
import { reviewAudioController } from "../controllers/reviewAudioController";
import { authenticateUser } from "../middleware/authUser";

async function reviewRoutes(fastify: FastifyInstance) {
  // POST /review - Process review and return JSON data with sessionId
  fastify.route({
    method: "POST",
    url: "/review",
    preHandler: authenticateUser,
    handler: reviewController,
  });

  // GET /review/audio - Return the TTS audio associated with a sessionId
  fastify.route({
    method: "GET",
    url: "/review/audio",
    preHandler: authenticateUser,
    handler: reviewAudioController,
  });
}

export default reviewRoutes;
