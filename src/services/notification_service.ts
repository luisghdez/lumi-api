import { admin, db } from "../config/firebaseConfig";

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {} // optional payload
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

    const message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
      data, // Optional payload (for navigation, etc.)
    };

    await admin.messaging().send(message);
    console.log(`📬 Push sent to user ${userId}: "${title}"`);
  } catch (error) {
    console.error("❌ Error sending push:", error);
    throw error;
  }
}
