import { FastifyInstance } from "fastify";
import { createFriendRequestController, searchUsersController } from "../controllers/friendController";
import { authenticateUser } from "../middleware/authUser";

// Route for searching users by email or name
async function friendRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "GET",
    url: "/friend-requests/search",
    preHandler: authenticateUser,
    handler: searchUsersController,
  });
  
  fastify.route({
    method: "POST",
    url: "/friend-requests",
    preHandler: authenticateUser,
    handler: createFriendRequestController,
  });
}

export default friendRoutes;
