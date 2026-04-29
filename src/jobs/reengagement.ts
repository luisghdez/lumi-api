/**
 * 🧭 Lumi Re-Engagement & Motivation Notification Logic
 *
 * The job runs once per day (recommended), and sends time-sensitive notifications
 * based on the user's local timezone and their recent activity.
 *
 * ──────────────────────────────────────────────────────────────
 * 🗓️ DAILY BEHAVIOR SUMMARY
 *
 *  MONDAY (max 3 notifications)
 *   • Morning Lock-In (06:30–09:30) → motivational kickoff
 *   • Re-engage / Momentum (17:00–21:00)
 *        - "Momentum" push → if user studied yesterday
 *          (lastCheckIn within 12–36h OR previous calendar day)
 *        - "Re-engagement" push → if user inactive ≥ 3 days
 *   • Evening Reflection (20:30–22:00) → soft close of day
 *
 *  TUE–THU (max 3 notifications)
 *   • Morning Motivation (06:30–08:30)
 *   • Re-engage / Momentum (17:00–21:00) → same logic as Monday
 *   • Evening Reflection (20:30–22:00)
 *
 *  FRIDAY (max 2 notifications)
 *   • Morning Motivation (06:30–08:30)
 *   • Friday Congrats (11:00–13:00) → end-of-week encouragement
 *   (No evening notifications)
 *
 *  SATURDAY / SUNDAY
 *   • No notifications (weekends are skipped)
 *
 * ──────────────────────────────────────────────────────────────
 * 🔁 STREAK LOGIC
 *  • Streak Expiring (17:00–21:00)
 *      Triggers if last check-in was 22–36 hours ago.
 *      Reminder to maintain streak before expiration.
 *
 * ──────────────────────────────────────────────────────────────
 * ⚡ RE-ENGAGEMENT LOGIC
 *
 *  const studiedYesterday =
 *    lastDay !== today && diffHours < 36 && diffHours >= 12;
 *
 *  → If TRUE → user gets “Momentum” message:
 *        "Keep the streak alive 🔥"
 *        "You killed it yesterday! Come back in today..."
 *
 *  → Else if inactive ≥ 3 days → user gets “Re-engagement” message:
 *        "Lumi misses you"
 *        "It’s been a few days since your last study session..."
 *
 *  Each type (momentum/inactive) only sends once per calendar day.
 */


// src/jobs/reengagement.ts
import { db } from "../config/firebaseConfig";
import { sendPushToUser } from "../services/notification_service";
import { DateTime } from "luxon";

export async function runReengagementJob() {
  const now = new Date();
  const results = {
    streakExpiring: 0,
    dailyMotivation: 0,
    fridayCongrats: 0,
    mondayLockIn: 0,
    reengaged3Days: 0,
    eveningReflect: 0,
    skippedWeekend: 0,
  };

  const usersSnap = await db.collection("users").get();
  const tasks: Promise<void>[] = [];

  usersSnap.forEach((doc) => tasks.push(handleUser(doc, results, now)));

  await Promise.allSettled(tasks);
  console.log("✅ Engagement job finished:", results);
  return results;
}

