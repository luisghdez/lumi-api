import { FastifyInstance } from "fastify";

import { authenticateUser } from "../middleware/authUser";
import { updateFcmTokenController } from "../controllers/userController";

async function notiRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "PATCH",
    url: "/users/token",
    preHandler: authenticateUser,
    handler: updateFcmTokenController,
  });
}

export default notiRoutes;
