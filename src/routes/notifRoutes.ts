import { FastifyInstance } from "fastify";
import { DateTime } from "luxon";

import { authenticateUser } from "../middleware/authUser";
import { removeFcmTokenController, updateFcmTokenController } from "../controllers/userController";
import { sendPushToUser } from "../services/notification_service";
import { db } from "../config/firebaseConfig";
import { planForUser } from "../jobs/reengagement";


async function notiRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "PATCH",
    url: "/users/token",
    preHandler: authenticateUser,
    handler: updateFcmTokenController,
  });

  fastify.route({
    method: "DELETE",
    url: "/users/token",
    preHandler: authenticateUser,
    handler: removeFcmTokenController,
  });

  // Sends a test push to the authenticated caller only.
  fastify.get("/notif/test", { preHandler: authenticateUser }, async (request, reply) => {
    const userId = (request as any).user?.uid as string | undefined;
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const sent = await sendPushToUser(
      userId,
      "🔥 Test Push",
      "This is a test notification from backend",
      { route: "/" }
    );

    return { success: sent, userId };
  });

  // Shows the caller's local time and what the hourly job would send them right now.
  fastify.get("/notif/timezone-check", { preHandler: authenticateUser }, async (request, reply) => {
    const userId = (request as any).user?.uid as string | undefined;
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        return reply.code(404).send({ error: "User not found" });
      }

      const userData = userDoc.data() ?? {};
      const tz = userData.timezone || "UTC";
      const nowLocal = DateTime.now().setZone(tz);
      const plan = planForUser(userData, new Date());

      return {
        userId,
        timezone: tz,
        currentLocalTime: nowLocal.toFormat("yyyy-MM-dd HH:mm:ss"),
        weekday: nowLocal.weekdayLong,
        hasFcmToken: Boolean(userData.fcmToken),
        scheduledPushesToday:
          userData.scheduledPushDate === nowLocal.toFormat("yyyy-LL-dd") ? userData.scheduledPushCount || 0 : 0,
        wouldSendNow: plan ? { type: plan.candidate.result, title: plan.candidate.title } : null,
      };
    } catch (error) {
      console.error("Error checking timezone:", error);
      return reply.code(500).send({ error: "Failed to check timezone" });
    }
  });

}


export default notiRoutes;