async function handleUser(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
  results: any,
  now: Date
) {
  const data = doc.data() as any;
  const tz = data.timezone || "UTC";
  const nowLocal = DateTime.fromJSDate(now).setZone(tz);
  const hour = nowLocal.hour;
  const weekday = nowLocal.weekday; // 1 = Mon, 7 = Sun
  const today = nowLocal.toFormat("yyyy-LL-dd");
  const lastCheckIn = data.lastCheckIn?.toDate?.() ?? null;

  // 🚫 Skip weekends entirely
  if (weekday === 6 || weekday === 7) {
    results.skippedWeekend++;
    return;
  }

  const isMonday = weekday === 1;
  const isFriday = weekday === 5;

  // 🆕 Notification limits
  const maxSendsPerDay = isFriday ? 2 : 3;
  let sendsToday = 0;

  // 1️⃣ Monday lock-in (6:30–9:30 AM)
  if (isMonday && hour >= 6.5 && hour <= 9.5 && data.lastMondayLockInAt !== today) {
    await sendPushToUser(
      doc.id,
      "New week, fresh start 💫",
      "Let’s lock in for the week — a short session today sets the tone. You’ve got this!"
    );
    await doc.ref.update({ lastMondayLockInAt: today });
    results.mondayLockIn++;
    sendsToday++;
  }

  // 2️⃣ Morning motivation (6:30–8:30 AM)
  const inMorningWindow = hour >= 6.5 && hour <= 8.5;
  const lastDailyMotivationAt = String(data.lastDailyMotivationAt || "");
  if (sendsToday < maxSendsPerDay && inMorningWindow && lastDailyMotivationAt !== today) {
    const messages = [
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
    const msg = messages[Math.floor(Math.random() * messages.length)];
    await sendPushToUser(doc.id, "Good morning", msg);
    await doc.ref.update({ lastDailyMotivationAt: today });
    results.dailyMotivation++;
    sendsToday++;
  }

  // 3️⃣ Friday congrats (11–13h)
  if (isFriday && sendsToday < maxSendsPerDay && hour >= 11 && hour <= 13 && data.lastFridayCongratsAt !== today) {
    await sendPushToUser(
      doc.id,
      "Happy Friday",
      "You made it! Have an awesome weekend. A quick study session now keeps your momentum strong."
    );
    await doc.ref.update({ lastFridayCongratsAt: today });
    results.fridayCongrats++;
    sendsToday++;
  }

  // 🧠 Skip evening-related notifications on Friday
  if (isFriday) return;

// 5️⃣ Re-engagement or streak momentum (17–21h)
if (sendsToday < maxSendsPerDay && lastCheckIn && hour >= 17 && hour <= 21) {
  const lastCheck = DateTime.fromJSDate(lastCheckIn).setZone(tz);
  const diffHours = nowLocal.diff(lastCheck, "hours").hours;
  const diffDays = nowLocal.diff(lastCheck, "days").days;

  const lastReengageAt = String(data.lastReengageAt || "");
  const lastReengageType = data.lastReengageType || ""; // 🆕 track which type we sent last

  // 🆕 Case 1: user studied yesterday (12–36h or previous calendar day)
  const lastDay = lastCheck.toFormat("yyyy-LL-dd");
  const studiedYesterday =
  lastDay !== today && diffHours < 36 && diffHours >= 12;

  if (studiedYesterday && lastReengageAt !== today && lastReengageType !== "momentum") {
    await sendPushToUser(
      doc.id,
      "Keep the streak alive 🔥",
      "You killed it yesterday! Come back in today to level up your streak again."
    );
    await doc.ref.update({
      lastReengageAt: today,
      lastReengageType: "momentum",
    });
    results.reengaged3Days++;
    sendsToday++;
  }
  // 🆕 Case 2: user inactive ≥ 3 days
  else if (diffDays >= 3 && lastReengageAt !== today && lastReengageType !== "inactive") {
    await sendPushToUser(
      doc.id,
      "Lumi misses you",
      "It’s been a few days since your last study session. Jump back in and keep growing!"
    );
    await doc.ref.update({
      lastReengageAt: today,
      lastReengageType: "inactive",
    });
    results.reengaged3Days++;
    sendsToday++;
  }
}

  // 6️⃣ Evening reflection (20:30–22h)
  const inEveningWindow = hour >= 20.5 && hour <= 22;
  if (sendsToday < maxSendsPerDay && inEveningWindow && data.lastEveningReflectAt !== today) {
    await sendPushToUser(
      doc.id,
      "Day’s almost done",
      "Take a moment to reflect or squeeze in one last quick study session before the day ends."
    );
    await doc.ref.update({ lastEveningReflectAt: today });
    results.eveningReflect++;
    sendsToday++;
  }
}