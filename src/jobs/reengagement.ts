import { pubsub } from "firebase-functions/v1";
import { db } from "../config/firebaseConfig";
import { sendPushToUser } from "../services/notification_service";

export const sendReengagementPushes = pubsub
  .schedule("0 0 * * *") // every midnight UTC
  .timeZone("UTC")
  .onRun(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3); // Inactive for 3+ days

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
    console.log(`📢 Sent re-engagement push to ${inactiveUsers.size} users`);
  });
