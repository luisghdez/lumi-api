/**
 * 🧭 Lumi Re-Engagement & Motivation Notification Logic
 *
 * Runs hourly and sends time-sensitive notifications based on the user's local
 * timezone and their recent activity. Hours below are the user's local hour.
 *
 * ──────────────────────────────────────────────────────────────
 * 🗓️ DAILY BEHAVIOR SUMMARY
 *
 *  MONDAY (max 3 notifications)
 *   • Morning Lock-In (07–09h) → motivational kickoff (replaces Morning Motivation)
 *   • Re-engage / Momentum (17–21h)
 *   • Evening Reflection (21–22h) → soft close of day
 *
 *  TUE–THU (max 3 notifications)
 *   • Morning Motivation (07–08h)
 *   • Re-engage / Momentum (17–21h)
 *   • Evening Reflection (21–22h)
 *
 *  FRIDAY (max 2 notifications)
 *   • Morning Motivation (07–08h)
 *   • Friday Congrats (11–13h) → end-of-week encouragement
 *   (No evening notifications)
 *
 *  SATURDAY / SUNDAY
 *   • No notifications
 *
 * ──────────────────────────────────────────────────────────────
 * ⚡ RE-ENGAGEMENT LOGIC (17–21h)
 *  • "Momentum" → user last studied yesterday (local calendar day). Once per day.
 *  • "Re-engagement" → user inactive ≥ 3 days. Once per inactivity stretch
 *    (allowed again only after the user studies since the last one).
 *
 * ──────────────────────────────────────────────────────────────
 * 🔒 DELIVERY GUARANTEES
 *  • Only one run per UTC hour across all API instances (lock doc in `notificationLog`).
 *  • Per user: each type at most once per local day, at most `maxPerDay` per local day,
 *    at most one per local hour. Users are marked before sending, so a crash mid-run
 *    can drop a notification but never duplicate one.
 *
 * ⚙️ COST PER RUN
 *  Users with an FCM token are read in pages of 500 (selected fields only). Per page:
 *  one batched Firestore write for the users being notified + one FCM `sendEach` call.
 */

// src/jobs/reengagement.ts
import { db } from "../config/firebaseConfig";
import { claimNotificationOnce, DAY_MS, PushItem, sendPushBatch } from "../services/notification_service";
import { DateTime } from "luxon";

const PAGE_SIZE = 500; // also the Firestore batch-write and FCM sendEach limits

const USER_FIELDS = [
  "fcmToken",
  "timezone",
  "lastCheckIn",
  "lastMondayLockInAt",
  "lastDailyMotivationAt",
  "lastFridayCongratsAt",
  "lastReengageAt",
  "lastReengageType",
  "lastEveningReflectAt",
  "scheduledPushDate",
  "scheduledPushCount",
  "lastScheduledPushHour",
];

type ResultKey = "dailyMotivation" | "fridayCongrats" | "mondayLockIn" | "reengaged" | "eveningReflect";

export interface Candidate {
  result: ResultKey;
  /** User-doc field holding the local date (yyyy-LL-dd) this type was last sent. */
  sentField: string;
  title: string;
  body: string;
  extraUpdates?: FirebaseFirestore.DocumentData;
}

const MORNING_MESSAGES = [
  "New day, new reps. Lock in and study a little right now.",
  "Small wins add up. Open Lumi and get 10 focused minutes.",
  "Let’s build the streak today. You’ve got this.",
  "Consistency beats intensity. Just show up today.",
  "Your future self will thank you for studying now.",
  "Start your morning with focus. Lumi time.",
  "Momentum starts with one small action. Open Lumi and begin.",
  "No perfect time, just this moment. Make it count.",
  "Build the habit, not the pressure. One short session is enough.",
  "Today’s effort equals tomorrow’s confidence. Let’s go.",
  "Tiny progress today keeps the big goals alive.",
  "Begin the day with purpose. A few minutes of focus is all it takes.",
  "A clear mind starts with a small study session.",
  "The hardest part is starting. Open Lumi and begin now.",
  "Every session counts. Stay consistent and keep growing.",
  "One page today is better than none. Progress is progress.",
  "You don’t need motivation, just a quick start. Open Lumi.",
  "Win the morning by studying for a few focused minutes.",
  "A little effort now keeps your momentum alive.",
  "Show up for yourself today. The rest will follow.",
  "Discipline feels better than regret. Start your session.",
  "A calm focus now sets the tone for your whole day.",
  "Keep your streak alive with a short, focused session.",
  "Start small, finish strong. Begin your Lumi session now.",
  "Growth happens quietly. Take a few minutes to study.",
  "Focus today makes tomorrow easier. You’re in control.",
];

