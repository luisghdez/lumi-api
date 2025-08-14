import { FastifyInstance } from "fastify";
import { authenticateUser } from "../middleware/authUser";
import { courseChatController } from "../controllers/ragController";

async function ragRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/courses/:courseId/chat",
    preHandler: authenticateUser,
    handler: courseChatController,
  });
}

export default ragRoutes;


