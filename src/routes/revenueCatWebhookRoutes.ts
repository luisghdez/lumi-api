import { FastifyInstance } from "fastify";
import admin from "firebase-admin";
import { db } from "../config/firebaseConfig";
import { entitlementUpdate, webhookAuthorized } from "../services/revenueCatEvent";

type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  environment?: string;
  product_id?: string;
  entitlement_ids?: string[];
  event_timestamp_ms?: number;
  expiration_at_ms?: number | null;
};

export default async function revenueCatWebhookRoutes(fastify: FastifyInstance) {
  fastify.post("/webhooks/revenuecat", async (request, reply) => {
    const secret = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;
    if (!secret) {
      request.log.error("RevenueCat webhook secret is not configured");
      return reply.code(503).send({ error: "Webhook not configured" });
    }
    if (!webhookAuthorized(request.headers.authorization, secret)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const body = request.body as { event?: RevenueCatEvent } | undefined;
    const event = body?.event;
    if (!event || typeof event.id !== "string" || !/^[a-zA-Z0-9_-]{1,180}$/.test(event.id)
      || typeof event.type !== "string" || typeof event.event_timestamp_ms !== "number") {
      return reply.code(400).send({ error: "Invalid webhook event" });
    }
    const eventTimestampMs = event.event_timestamp_ms;

    const eventRef = db.collection("revenueCatWebhookEvents").doc(event.id);
    const userIds = [event.app_user_id, event.original_app_user_id, ...(event.aliases || [])]
      .filter((id): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id)
        && !id.startsWith("$RCAnonymousID:"));
    const candidateIds = [...new Set(userIds)].slice(0, 10);
    const entitlementState = entitlementUpdate(event.type, event.environment, event.entitlement_ids);

    const duplicate = await db.runTransaction(async (tx) => {
      if ((await tx.get(eventRef)).exists) return true;
      const candidates = await Promise.all(candidateIds.map(async (id) => {
        const ref = db.collection("users").doc(id);
        return { id, ref, snapshot: await tx.get(ref) };
      }));
      const user = candidates.find((candidate) => candidate.snapshot.exists);
      tx.create(eventRef, {
        eventId: event.id, type: event.type, userId: user?.id || null,
        environment: event.environment || null, productId: event.product_id || null,
        eventTimestampMs,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (user && entitlementState !== null) {
        const previous = user.snapshot.get("revenueCatEventTimestampMs") || 0;
        if (eventTimestampMs >= previous) {
          tx.update(user.ref, {
            isPremium: entitlementState,
            revenueCatEventTimestampMs: eventTimestampMs,
            activeProductId: entitlementState ? event.product_id || null : null,
            subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
      tx.create(db.collection("analyticsEvents").doc(), {
        type: "subscription_webhook_received", eventId: event.id,
        eventType: event.type, userId: user?.id || null,
        environment: event.environment || null,
        occurredAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return false;
    });

    return reply.code(200).send({ received: true, duplicate });
  });
}