let runningInThisProcess = false;

export async function runReengagementJob(now: Date = new Date()) {
  if (runningInThisProcess) {
    console.log("⏭️ Reengagement job already running in this process, skipping.");
    return { skipped: "already running" };
  }

  const hourKey = DateTime.fromJSDate(now).toUTC().toFormat("yyyy-LL-dd'T'HH");
  if (!(await claimNotificationOnce(`job:reengagement:${hourKey}`, 2 * DAY_MS))) {
    console.log(`⏭️ Reengagement job for ${hourKey} UTC already ran on another instance, skipping.`);
    return { skipped: "already ran this hour" };
  }

  runningInThisProcess = true;
  const results = {
    scanned: 0,
    dailyMotivation: 0,
    fridayCongrats: 0,
    mondayLockIn: 0,
    reengaged: 0,
    eveningReflect: 0,
    sent: 0,
    failed: 0,
    pageErrors: 0,
  };

  try {
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    while (true) {
      let query = db
        .collection("users")
        .where("fcmToken", ">", "")
        .orderBy("fcmToken")
        .select(...USER_FIELDS)
        .limit(PAGE_SIZE);
      if (cursor) query = query.startAfter(cursor);

      const page = await query.get();
      if (page.empty) break;
      results.scanned += page.size;

      try {
        await processPage(page.docs, now, results);
      } catch (err) {
        results.pageErrors++;
        console.error("Reengagement page failed:", err);
      }

      if (page.size < PAGE_SIZE) break;
      cursor = page.docs[page.docs.length - 1];
    }
  } finally {
    runningInThisProcess = false;
  }

  console.log("✅ Engagement job finished:", results);
  return results;
}

async function processPage(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  now: Date,
  results: Record<string, number>
) {
  const batch = db.batch();
  const pushes: PushItem[] = [];
  const planned: ResultKey[] = [];

  for (const doc of docs) {
    const data = doc.data();
    const plan = planForUser(data, now);
    if (!plan) continue;
    batch.update(doc.ref, plan.updates);
    pushes.push({ userId: doc.id, token: data.fcmToken, title: plan.candidate.title, body: plan.candidate.body });
    planned.push(plan.candidate.result);
  }
  if (!pushes.length) return;

  await batch.commit();
  planned.forEach((key) => results[key]++);

  const { sent, failed } = await sendPushBatch(pushes);
  results.sent += sent;
  results.failed += failed;
}

/** What to send this user right now (if anything) and the user-doc updates that record it. */
export function planForUser(
  data: FirebaseFirestore.DocumentData,
  now: Date
): { candidate: Candidate; updates: FirebaseFirestore.DocumentData } | null {
  let nowLocal = DateTime.fromJSDate(now).setZone(data.timezone || "UTC");
  if (!nowLocal.isValid) nowLocal = DateTime.fromJSDate(now).setZone("UTC");

  const weekday = nowLocal.weekday; // 1 = Mon, 7 = Sun
  if (weekday === 6 || weekday === 7) return null;

  const today = nowLocal.toFormat("yyyy-LL-dd");
  const localHourKey = nowLocal.toFormat("yyyy-LL-dd HH");
  if (data.lastScheduledPushHour === localHourKey) return null;

  const sentToday = data.scheduledPushDate === today ? Number(data.scheduledPushCount || 0) : 0;
  const maxPerDay = weekday === 5 ? 2 : 3;
  if (sentToday >= maxPerDay) return null;

  const candidate = pickCandidate(data, nowLocal);
  if (!candidate) return null;

  return {
    candidate,
    updates: {
      [candidate.sentField]: today,
      lastScheduledPushHour: localHourKey,
      scheduledPushDate: today,
      scheduledPushCount: sentToday + 1,
      ...candidate.extraUpdates,
    },
  };
}

