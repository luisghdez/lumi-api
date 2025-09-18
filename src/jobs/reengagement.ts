// jobs/reengagement.ts
import { db } from "../config/firebaseConfig";
import { sendPushToUser } from "../services/notification_service";

export async function runReengagementJob() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 3);

  const inactiveUsers = await db
    .collection("users")
    .where("lastCheckIn", "<", cutoff)
    .get();

  const tasks: Promise<void>[] = [];
  inactiveUsers.forEach((doc) => {
    tasks.push(
      sendPushToUser(
        doc.id,
        "Lumi misses you!",
        "Come back today and continue your streak of learning!",
      )
    );
  });

  await Promise.all(tasks);
  console.log(`✅ Reengagement job finished, sent: ${inactiveUsers.size}`);
  return inactiveUsers.size;
}
