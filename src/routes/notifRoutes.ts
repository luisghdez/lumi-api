import { FastifyInstance } from "fastify";

import { authenticateUser } from "../middleware/authUser";
import { updateFcmTokenController } from "../controllers/userController";
import { sendPushToUser } from "../services/notification_service";


async function notiRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "PATCH",
    url: "/users/token",
    preHandler: authenticateUser,
    handler: updateFcmTokenController,
  });


  fastify.get("/notif/test", async (request, reply) => {
    const { userId } = request.query as { userId?: string };

    if (!userId) {
      return reply.code(400).send({ error: "Missing userId" });
    }

    await sendPushToUser(
      userId,
      "🔥 Test Push",
      "This is a test notification from backend",
      { route: "/" }
    );

    return { success: true, userId };
  });

}


export default notiRoutes;
