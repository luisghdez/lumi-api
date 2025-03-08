import { FastifyInstance } from "fastify";
import { ensureUserExistsController } from "../controllers/userController";
import { authenticateUser } from "../middleware/authUser";

async function userRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/users/me",
    preHandler: authenticateUser, // ensures the user is authenticated
    handler: ensureUserExistsController,
  });
}

export default userRoutes;
