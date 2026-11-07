import { db } from "../config/firebaseConfig";
import admin from "firebase-admin";

interface SavedCourseInput {
  courseId: string;
  lessonCount: number;
}

interface SavedCourseOptimizedInput {
  courseId: string;
  generationId?: string;
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

    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(savedCourseRef);
      if (existing.exists) return;
      transaction.set(savedCourseRef, savedDoc);
      transaction.update(courseRef, { savedCount: admin.firestore.FieldValue.increment(1) });
      transaction.set(db.collection("analyticsEvents").doc(), {
        type: "course_saved", userId, courseId: data.courseId,
        source: "direct", occurredAt: admin.firestore.FieldValue.serverTimestamp(),
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
    for (const lesson of lessonsSnapshot.docs) {
      lessonsProgress[lesson.id] = { completed: false };
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

    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(savedCourseRef);
      if (existing.exists) return;
      transaction.set(savedCourseRef, savedDoc);
      transaction.update(courseRef, { savedCount: admin.firestore.FieldValue.increment(1) });
      transaction.set(db.collection("analyticsEvents").doc(), {
        type: "course_saved", userId, courseId,
        source: "shared", occurredAt: admin.firestore.FieldValue.serverTimestamp(),
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

    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(savedCourseRef);
      if (existing.exists) return;
      const courseRef = db.collection("courses").doc(data.courseId);
      transaction.set(savedCourseRef, savedDoc);
      transaction.update(courseRef, { savedCount: admin.firestore.FieldValue.increment(1) });
      transaction.set(db.collection("analyticsEvents").doc(), {
        type: "course_saved", userId, courseId: data.courseId,
        source: "generated", generationId: data.generationId || null,
        occurredAt: admin.firestore.FieldValue.serverTimestamp(),
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
  xp: number,
  lessonAttemptId?: string,
  durationMs?: number,
): Promise<{ xpAwarded: number; wasPreviouslyCompleted: boolean }> => {
  try {
    // Reference the saved course document under the user's subcollection
    const savedCourseRef = db
      .collection("users")
      .doc(userId)
      .collection("savedCourses")
      .doc(courseId);

    return await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(userId);
      const [snapshot, userSnapshot] = await Promise.all([
        transaction.get(savedCourseRef), transaction.get(userRef),
      ]);
      if (!snapshot.exists) throw new Error("Saved course does not exist");
      if (!userSnapshot.exists) throw new Error("User does not exist");
      const savedCourse = snapshot.data() as any;
      const lessons = savedCourse?.progress?.lessons || {};
      if (!(lessonId in lessons)) throw new Error("Lesson does not exist in saved course");
      const wasCompleted = lessons[lessonId]?.completed === true;
      if (wasCompleted) return { xpAwarded: 0, wasPreviouslyCompleted: true };
      // Older users may have progress or events without the user-level marker.
      // Resolve that history inside the transaction before any writes. Reading
      // the user document also serializes concurrent completions across courses.
      let hasCompletedLesson = userSnapshot.get("hasCompletedLesson") === true ||
        Boolean(userSnapshot.get("firstLessonCompletedAt"));
      if (!hasCompletedLesson) {
        const [savedCourses, history] = await Promise.all([
          transaction.get(userRef.collection("savedCourses")),
          transaction.get(db.collection("analyticsEvents").where("userId", "==", userId)),
        ]);
        hasCompletedLesson = history.docs.some(event => event.get("type") === "lesson_completed") ||
          savedCourses.docs.some(course => Object.values(course.get("progress.lessons") || {})
            .some((lesson: any) => lesson?.completed === true));
      }
      const isFirstLesson = !hasCompletedLesson;
      const allLessonsCompleted = Object.entries(lessons).length > 0 && Object.entries(lessons)
        .every(([id, lesson]: [string, any]) => id === lessonId || lesson?.completed === true);
      const updates: Record<string, any> = {
        [`progress.lessons.${lessonId}.completed`]: true,
        [`progress.lessons.${lessonId}.completedAt`]: admin.firestore.FieldValue.serverTimestamp(),
        lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
      };
      transaction.set(db.collection("analyticsEvents").doc(), {
        type: "lesson_completed", userId, courseId, lessonId,
        lessonOrdinal: /^lesson\d+$/.test(lessonId) ? Number(lessonId.slice(6)) : null,
        isFirstLesson,
        courseType: savedCourse.courseType || "standard",
        lessonAttemptId: lessonAttemptId || null,
        durationMs: typeof durationMs === "number" ? durationMs : null,
        xpAwarded: xp,
        occurredAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (allLessonsCompleted && !savedCourse.completedAt) {
        updates.completedAt = admin.firestore.FieldValue.serverTimestamp();
        transaction.set(db.collection("analyticsEvents").doc(), { type: "course_completed", userId, courseId, occurredAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      transaction.update(savedCourseRef, updates);
      transaction.update(userRef, {
        xpCount: admin.firestore.FieldValue.increment(xp),
        hasCompletedLesson: true,
        ...(isFirstLesson ? {
          firstLessonCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
          firstLessonCourseId: courseId,
          firstLessonId: lessonId,
        } : {}),
      });
      return { xpAwarded: xp, wasPreviouslyCompleted: false };
    });
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
