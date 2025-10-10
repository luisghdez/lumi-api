// routes/cronRoutes.ts
import { FastifyInstance } from "fastify";
import cron from "node-cron";
import { runReengagementJob } from "../jobs/reengagement";

export default async function cronRoutes(fastify: FastifyInstance) {
  // Manual trigger via API
  fastify.get("/cron/reengagement", async (request, reply) => {
    const sent = await runReengagementJob();
    return { sent };
  });

  cron.schedule("0 * * * *", async () => {
    console.log("⏰ Running scheduled reengagement cron (12 PM daily)...");
    try {
      await runReengagementJob();
    } catch (err) {
      console.error("🔥 Reengagement cron failed:", err);
    }
  });
}
