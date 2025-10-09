// src/jobs/reengagement.ts
import { db } from "../config/firebaseConfig";
import { sendPushToUser } from "../services/notification_service";
import { DateTime } from "luxon";

/**
 * Unified engagement job that runs all notification checks
 * 1️⃣ Streak about-to-expire (>=22h)
 * 2️⃣ Daily motivation (7–9 AM)
 * 3️⃣ Friday midday (11–14h)
 * 4️⃣ Monday lock-in (7–10h)
 * 5️⃣ Re-engagement after 3 days (3–4 PM)
 */
export async function runReengagementJob() {
  const now = new Date();
  const results = {
    streakExpiring: 0,
    dailyMotivation: 0,
    fridayCongrats: 0,
    mondayLockIn: 0,
    reengaged3Days: 0,
  };

  const usersSnap = await db.collection("users").get();
  const tasks: Promise<void>[] = [];

  usersSnap.forEach((doc) => {
    tasks.push(handleUser(doc, results, now));
  });

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
  const nowLocal = DateTime.now().setZone(tz);
  const hour = nowLocal.hour;
  const weekday = nowLocal.weekday; // 1 = Mon, 5 = Fri
  const today = nowLocal.toFormat("yyyy-LL-dd");

  const lastCheckIn = data.lastCheckIn?.toDate?.() ?? null;

  // 1️⃣ Streak about-to-expire (22h)
  if (lastCheckIn) {
    const diffHours =
      (now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60);
    if (diffHours >= 22 && diffHours < 36) {
      const lastWarn = data.lastAboutToExpireAt?.toDate?.() ?? null;
      if (!lastWarn || lastWarn < lastCheckIn) {
        await sendPushToUser(
          doc.id,
          "Your streak is about to expire 🔥",
          "It’s been a while—open Lumi now to keep the streak alive!"
        );
        await doc.ref.update({
          lastAboutToExpireAt: new Date(),
        });
        results.streakExpiring++;
      }
    }
  }

  // 2️⃣ Daily morning motivation (7–9h local)
  const inMorningWindow = hour >= 7 && hour <= 9;
  if (inMorningWindow && data.lastDailyMotivationAt !== today) {
    const messages = [
      "New day, new reps. Lock in and study a little right now 📚",
      "Small wins add up — open Lumi and get 10 focused minutes ✅",
      "Let’s build the streak today. You’ve got this 💪",
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];

    await sendPushToUser(doc.id, "Good morning ☀️", msg);
    await doc.ref.update({ lastDailyMotivationAt: today });
    results.dailyMotivation++;
  }

  // 3️⃣ Friday midday (11–14h)
  const isFriday = weekday === 5;
  if (isFriday && hour >= 11 && hour <= 14 && data.lastFridayCongratsAt !== today) {
    await sendPushToUser(
      doc.id,
      "Happy Friday 🎉",
      "You made it! Have an awesome weekend — a quick study session now keeps your momentum strong."
    );
    await doc.ref.update({ lastFridayCongratsAt: today });
    results.fridayCongrats++;
  }

  // 4️⃣ Monday morning lock-in (7–10h)
  const isMonday = weekday === 1;
  if (isMonday && hour >= 7 && hour <= 10 && data.lastMondayLockInAt !== today) {
    await sendPushToUser(
      doc.id,
      "New week, fresh start 💫",
      "Let’s lock in for the week — a short session today sets the tone. You’ve got this!"
    );
    await doc.ref.update({ lastMondayLockInAt: today });
    results.mondayLockIn++;
  }

  // 5️⃣ Re-engagement after 3 days (3–4 PM)
  if (lastCheckIn) {
    const diffDays = (now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays >= 3 && hour >= 15 && hour < 16 && data.lastReengageAt !== today) {
      await sendPushToUser(
        doc.id,
        "Lumi misses you 💡",
        "It’s been a few days since your last study session — jump back in and keep growing!"
      );
      await doc.ref.update({ lastReengageAt: today });
      results.reengaged3Days++;
    }
  }
}