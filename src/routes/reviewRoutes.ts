import { FastifyInstance } from "fastify";
import { authenticateUser } from "../middleware/authUser";
import { reviewController } from "../controllers/reviewController";

async function reviewRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/review",
    preHandler: authenticateUser,
    handler: reviewController,
  });
}

export default reviewRoutes;
