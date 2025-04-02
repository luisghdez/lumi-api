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
export async function checkStreakOnLogin(userId: string) {
  try {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.warn(`User ${userId} not found, cannot reset streak.`);
      return null;
    }

    const userData = userSnap.data() || {};
    const currentStreak = userData.streakCount || 0;
    const lastCheckIn = userData.lastCheckIn; // Could be an ISO string or Timestamp

    if (!lastCheckIn) {
      // No lastCheckIn, so no streak to lose
      return {
        id: userId,
        ...userData,
        streakLost: false,
      };
    }

    //storing as Firestore Timestamp:
    const lastCheckInDate = (lastCheckIn as admin.firestore.Timestamp).toDate();
    const now = new Date();
    const msInADay = 24 * 60 * 60 * 1000;
    const dayDiff = Math.floor((now.getTime() - lastCheckInDate.getTime()) / msInADay);

    // If user hasn't done anything today (dayDiff >= 1) and they had a streak
    if (dayDiff >= 1 && currentStreak > 0) {
      // Reset the streak
      await userRef.update({
        streakCount: 0,
      });
      console.log(`User ${userId}'s streak reset from ${currentStreak} to 0.`);

      return {
        id: userId,
        ...userData,
        streakCount: 0,
        streakLost: true, // <-- indicate streak was lost
      };
    }

    // Otherwise, no change to the streak
    return {
      id: userId,
      ...userData,
      streakLost: false, // <-- no streak lost
    };
  } catch (error) {
    console.error("Error checking user streak on login:", error);
    throw error;
  }
}