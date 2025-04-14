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
  
          // New fields for freemium control
          isPremium: false,
          courseSlotsUsed: 0,
          maxCourseSlots: 2,
  
          // Gamification
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
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        return null;
      }
      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      console.error("Error fetching user profile from Firestore:", error);
      throw error;
    }
  }

  export async function deleteFireStoreUser(uid: string): Promise<void> {
    try {
      // Reference to the main user document
      const userDocRef = db.collection("users").doc(uid);
      const docSnap = await userDocRef.get();
  
      if (!docSnap.exists) {
        console.log(`User doc ${uid} does not exist.`);
        return; // Or throw an error if needed.
      }
  
      // -------------------------------
      // Step 1: Delete Documents in Subcollections
      // -------------------------------
  
      // Example: Delete all documents in the 'savedCourses' subcollection.
      const savedCoursesCollectionRef = userDocRef.collection("savedCourses");
      const savedCoursesSnapshot = await savedCoursesCollectionRef.get();
  
      // Use a batch to delete all documents (up to 500 at a time)
      const batch = db.batch();
      savedCoursesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
  
      // Commit the batch if there were any documents to delete.
      if (!savedCoursesSnapshot.empty) {
        await batch.commit();
        console.log(`✅ Deleted ${savedCoursesSnapshot.size} savedCourses for UID: ${uid}`);
      } else {
        console.log("ℹ️ No savedCourses to delete for UID:", uid);
      }
  
      // -------------------------------
      // Step 2: Delete the main user document
      // -------------------------------
      await userDocRef.delete();
      console.log(`✅ Deleted user doc for UID: ${uid}`);
    } catch (error) {
      console.error("🔥 Error deleting user profile and subcollections:", error);
      throw error; // Propagate the error to be handled by the controller.
    }
  }