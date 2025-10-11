import { FastifyInstance } from "fastify";
import { DateTime } from "luxon";

import { authenticateUser } from "../middleware/authUser";
import { updateFcmTokenController } from "../controllers/userController";
import { sendPushToUser } from "../services/notification_service";
import { db } from "../config/firebaseConfig";


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

  // NEW: Test endpoint to verify timezone-based notification logic
  fastify.get("/notif/timezone-check", async (request, reply) => {
    const { userId } = request.query as { userId?: string };

    if (!userId) {
      return reply.code(400).send({ error: "Missing userId parameter" });
    }

    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        return reply.code(404).send({ error: "User not found" });
      }

      const userData = userDoc.data();
      const tz = userData?.timezone || "UTC";
      const nowLocal = DateTime.now().setZone(tz);
      const hour = nowLocal.hour;
      const weekday = nowLocal.weekday; // 1=Mon, 7=Sun
      
      const weekdayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      
      return {
        userId,
        timezone: tz,
        currentLocalTime: nowLocal.toFormat('yyyy-MM-dd HH:mm:ss'),
        hour,
        weekday: weekdayNames[weekday],
        notifications: {
          dailyMotivation: {
            eligible: hour >= 7 && hour <= 9,
            window: "7-9 AM local time",
            currentHour: hour
          },
          fridayCongrats: {
            eligible: weekday === 5 && hour >= 11 && hour <= 14,
            window: "Friday 11 AM - 2 PM local time",
            isFriday: weekday === 5,
            currentHour: hour
          },
          mondayLockIn: {
            eligible: weekday === 1 && hour >= 7 && hour <= 10,
            window: "Monday 7-10 AM local time",
            isMonday: weekday === 1,
            currentHour: hour
          },
          reengagement: {
            window: "3-4 PM local time after 3 days inactive",
            eligible: hour >= 15 && hour < 16,
            currentHour: hour
          }
        }
      };
    } catch (error) {
      console.error("Error checking timezone:", error);
      return reply.code(500).send({ error: "Failed to check timezone" });
    }
  });

}


export default notiRoutes;
