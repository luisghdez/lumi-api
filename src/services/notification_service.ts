import { admin, db } from "../config/firebaseConfig";

export const DAY_MS = 24 * 60 * 60 * 1000;

const NOTIFICATION_LOG_COLLECTION = "notificationLog";
const FIRESTORE_ALREADY_EXISTS = 6;
/** `messaging().sendEach` accepts at most 500 messages per call. */
const FCM_BATCH_LIMIT = 500;
/** Firestore `in` filters accept at most 30 values. */
const FIRESTORE_IN_LIMIT = 30;
/**
 * Only errors that mean the token itself is dead. `messaging/invalid-argument` is excluded
 * on purpose: a malformed payload returns it for every message and would wipe every token.
 */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export interface PushItem {
  userId: string;
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function buildMessage(item: PushItem): admin.messaging.Message {
  return {
    token: item.token,
    notification: { title: item.title, body: item.body },
    android: {
      priority: "high",
      ttl: 60 * 60 * 1000, // 1 hour
      notification: { sound: "default" },
    },
    apns: {
      headers: { "apns-priority": "10" },
      payload: { aps: { sound: "default" } },
    },
    data: item.data ?? {},
  };
}

/**
 * Reserves `key` with a single Firestore write so a notification is sent at most once,
 * even when several API instances (prod, dev, local) or retried requests race on the same
 * event. Returns false if the key was already claimed. Put a time bucket (e.g. the date)
 * in the key for "once per day" semantics. `expireAt` is for a Firestore TTL policy.
 */
export async function claimNotificationOnce(key: string, ttlMs = 30 * DAY_MS): Promise<boolean> {
  try {
    await db
      .collection(NOTIFICATION_LOG_COLLECTION)
      .doc(key.replace(/\//g, "_"))
      .create({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + ttlMs),
      });
    return true;
  } catch (error: any) {
    if (error?.code === FIRESTORE_ALREADY_EXISTS) return false;
    throw error;
  }
}

/**
 * Sends pushes in batches of 500 per FCM request and unlinks dead tokens afterwards.
 * Callers pass tokens they already have, so no per-user Firestore reads happen here.
 */
export async function sendPushBatch(items: PushItem[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const deadTokens: string[] = [];

  for (const group of chunk(items.filter((i) => i.token), FCM_BATCH_LIMIT)) {
    const res = await admin.messaging().sendEach(group.map(buildMessage));
    res.responses.forEach((r, i) => {
      if (r.success) {
        sent++;
        return;
      }
      failed++;
      if (r.error && DEAD_TOKEN_CODES.has(r.error.code)) deadTokens.push(group[i].token);
    });
  }

  if (deadTokens.length) {
    try {
      await removeDeadTokens(deadTokens);
    } catch (err) {
      console.error("Failed to remove dead FCM tokens:", err);
    }
  }
  return { sent, failed };
}

async function removeDeadTokens(tokens: string[]): Promise<void> {
  for (const group of chunk([...new Set(tokens)], FIRESTORE_IN_LIMIT)) {
    const holders = await db.collection("users").where("fcmToken", "in", group).get();
    if (holders.empty) continue;
    const batch = db.batch();
    holders.docs.forEach((doc) => batch.update(doc.ref, { fcmToken: admin.firestore.FieldValue.delete() }));
    await batch.commit();
  }
  console.log(`🗑️ Removed ${tokens.length} dead FCM token(s)`);
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<boolean> {
  const userDoc = await db.collection("users").doc(userId).get();
  const token = userDoc.get("fcmToken") as string | undefined;
  if (!token) return false;

  const { sent } = await sendPushBatch([{ userId, token, title, body, data }]);
  return sent > 0;
}

/** Matches Flutter `push_notification_contract`: `type: friend_request`. */
export async function pushFriendRequest(params: {
  recipientUserId: string;
  actorId: string;
  actorName: string;
  requestId: string;
}): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (!(await claimNotificationOnce(`friend_request:${params.actorId}:${params.recipientUserId}:${today}`, DAY_MS))) {
      return;
    }
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
    // Like → unlike → like again must not re-notify the owner.
    if (!(await claimNotificationOnce(`video_liked:${params.videoId}:${params.likerId}`))) return;
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

/** `type: friend_video_posted` — one batched send to all of the poster's friends, once per video. */
export async function pushFriendsVideoPosted(params: {
  friends: { id: string; fcmToken?: string }[];
  actorId: string;
  actorName: string;
  videoId: string;
}): Promise<void> {
  try {
    const recipients = params.friends.filter((f) => f.id !== params.actorId && f.fcmToken);
    if (!recipients.length) return;
    // Retried `complete` calls must not re-notify friends.
    if (!(await claimNotificationOnce(`friend_video_posted:${params.videoId}`))) return;

    const data = stringData({
      type: "friend_video_posted",
      videoId: params.videoId,
      actorId: params.actorId,
      actorName: params.actorName,
    });
    const unique = new Map(recipients.map((f) => [f.id, f.fcmToken as string]));
    await sendPushBatch(
      [...unique].map(([userId, token]) => ({
        userId,
        token,
        title: "New video from a friend",
        body: `${params.actorName} posted a new video.`,
        data,
      }))
    );
  } catch (err) {
    console.error("pushFriendsVideoPosted failed:", err);
  }
}
