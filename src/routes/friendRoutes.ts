import { FastifyInstance } from "fastify";
import { searchUsersController } from "../controllers/friendController";
import { authenticateUser } from "../middleware/authUser";

// Route for searching users by email or name
async function friendRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "GET",
    url: "/friend-requests/search",
    preHandler: authenticateUser,
    handler: searchUsersController,
  });
}

export default friendRoutes;
