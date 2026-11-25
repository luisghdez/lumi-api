import { admin, db } from "../config/firebaseConfig";
import { claimNotificationOnce, DAY_MS, sendPushBatch } from "../services/notification_service";

interface UpdateStreakResult {
  previousStreak: number;
  newStreak: number;
  streakExtended: boolean;
}

export const updateUserStreak = async (
  userId: string
): Promise<UpdateStreakResult | null> => {
  try {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.warn(`User ${userId} not found, cannot update streak.`);
      return null;
    }

    const userData = userSnap.data() || {};
    const currentStreak: number = userData.streakCount || 0;
    const lastCheckIn = userData.lastCheckIn as admin.firestore.Timestamp | undefined;
    const userTimezone: string = userData.timezone || "UTC"; // Use user's timezone or fallback to UTC

    const now = new Date();
    let newStreakCount = 1;
    
    if (lastCheckIn) {
      const lastCheckInDate = lastCheckIn.toDate();
      const dayDiff = calendarDayDiff(lastCheckInDate, now, userTimezone);
    
      if (dayDiff === 0) {
        newStreakCount = currentStreak;      // Same calendar day
      } else if (dayDiff === 1) {
        newStreakCount = currentStreak + 1;  // Next calendar day
      } else {
        newStreakCount = 1;                  // Missed 2+ days
      }    
    }

    const streakExtended = newStreakCount > currentStreak;

    // ✅ Always update Firestore with the new streak + timestamp
    await userRef.update({
      streakCount: newStreakCount,
      lastCheckIn: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 🎉 Milestone push only on the lesson that reaches the milestone, not on every
    // later lesson completed the same day (route for Flutter navigation).
    if (streakExtended && userData.fcmToken && [5, 10, 20, 30].includes(newStreakCount)) {
      try {
        const today = now.toISOString().slice(0, 10);
        if (await claimNotificationOnce(`streak_milestone:${userId}:${newStreakCount}:${today}`, DAY_MS)) {
          await sendPushBatch([
            {
              userId,
              token: userData.fcmToken,
              title: `${newStreakCount}-Day Streak!`,
              body: "You're on fire! Keep it going.",
              data: { route: "/", streakCount: newStreakCount.toString() },
            },
          ]);
        }
      } catch (err) {
        console.error("Streak milestone push failed:", err);
      }
    }

    return {
      previousStreak: currentStreak,
      newStreak: newStreakCount,
      streakExtended,
    };
  } catch (error) {
    console.error("Error updating user streak:", error);
    throw error;
  }
};



function calendarDayDiff(d1: Date, d2: Date, tz: string = "UTC"): number {
  // Convert both dates into yyyy-mm-dd in the same timezone
  const d1Str = d1.toLocaleDateString("en-CA", { timeZone: tz }); // "YYYY-MM-DD"
  const d2Str = d2.toLocaleDateString("en-CA", { timeZone: tz });

  const d1Parts = d1Str.split("-").map(Number);
  const d2Parts = d2Str.split("-").map(Number);

  const start = new Date(Date.UTC(d1Parts[0], d1Parts[1] - 1, d1Parts[2]));
  const end = new Date(Date.UTC(d2Parts[0], d2Parts[1] - 1, d2Parts[2]));

  const msInADay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msInADay);
}


/**
 * Checks if the user has missed a day since lastCheckIn.
 * If missed, resets streak to 0 and updates lastCheckIn.
 */
export async function checkStreakOnLogin(userData: any): Promise<any> {
  try {
    if (!userData || !userData.id) {
      console.warn("User data is missing or incomplete; cannot check streak.");
      return null;
    }

    const userId = userData.id;
    const currentStreak = userData.streakCount || 0;
    const lastCheckIn = userData.lastCheckIn;
    const userTimezone: string = userData.timezone || "UTC"; // Use user's timezone or fallback to UTC

    if (!lastCheckIn) {
      return { ...userData, streakLost: false };
    }

    const lastCheckInDate =
      typeof lastCheckIn.toDate === "function"
        ? lastCheckIn.toDate()
        : new Date(lastCheckIn);

    const now = new Date();
    const dayDiff = calendarDayDiff(lastCheckInDate, now, userTimezone);

    if (dayDiff >= 2 && currentStreak > 0) {
      // ❌ Reset streak only if 2+ days have passed (allowing next-day grace)
      await db.collection("users").doc(userId).update({
        streakCount: 0,
        lastCheckIn: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`User ${userId}'s streak reset from ${currentStreak} → 0`);

      return {
        ...userData,
        streakCount: 0,
        streakLost: true,
      };
    }

    return { ...userData, streakLost: false };
  } catch (error) {
    console.error("🔥 Error checking user streak on login:", error);
    throw error;
  }
}
