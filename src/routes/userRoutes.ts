import { FastifyInstance } from "fastify";
import { deleteUserController, ensureUserExistsController, getUserProfileController, updateUserProfileController } from "../controllers/userController";
import { authenticateUser } from "../middleware/authUser";
import { applyReferralCodeController } from "../controllers/userController";


async function userRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/users/me",
    preHandler: authenticateUser, // ensures the user is authenticated
    handler: ensureUserExistsController,
  });

  fastify.route({
    method: "GET",
    url: "/users/:userId",
    preHandler: authenticateUser, // Ensures the request is authenticated.
    handler: getUserProfileController,
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


  fastify.route({
    method: "POST",
    url: "/users/me/referral",
    preHandler: authenticateUser,
    handler: applyReferralCodeController,
  });
  
  
}

export default userRoutes;
