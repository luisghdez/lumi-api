// routes/cronRoutes.ts
import { FastifyInstance } from "fastify";
import cron from "node-cron";
import { runReengagementJob } from "../jobs/reengagement";

export default async function cronRoutes(fastify: FastifyInstance) {
  // Manual trigger via API. Requires `x-cron-secret: $CRON_SECRET`; disabled when CRON_SECRET is unset.
  // Still subject to the job's once-per-hour lock.
  fastify.get("/cron/reengagement", async (request, reply) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers["x-cron-secret"] !== secret) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const sent = await runReengagementJob();
    return { sent };
  });

  // Every environment (prod, dev, local `npm run dev`) shares the same Firestore and FCM project,
  // so the scheduler only runs where it is explicitly enabled (production).
  if (process.env.ENABLE_NOTIFICATION_CRON !== "true") {
    console.log("⏸️ Reengagement cron disabled (set ENABLE_NOTIFICATION_CRON=true to enable).");
    return;
  }

  cron.schedule("0 * * * *", async () => {
    console.log("⏰ Running hourly reengagement cron...");
    try {
      await runReengagementJob();
    } catch (err) {
      console.error("🔥 Reengagement cron failed:", err);
    }
  });
}
