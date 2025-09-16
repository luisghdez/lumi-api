import { admin, db } from "../config/firebaseConfig";

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.warn(`❌ Cannot send push — user ${userId} not found.`);
      return;
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcmToken;

    if (!fcmToken) {
      console.warn(`⚠️ No FCM token for user ${userId}.`);
      return;
    }

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: { title, body },
      android: {
        priority: "high",
        ttl: 60 * 60 * 1000, // 1 hour
        notification: { sound: "default" },
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: { aps: { sound: "default" } },
      },
      data,
    };

    await admin.messaging().send(message);
    console.log(`📬 Push sent to user ${userId}: "${title}"`);
  } catch (error: any) {
    console.error("❌ Error sending push:", error);

    // Handle token errors (important!)
    if (error.code === "messaging/invalid-argument" ||
        error.code === "messaging/registration-token-not-registered") {
      await db.collection("users").doc(userId).update({ fcmToken: admin.firestore.FieldValue.delete() });
      console.log(`🗑️ Removed invalid FCM token for ${userId}`);
    }

    throw error;
  }
}
