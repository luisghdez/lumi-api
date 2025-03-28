import { db } from "../config/firebaseConfig";
import admin from "firebase-admin";

interface SavedCourseInput {
  courseId: string;
  lessonCount: number;
}

export async function createSavedCourse(userId: string, data: SavedCourseInput): Promise<string> {
  try {
    // Validate that the course exists
    const courseRef = db.collection("courses").doc(data.courseId);
    const courseSnapshot = await courseRef.get();
    if (!courseSnapshot.exists) {
      throw new Error("Course does not exist");
    }

    const courseData = courseSnapshot.data();
    const courseTitle = courseData?.title || null;
    const courseDescription = courseData?.description || null;
    
    // Build the lessons progress object with empty progress (completed: false)
    const lessonsProgress: { [lessonId: string]: { completed: boolean } } = {};
    for (let i = 1; i <= data.lessonCount; i++) {
      lessonsProgress[`lesson${i}`] = { completed: false };
    }

    const savedCourseId = data.courseId; // Matching ID for saved course and course
    
    // Use the user's document subcollection "savedCourses" to store the saved course
    const savedCourseRef = db
      .collection("users")
      .doc(userId)
      .collection("savedCourses")
      .doc(savedCourseId);
    
    const timestamp = new Date().toISOString();
    
    await savedCourseRef.set({
      courseId: data.courseId,
      title: courseTitle,
      description: courseDescription,
      saved: true, // Indicates that the user has saved this course
      progress: {
        overallScore: 0, // Default overall score; update later if needed
        lessons: lessonsProgress,
      },
      lastAttempt: timestamp,
      createdAt: timestamp,
    });
    
    console.log(`Saved course created under user ${userId} with ID: ${savedCourseRef.id}`);
    return savedCourseRef.id;
  } catch (error) {
    console.error("Error saving course:", error);
    throw error;
  }
}

export const markLessonAsCompleted = async (
  userId: string,
  courseId: string,
  lessonId: string,
  xp: number
): Promise<void> => {
  try {
    // Reference the saved course document under the user's subcollection
    const savedCourseRef = db
      .collection("users")
      .doc(userId)
      .collection("savedCourses")
      .doc(courseId);

    console.log(`Marking lesson ${savedCourseRef}`);

    // Update the specific lesson's completed flag to true.
    // Also update lastAttempt to record the timestamp of this update.
    await savedCourseRef.update({
      [`progress.lessons.${lessonId}.completed`]: true,
      lastAttempt: new Date().toISOString(),
    });

    // Now update the user's document by incrementing the xpCount field.
    // Make sure that your Firebase admin SDK is initialized and supports FieldValue.increment.
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      xpCount: admin.firestore.FieldValue.increment(xp),
    });

    console.log(`Lesson ${lessonId} in course ${courseId} marked as completed for user ${userId}. Added ${xp} XP.`);
  } catch (error) {
    console.error("Error updating lesson progress and user XP:", error);
    throw new Error("Failed to mark lesson as completed and update XP.");
  }
};