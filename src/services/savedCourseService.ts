import { db } from "../config/firebaseConfig";
import admin from "firebase-admin";

interface SavedCourseInput {
  courseId: string;
  lessonCount: number;
}

interface SavedCourseOptimizedInput {
  courseId: string;
  lessonCount: number;
  title: string;
  description: string;
  subject: string;
  hasEmbeddings: boolean;
  tags?: string[];
  // AP catalog fields — only populated when courseType === "ap_catalog"
  courseType?: "standard" | "ap_catalog";
  apSubject?: string;
}

export async function createSavedCourse(userId: string, data: SavedCourseInput): Promise<{ id: string, hasEmbeddings: boolean, subject: string }> {
  try {
    const courseRef = db.collection("courses").doc(data.courseId);
    const courseSnapshot = await courseRef.get();
    if (!courseSnapshot.exists) {
      throw new Error("Course does not exist");
    }

    const courseData = courseSnapshot.data();
    const courseTitle = courseData?.title || null;
    const courseDescription = courseData?.description || null;
    const hasEmbeddings = courseData?.hasEmbeddings || false;
    const subject = courseData?.subject || null;
    const courseType = courseData?.courseType || "standard";

    const lessonsProgress: { [lessonId: string]: { completed: boolean } } = {};
    for (let i = 1; i <= data.lessonCount; i++) {
      lessonsProgress[`lesson${i}`] = { completed: false };
    }

    const savedCourseRef = db
      .collection("users")
      .doc(userId)
      .collection("savedCourses")
      .doc(data.courseId);

    const savedDoc: Record<string, unknown> = {
      courseId: data.courseId,
      title: courseTitle,
      description: courseDescription,
      hasEmbeddings,
      saved: true,
      subject: subject,
      courseType,
      tags: courseData?.tags ?? [],
      progress: {
        overallScore: 0,
        lessons: lessonsProgress,
      },
      lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (courseType === "ap_catalog") {
      if (courseData?.apSubject !== undefined) savedDoc.apSubject = courseData.apSubject;
    }

    await savedCourseRef.set(savedDoc);

    // Increment savedCount on the course document (do NOT increment courseSlotsUsed - that's only for original courses)
    await db.runTransaction(async (transaction) => {
      const courseRef = db.collection("courses").doc(data.courseId);
      transaction.update(courseRef, {
        savedCount: admin.firestore.FieldValue.increment(1),
      });
    });

    console.log(`Saved course created under user ${userId} with ID: ${savedCourseRef.id}`);
    return {
      id: savedCourseRef.id,
      hasEmbeddings: hasEmbeddings,
      subject: subject || "Other",
    };
  } catch (error) {
    console.error("Error saving course:", error);
    throw error;
  }
}

export async function createSharedSavedCourse(userId: string, courseId: string): Promise<{ id: string, lessonCount: number, hasEmbeddings: boolean, subject: string }> {
  try {
    const courseRef = db.collection("courses").doc(courseId);
    const courseSnapshot = await courseRef.get();
    if (!courseSnapshot.exists) {
      throw new Error("Course does not exist");
    }

    const courseData = courseSnapshot.data();
    const courseTitle = courseData?.title || null;
    const courseDescription = courseData?.description || null;
    const hasEmbeddings = courseData?.hasEmbeddings || false;
    const subject = courseData?.subject || null;
    const courseType = courseData?.courseType || "standard";

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

    const savedDoc: Record<string, unknown> = {
      courseId: courseId,
      title: courseTitle,
      description: courseDescription,
      hasEmbeddings,
      saved: true,
      subject: subject,
      courseType,
      progress: {
        overallScore: 0,
        lessons: lessonsProgress,
      },
      lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (courseType === "ap_catalog") {
      if (courseData?.apSubject !== undefined) savedDoc.apSubject = courseData.apSubject;
    }

    await savedCourseRef.set(savedDoc);

    // Increment savedCount on the course document (do NOT increment courseSlotsUsed - that's only for original courses)
    await db.runTransaction(async (transaction) => {
      const courseRef = db.collection("courses").doc(courseId);
      transaction.update(courseRef, {
        savedCount: admin.firestore.FieldValue.increment(1),
      });
    });

    console.log(`Saved course created under user ${userId} with ID: ${savedCourseRef.id}`);
    return {
      id: savedCourseRef.id,
      lessonCount: lessonCount,
      hasEmbeddings: hasEmbeddings,
      subject: subject || "Other",
    };
  } catch (error) {
    console.error("Error saving course:", error);
    throw error;
  }
}

/**
 * 🚀 LEVEL 1 OPTIMIZATION: Create saved course without redundant database reads
 * Uses data already available in memory instead of fetching from database
 */
export async function createSavedCourseOptimized(userId: string, data: SavedCourseOptimizedInput): Promise<{ id: string, hasEmbeddings: boolean, subject: string }> {
  try {
    console.log(`🚀 Creating OPTIMIZED saved course for user ${userId} without DB reads`);
    
    const lessonsProgress: { [lessonId: string]: { completed: boolean } } = {};
    for (let i = 1; i <= data.lessonCount; i++) {
      lessonsProgress[`lesson${i}`] = { completed: false };
    }

    const savedCourseRef = db
      .collection("users")
      .doc(userId)
      .collection("savedCourses")
      .doc(data.courseId);

    const savedDoc: Record<string, unknown> = {
      courseId: data.courseId,
      title: data.title,
      description: data.description,
      hasEmbeddings: data.hasEmbeddings,
      saved: true,
      subject: data.subject,
      courseType: data.courseType || "standard",
      tags: data.tags ?? [],
      progress: {
        overallScore: 0,
        lessons: lessonsProgress,
      },
      lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (data.courseType === "ap_catalog") {
      if (data.apSubject !== undefined) savedDoc.apSubject = data.apSubject;
    }

    // Create saved course document with provided data (no DB read required)
    await savedCourseRef.set(savedDoc);

    // Increment savedCount on the course document (do NOT increment courseSlotsUsed - that's only for original courses)
    await db.runTransaction(async (transaction) => {
      // Increment savedCount on the course document
      const courseRef = db.collection("courses").doc(data.courseId);
      transaction.update(courseRef, {
        savedCount: admin.firestore.FieldValue.increment(1),
      });
    });

    console.log(`✅ OPTIMIZED saved course created under user ${userId} with ID: ${savedCourseRef.id}`);
    return {
      id: savedCourseRef.id,
      hasEmbeddings: data.hasEmbeddings,
      subject: data.subject || "Other",
    };
  } catch (error) {
    console.error("Error creating optimized saved course:", error);
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

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(savedCourseRef);
      if (!snapshot.exists) throw new Error("Saved course does not exist");
      const savedCourse = snapshot.data() as any;
      const lessons = savedCourse?.progress?.lessons || {};
      const wasCompleted = lessons[lessonId]?.completed === true;
      const allLessonsCompleted = Object.entries(lessons).length > 0 && Object.entries(lessons)
        .every(([id, lesson]: [string, any]) => id === lessonId || lesson?.completed === true);
      const updates: Record<string, any> = {
        [`progress.lessons.${lessonId}.completed`]: true,
        lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (!wasCompleted) {
        transaction.set(db.collection("analyticsEvents").doc(), { type: "lesson_completed", userId, courseId, occurredAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      if (!wasCompleted && allLessonsCompleted && !savedCourse.completedAt) {
        updates.completedAt = admin.firestore.FieldValue.serverTimestamp();
        transaction.set(db.collection("analyticsEvents").doc(), { type: "course_completed", userId, courseId, occurredAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      transaction.update(savedCourseRef, updates);
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

export async function deleteSavedCourse(userId: string, courseId: string): Promise<void> {
  try {
    const savedCourseRef = db
      .collection("users")
      .doc(userId)
      .collection("savedCourses")
      .doc(courseId);

    // Check if the saved course exists
    const savedCourseSnapshot = await savedCourseRef.get();
    if (!savedCourseSnapshot.exists) {
      throw new Error("Saved course does not exist");
    }

    // Delete the saved course document and update counters in a transaction
    await db.runTransaction(async (transaction) => {
      // Delete the saved course document
      transaction.delete(savedCourseRef);
    });

    console.log(`Saved course ${courseId} deleted for user ${userId}`);
  } catch (error) {
    console.error("Error deleting saved course:", error);
    throw error;
  }
}

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
