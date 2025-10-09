// functions/src/jobs/engagementJobs.ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { DateTime } from "luxon";
import { sendPushToUser } from "../services/notification_service";

admin.initializeApp();
const db = admin.firestore();

// ---------- helpers ----------

function userLocalNow(tz?: string) {
  const zone = tz && DateTime.local().setZone(tz).isValid ? tz : "UTC";
  return DateTime.now().setZone(zone);
}

function toYMD(dt: DateTime) {
  return dt.toFormat("yyyy-LL-dd");
}

async function processUsersInBatches(
  query: FirebaseFirestore.Query,
  handler: (snap: FirebaseFirestore.QueryDocumentSnapshot) => Promise<void>,
  pageSize = 500
) {
  let nextQuery = query.limit(pageSize);
  while (true) {
    const page = await nextQuery.get();
    if (page.empty) break;

    const tasks: Promise<void>[] = [];
    page.forEach((doc) => tasks.push(handler(doc)));
    await Promise.allSettled(tasks);

    if (page.size < pageSize) break;
    const last = page.docs[page.docs.length - 1];
    nextQuery = query.limit(pageSize).startAfter(last);
  }
}

// ---------- 1) Streak about-to-expire (>=22h since check-in) ----------
export const hourlyStreakAboutToExpire = onSchedule(
  { schedule: "every 60 minutes", timeZone: "UTC" },
  async () => {
    const now = admin.firestore.Timestamp.now().toDate();
    const twentyTwoHoursMs = 22 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - twentyTwoHoursMs);

    const baseQuery = db.collection("users").where("lastCheckIn", "<=", cutoff);
    let sent = 0;

    await processUsersInBatches(baseQuery, async (doc) => {
      const data = doc.data() as any;
      const lastCheckIn: admin.firestore.Timestamp | undefined = data.lastCheckIn;
      const lastWarn: admin.firestore.Timestamp | undefined = data.lastAboutToExpireAt;

      if (lastWarn && lastCheckIn && lastWarn.toMillis() > lastCheckIn.toMillis()) {
        return;
      }

      await sendPushToUser(
        doc.id,
        "Your streak is about to expire 🔥",
        "It’s been a while—open Lumi now to keep the streak alive!"
      );

      await doc.ref.update({ lastAboutToExpireAt: admin.firestore.Timestamp.now() });
      sent++;
    });

    logger.info(`Streak about-to-expire job: sent=${sent}`);
  }
);

// ---------- 2) Daily morning motivation ----------
export const hourlyDailyMorningMotivation = onSchedule(
  { schedule: "every 60 minutes", timeZone: "UTC" },
  async () => {
    const baseQuery = db.collection("users");
    let sent = 0;

    await processUsersInBatches(baseQuery, async (doc) => {
      const data = doc.data() as any;
      const tz = data.timezone as string | undefined;
      const nowLocal = userLocalNow(tz);
      const hour = nowLocal.hour;
      const today = toYMD(nowLocal);

      const inMorningWindow = hour >= 7 && hour <= 9;
      if (!inMorningWindow) return;
      if (data.lastDailyMotivationAt === today) return;

      const messages = [
        "New day, new reps. Lock in and study a little right now 📚",
        "Small wins add up — open Lumi and get 10 focused minutes ✅",
        "Let’s build the streak today. You’ve got this 💪",
      ];
      const msg = messages[Math.floor(Math.random() * messages.length)];

      await sendPushToUser(doc.id, "Good morning ☀️", msg);
      await doc.ref.update({ lastDailyMotivationAt: today });
      sent++;
    });

    logger.info(`Daily morning motivation: sent=${sent}`);
  }
);

// ---------- 3) Friday midday congrats ----------
export const hourlyFridayMiddayCongrats = onSchedule(
  { schedule: "every 60 minutes", timeZone: "UTC" },
  async () => {
    const baseQuery = db.collection("users");
    let sent = 0;

    await processUsersInBatches(baseQuery, async (doc) => {
      const data = doc.data() as any;
      const tz = data.timezone as string | undefined;
      const nowLocal = userLocalNow(tz);
      const weekday = nowLocal.weekday;
      const hour = nowLocal.hour;
      const today = toYMD(nowLocal);

      if (weekday !== 5) return;
      const inMidday = hour >= 11 && hour <= 14;
      if (!inMidday) return;
      if (data.lastFridayCongratsAt === today) return;

      await sendPushToUser(
        doc.id,
        "Happy Friday 🎉",
        "You made it! Have an awesome weekend — a quick study session now keeps your momentum strong."
      );

      await doc.ref.update({ lastFridayCongratsAt: today });
      sent++;
    });

    logger.info(`Friday midday congrats: sent=${sent}`);
  }
);

// ---------- 4) Monday morning lock-in ----------
export const hourlyMondayLockIn = onSchedule(
  { schedule: "every 60 minutes", timeZone: "UTC" },
  async () => {
    const baseQuery = db.collection("users");
    let sent = 0;

    await processUsersInBatches(baseQuery, async (doc) => {
      const data = doc.data() as any;
      const tz = data.timezone as string | undefined;
      const nowLocal = userLocalNow(tz);
      const weekday = nowLocal.weekday;
      const hour = nowLocal.hour;
      const today = toYMD(nowLocal);

      if (weekday !== 1) return;
      const inMorning = hour >= 7 && hour <= 10;
      if (!inMorning) return;
      if (data.lastMondayLockInAt === today) return;

      await sendPushToUser(
        doc.id,
        "New week, fresh start 💫",
        "Let’s lock in for the week — a short session today sets the tone. You’ve got this!"
      );

      await doc.ref.update({ lastMondayLockInAt: today });
      sent++;
    });

    logger.info(`Monday lock-in: sent=${sent}`);
  }
);