/** Highest-priority notification the user is due for in this local hour, if any. */
export function pickCandidate(data: FirebaseFirestore.DocumentData, nowLocal: DateTime): Candidate | null {
  const hour = nowLocal.hour;
  const weekday = nowLocal.weekday;
  const today = nowLocal.toFormat("yyyy-LL-dd");
  const isMonday = weekday === 1;
  const isFriday = weekday === 5;
  const notSentToday = (field: string) => String(data[field] || "") !== today;

  // 1️⃣ Monday lock-in (07–09h)
  if (isMonday && hour >= 7 && hour <= 9 && notSentToday("lastMondayLockInAt")) {
    return {
      result: "mondayLockIn",
      sentField: "lastMondayLockInAt",
      title: "New week, fresh start 💫",
      body: "Let’s lock in for the week — a short session today sets the tone. You’ve got this!",
    };
  }

  // 2️⃣ Morning motivation (07–08h), Tue–Fri
  if (!isMonday && hour >= 7 && hour <= 8 && notSentToday("lastDailyMotivationAt")) {
    return {
      result: "dailyMotivation",
      sentField: "lastDailyMotivationAt",
      title: "Good morning",
      body: MORNING_MESSAGES[Math.floor(Math.random() * MORNING_MESSAGES.length)],
    };
  }

  // 3️⃣ Friday congrats (11–13h)
  if (isFriday && hour >= 11 && hour <= 13 && notSentToday("lastFridayCongratsAt")) {
    return {
      result: "fridayCongrats",
      sentField: "lastFridayCongratsAt",
      title: "Happy Friday",
      body: "You made it! Have an awesome weekend. A quick study session now keeps your momentum strong.",
    };
  }

  if (isFriday) return null;

  // 4️⃣ Momentum or re-engagement (17–21h)
  const lastCheckInDate: Date | null = data.lastCheckIn?.toDate?.() ?? null;
  if (lastCheckInDate && hour >= 17 && hour <= 21 && notSentToday("lastReengageAt")) {
    const lastCheck = DateTime.fromJSDate(lastCheckInDate).setZone(nowLocal.zone);
    const lastDay = lastCheck.toFormat("yyyy-LL-dd");
    const yesterday = nowLocal.minus({ days: 1 }).toFormat("yyyy-LL-dd");
    const inactiveDays = nowLocal.diff(lastCheck, "days").days;

    if (lastDay === yesterday) {
      return {
        result: "reengaged",
        sentField: "lastReengageAt",
        title: "Keep the streak alive 🔥",
        body: "You killed it yesterday! Come back in today to level up your streak again.",
        extraUpdates: { lastReengageType: "momentum" },
      };
    }
    const studiedSinceLastReengage = String(data.lastReengageAt || "") < lastDay;
    if (inactiveDays >= 3 && (data.lastReengageType !== "inactive" || studiedSinceLastReengage)) {
      return {
        result: "reengaged",
        sentField: "lastReengageAt",
        title: "Lumi misses you",
        body: "It’s been a few days since your last study session. Jump back in and keep growing!",
        extraUpdates: { lastReengageType: "inactive" },
      };
    }
  }

  // 5️⃣ Evening reflection (21–22h)
  if (hour >= 21 && hour <= 22 && notSentToday("lastEveningReflectAt")) {
    return {
      result: "eveningReflect",
      sentField: "lastEveningReflectAt",
      title: "Day’s almost done",
      body: "Take a moment to reflect or squeeze in one last quick study session before the day ends.",
    };
  }

  return null;
}
