import { admin, db } from "../config/firebaseConfig";
import { sendPushToUser } from "../services/notification_service";

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

    const now = new Date();
    let newStreakCount = 1;

    if (lastCheckIn) {
      const lastCheckInDate = lastCheckIn.toDate();
      const msInADay = 24 * 60 * 60 * 1000;
      const dayDiff = Math.floor(
        (now.getTime() - lastCheckInDate.getTime()) / msInADay
      );

      if (dayDiff === 0) {
        newStreakCount = currentStreak; // Same day
      } else if (dayDiff === 1) {
        newStreakCount = currentStreak + 1; // Consecutive day
      } else {
        newStreakCount = 1; // Missed days
      }
    }

    const streakExtended = newStreakCount > currentStreak;

    // 🎉 Send milestone push (with route for Flutter navigation)
    if ([5, 10, 20, 30].includes(newStreakCount)) {
      const title = `🔥 ${newStreakCount}-Day Streak!`;
      const body = "You're on fire! Keep it going.";
      await sendPushToUser(userId, title, body, {
        route: "/",
        streakCount: newStreakCount.toString(),
      });
    }

    // ✅ Always update Firestore with the new streak + timestamp
    await userRef.update({
      streakCount: newStreakCount,
      lastCheckIn: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `✅ User ${userId} streak updated: ${currentStreak} → ${newStreakCount}`
    );

    return {
      previousStreak: currentStreak,
      newStreak: newStreakCount,
      streakExtended,
    };
  } catch (error) {
    console.error("🔥 Error updating user streak:", error);
    throw error;
  }
};

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

    if (!lastCheckIn) {
      return { ...userData, streakLost: false };
    }

    const lastCheckInDate =
      typeof lastCheckIn.toDate === "function"
        ? lastCheckIn.toDate()
        : new Date(lastCheckIn);

    const now = new Date();
    const msInADay = 24 * 60 * 60 * 1000;
    const dayDiff = Math.floor(
      (now.getTime() - lastCheckInDate.getTime()) / msInADay
    );

    if (dayDiff >= 1 && currentStreak > 0) {
      // ❌ Reset streak and update lastCheckIn
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
