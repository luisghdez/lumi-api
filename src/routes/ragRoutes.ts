import { FastifyInstance } from "fastify";
import { authenticateUser } from "../middleware/authUser";
import { courseChatController, createThreadController } from "../controllers/ragController";

async function ragRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/courses/:courseId/chat",
    preHandler: authenticateUser,
    handler: courseChatController,
  });

  fastify.route({
    method: "POST",
    url: "/threads",
    preHandler: authenticateUser,
    handler: createThreadController,
  });
}

export default ragRoutes;


