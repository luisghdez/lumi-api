import { admin, db } from "../config/firebaseConfig";

interface UpdateStreakResult {
  previousStreak: number;
  newStreak: number;
  streakExtended: boolean; // or 'streakIncremented', however you prefer
}

export const updateUserStreak = async (userId: string): Promise<UpdateStreakResult | null> => {
  try {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.warn(`User ${userId} not found, cannot update streak.`);
      return null; // or throw, whichever you prefer
    }

    const userData = userSnap.data() || {};
    const currentStreak = userData.streakCount || 0;
    const lastCheckIn = userData.lastCheckIn as admin.firestore.Timestamp | undefined;

    // We'll default to new streak = 1 if no lastCheckIn is present
    let newStreakCount = 1;
    const now = new Date();
    
    if (lastCheckIn) {
      // If lastCheckIn is a Firestore Timestamp, convert it
      const lastCheckInDate = lastCheckIn.toDate();

      // Calculate day difference (rounded down)
      const msInADay = 24 * 60 * 60 * 1000;
      const dayDiff = Math.floor((now.getTime() - lastCheckInDate.getTime()) / msInADay);

      if (dayDiff === 0) {
        // Same day → no change to streak
        newStreakCount = currentStreak;
      } else if (dayDiff === 1) {
        // Consecutive day → increment
        newStreakCount = currentStreak + 1;
      } else {
        // Missed at least one day → reset to 1
        newStreakCount = 1;
      }
    } // else no lastCheckIn → newStreakCount = 1 as the first day

    // Decide if the streak was extended (newStreak is strictly greater than previousStreak)
    const streakExtended = newStreakCount > currentStreak;

    // Update Firestore with newStreakCount and lastCheckIn = now
    await userRef.update({
      streakCount: newStreakCount,
      lastCheckIn: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `User ${userId} streak updated: from ${currentStreak} to ${newStreakCount}`
    );

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

/**
 * Checks if the user has missed a day since lastCheckIn.
 * If missed, resets streak to 0 and returns streakLost: true.
 * Otherwise, returns streakLost: false.
 */

export async function checkStreakOnLogin(userData: any): Promise<any> {
  try {
    // Ensure userData is provided and has an ID.
    if (!userData || !userData.id) {
      console.warn("User data is missing or incomplete; cannot check streak.");
      return null;
    }

    const userId = userData.id;
    const currentStreak = userData.streakCount || 0;
    const lastCheckIn = userData.lastCheckIn; // Could be an ISO string or a Firestore Timestamp

    // If there's no lastCheckIn, there's no streak check to perform.
    if (!lastCheckIn) {
      return {
        ...userData,
        streakLost: false,
      };
    }

    // Convert lastCheckIn to a Date instance.
    // If lastCheckIn is a Firestore Timestamp, use its toDate() method; otherwise assume it's a date string.
    const lastCheckInDate =
      typeof lastCheckIn.toDate === "function"
        ? lastCheckIn.toDate()
        : new Date(lastCheckIn);

    const now = new Date();
    const msInADay = 24 * 60 * 60 * 1000;
    const dayDiff = Math.floor((now.getTime() - lastCheckInDate.getTime()) / msInADay);

    // If the user missed a day (dayDiff >= 1) and had a positive streak,
    // we reset the streak.
    if (dayDiff >= 1 && currentStreak > 0) {
      await db.collection("users").doc(userId).update({
        streakCount: 0,
      });
      console.log(`User ${userId}'s streak reset from ${currentStreak} to 0.`);

      return {
        ...userData,
        streakCount: 0,
        streakLost: true, // Indicate that a streak was lost.
      };
    }

    // Otherwise, no change is needed.
    return {
      ...userData,
      streakLost: false,
    };
  } catch (error) {
    console.error("Error checking user streak on login:", error);
    throw error;
  }
}
