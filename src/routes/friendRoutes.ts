import { FastifyInstance } from "fastify";
import { createFriendRequestController, getFriendRequestsController, getFriendsController, respondFriendRequestController, searchUsersController } from "../controllers/friendController";
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

  fastify.route({
    method: "GET",
    url: "/friend-requests",
    preHandler: authenticateUser,
    handler: getFriendRequestsController,
  });
  
  fastify.route({
    method: "PATCH",
    url: "/friend-requests/:id",
    preHandler: authenticateUser,
    handler: respondFriendRequestController,
  });

  fastify.route({
    method: "GET",
    url: "/friends",
    preHandler: authenticateUser,
    handler: getFriendsController,
  });
}

export default friendRoutes;
