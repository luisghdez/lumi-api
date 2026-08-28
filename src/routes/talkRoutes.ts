import { FastifyInstance } from "fastify";
import { assessTalkAttemptController, createTalkSessionController, createTalkWebRtcOfferController } from "../controllers/talkController";
import { authenticateUser } from "../middleware/authUser";

export default async function talkRoutes(fastify: FastifyInstance) {
  fastify.post("/talk/sessions", { preHandler: authenticateUser }, createTalkSessionController);
  fastify.post("/talk/attempts/:attemptId/offer", { preHandler: authenticateUser }, createTalkWebRtcOfferController);
  fastify.post("/talk/attempts/:attemptId/assess", { preHandler: authenticateUser }, assessTalkAttemptController);
}
