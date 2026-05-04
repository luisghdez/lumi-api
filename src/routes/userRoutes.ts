import { FastifyInstance } from "fastify";
import {
  deleteUserController,
  ensureUserExistsController,
  getUserFriendsController,
  getUserProfileController,
  getUserSavedCoursesController,
  getUserVideosController,
  updateUserProfileController,
} from "../controllers/userController";
import { authenticateUser } from "../middleware/authUser";

async function userRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/users/me",
    preHandler: authenticateUser, // ensures the user is authenticated
    handler: ensureUserExistsController,
  });

  fastify.route({
    method: "GET",
    url: "/users/:userId/courses",
    preHandler: authenticateUser,
    handler: getUserSavedCoursesController,
  });

  fastify.route({
    method: "GET",
    url: "/users/:userId/friends",
    preHandler: authenticateUser,
    handler: getUserFriendsController,
  });

  fastify.route({
    method: "GET",
    url: "/users/:userId",
    preHandler: authenticateUser, // Ensures the request is authenticated.
    handler: getUserProfileController,
  });

  fastify.route({
    method: "GET",
    url: "/users/:userId/videos",
    preHandler: authenticateUser,
    handler: getUserVideosController,
  });

  fastify.route({
    method: "PATCH",
    url: "/users/me",
    preHandler: authenticateUser,
    handler: updateUserProfileController,
  });

  fastify.route({
    method: "DELETE",
    url: "/users/me",
    preHandler: authenticateUser, // ensures the user is authenticated
    handler: deleteUserController, // implement this next
  });
  
}

export default userRoutes;
