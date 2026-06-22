import { admin, db } from "../config/firebaseConfig";

/** FCM `data` values must be strings. Skip undefined / null; omit empty optional keys. */
function stringData(entries: Record<string, string | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === null) continue;
    const s = typeof v === "string" ? v : String(v);
    if (s === "") continue;
    out[k] = s;
  }
  return out;
}

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

/** Matches Flutter `push_notification_contract`: `type: friend_request`. */
export async function pushFriendRequest(params: {
  recipientUserId: string;
  actorId: string;
  actorName: string;
  requestId: string;
}): Promise<void> {
  try {
    const data = stringData({
      type: "friend_request",
      actorId: params.actorId,
      actorName: params.actorName,
      requestId: params.requestId,
    });
    await sendPushToUser(
      params.recipientUserId,
      "Friend request",
      `${params.actorName} wants to connect on Lumi.`,
      data
    );
  } catch (err) {
    console.error("pushFriendRequest failed:", err);
  }
}

/** `type: video_liked` — recipient is the video owner. */
export async function pushVideoLiked(params: {
  ownerUserId: string;
  likerId: string;
  likerName: string;
  videoId: string;
}): Promise<void> {
  try {
    if (params.ownerUserId === params.likerId) return;
    const data = stringData({
      type: "video_liked",
      videoId: params.videoId,
      actorId: params.likerId,
      actorName: params.likerName,
    });
    await sendPushToUser(
      params.ownerUserId,
      "New like",
      `${params.likerName} liked your video.`,
      data
    );
  } catch (err) {
    console.error("pushVideoLiked failed:", err);
  }
}

/** `type: friend_video_posted` — recipient is a friend of the poster. */
export async function pushFriendVideoPosted(params: {
  recipientUserId: string;
  actorId: string;
  actorName: string;
  videoId: string;
}): Promise<void> {
  try {
    if (params.recipientUserId === params.actorId) return;
    const data = stringData({
      type: "friend_video_posted",
      videoId: params.videoId,
      actorId: params.actorId,
      actorName: params.actorName,
    });
    await sendPushToUser(
      params.recipientUserId,
      "New video from a friend",
      `${params.actorName} posted a new video.`,
      data
    );
  } catch (err) {
    console.error("pushFriendVideoPosted failed:", err);
  }
}
