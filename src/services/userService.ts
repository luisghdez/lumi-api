import { db } from "../config/firebaseConfig";
import { checkStreakOnLogin } from "./streakService";

interface UserData {
  uid: string;
  email: string;
  name: string;
  profilePicture: string;
}

interface UserProfileData {
    email?: string;
    name?: string;
    profilePicture?: string;
  }

export async function createFireStoreUser(uid: string, data: UserProfileData) {
    try {
      const userRef = db.collection("users").doc(uid);
      const docSnap = await userRef.get();
      
      if (!docSnap.exists) {
        // Create a new doc for this user if it doesn't exist
        await userRef.set({
          email: data.email || "",
          name: data.name || "",
          emailLower: data.email?.toLowerCase() || "",
          nameLower: data.name?.toLowerCase() || "",
          profilePicture: data.profilePicture || "default",
          xpCount: 0,
          streakCount: 0,
          createdAt: new Date().toISOString(),
        });
        console.log(`✅ Created user doc for UID: ${uid}`);
      } else {
        console.log(`ℹ️ User doc for UID: ${uid} already exists. No action taken.`);
        // (Optional) You could update any missing fields if needed
      }
    } catch (error) {
      console.error("🔥 Error in ensureUserExists:", error);
      throw error;
    }
  }

  export async function getUserProfile(userId: string): Promise<any> {
    try {
      // Step 1: Check if user missed a day -> possibly reset streak
      const possiblyUpdatedUserData = await checkStreakOnLogin(userId);
  
      // Step 2: If user doc not found, return null
      if (!possiblyUpdatedUserData) {
        return null;
      }
  
      // Step 3: Return the (possibly updated) user data
      return possiblyUpdatedUserData;
    } catch (error) {
      console.error("Error fetching user profile from Firestore:", error);
      throw error;
    }
  }