import { db } from "../config/firebaseConfig";
import admin from "firebase-admin";

interface SavedCourseInput {
  courseId: string;
  lessonCount: number;
}

export async function createSavedCourse(userId: string, data: SavedCourseInput): Promise<string> {
  try {
    const courseRef = db.collection("courses").doc(data.courseId);
    const courseSnapshot = await courseRef.get();
    if (!courseSnapshot.exists) {
      throw new Error("Course does not exist");
    }

    const courseData = courseSnapshot.data();
    const courseTitle = courseData?.title || null;
    const courseDescription = courseData?.description || null;

    const lessonsProgress: { [lessonId: string]: { completed: boolean } } = {};
    for (let i = 1; i <= data.lessonCount; i++) {
      lessonsProgress[`lesson${i}`] = { completed: false };
    }

    const savedCourseRef = db
      .collection("users")
      .doc(userId)
      .collection("savedCourses")
      .doc(data.courseId);

    const timestamp = new Date().toISOString();

    await savedCourseRef.set({
      courseId: data.courseId,
      title: courseTitle,
      description: courseDescription,
      saved: true,
      progress: {
        overallScore: 0,
        lessons: lessonsProgress,
      },
      lastAttempt: timestamp,
      createdAt: timestamp,
    });

    // Increment courseSlotsUsed on the user document
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(userId);
      const userSnap = await transaction.get(userRef);
      const userData = userSnap.data() || {};
      const currentCount = userData.courseSlotsUsed ?? 0;

      transaction.update(userRef, {
        courseSlotsUsed: currentCount + 1,
      });
    });

    console.log(`Saved course created under user ${userId} with ID: ${savedCourseRef.id}`);
    return savedCourseRef.id;
  } catch (error) {
    console.error("Error saving course:", error);
    throw error;
  }
}

export async function createSharedSavedCourse(userId: string, courseId: string): Promise<{ id: string, lessonCount: number }> {
  try {
    const courseRef = db.collection("courses").doc(courseId);
    const courseSnapshot = await courseRef.get();
    if (!courseSnapshot.exists) {
      throw new Error("Course does not exist");
    }

    const courseData = courseSnapshot.data();
    const courseTitle = courseData?.title || null;
    const courseDescription = courseData?.description || null;

    const lessonsSnapshot = await courseRef.collection("lessons").get();
    const lessonCount = lessonsSnapshot.size;

    const lessonsProgress: { [lessonId: string]: { completed: boolean } } = {};
    for (let i = 1; i <= lessonCount; i++) {
      lessonsProgress[`lesson${i}`] = { completed: false };
    }

    const savedCourseRef = db
      .collection("users")
      .doc(userId)
      .collection("savedCourses")
      .doc(courseId);

    const timestamp = new Date().toISOString();

    await savedCourseRef.set({
      courseId: courseId,
      title: courseTitle,
      description: courseDescription,
      saved: true,
      progress: {
        overallScore: 0,
        lessons: lessonsProgress,
      },
      lastAttempt: timestamp,
      createdAt: timestamp,
    });

    // Increment courseSlotsUsed
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(userId);
      const userSnap = await transaction.get(userRef);
      const userData = userSnap.data() || {};
      const currentCount = userData.courseSlotsUsed ?? 0;

      transaction.update(userRef, {
        courseSlotsUsed: currentCount + 1,
      });
    });

    console.log(`Saved course created under user ${userId} with ID: ${savedCourseRef.id}`);
    return {
      id: savedCourseRef.id,
      lessonCount: lessonCount,
    };
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

export async function assignCourseToClass(
  classId: string,
  courseId: string,
  title: string,
  dueAt?: string
) {
  const now = new Date().toISOString();
  const classRef = db.collection("classrooms").doc(classId);

  // ensure classroom exists
  const snap = await classRef.get();
  if (!snap.exists) {
    throw new Error(`Classroom ${classId} not found`);
  }

  // add course under the class
  await classRef
    .collection("courses")
    .doc(courseId)
    .set({
      courseId,
      title,
      assignedAt: now,
      dueAt: dueAt ?? null,
    });
}