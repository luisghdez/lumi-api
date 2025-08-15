import { FastifyInstance } from "fastify";
import { authenticateUser } from "../middleware/authUser";
import { courseChatController, createThreadController, getUserThreadsController } from "../controllers/ragController";

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

  fastify.route({
    method: "GET",
    url: "/threads",
    preHandler: authenticateUser,
    handler: getUserThreadsController,
  });
}

export default ragRoutes;


