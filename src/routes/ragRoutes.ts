import { FastifyInstance } from "fastify";
import { authenticateUser } from "../middleware/authUser";
import { courseChatController, createThreadController, getUserThreadsController, getThreadMessagesController, getCourseMessagesController, createMessageController, createImageThreadController, addImageToThreadController } from "../controllers/ragController";

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

  fastify.route({
    method: "GET",
    url: "/threads/:threadId/messages",
    preHandler: authenticateUser,
    handler: getThreadMessagesController,
  });

  fastify.route({
    method: "GET",
    url: "/courses/:courseId/messages",
    preHandler: authenticateUser,
    handler: getCourseMessagesController,
  });

  fastify.route({
    method: "POST",
    url: "/threads/:threadId/messages",
    preHandler: authenticateUser,
    handler: createMessageController,
  });

  fastify.route({
    method: "POST",
    url: "/threads/image",
    preHandler: authenticateUser,
    handler: createImageThreadController,
  });

  fastify.route({
    method: "POST",
    url: "/threads/:threadId/messages/image",
    preHandler: authenticateUser,
    handler: addImageToThreadController,
  });
}

export default ragRoutes;


