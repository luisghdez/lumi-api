// routes/cronRoutes.ts
import { FastifyInstance } from "fastify";
import { db } from "../config/firebaseConfig";
import { sendPushToUser } from "../services/notification_service";

export default async function cronRoutes(fastify: FastifyInstance) {
  fastify.get("/cron/reengagement", async (request, reply) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3);

    const inactiveUsers = await db
      .collection("users")
      .where("lastCheckIn", "<", cutoff)
      .get();

    const tasks: Promise<void>[] = [];
    inactiveUsers.forEach(doc => {
      tasks.push(
        sendPushToUser(
          doc.id,
          "👋 We miss you!",
          "Come back today and continue your streak 💪"
        )
      );
    });

    await Promise.all(tasks);
    return { sent: inactiveUsers.size };
  });
}
