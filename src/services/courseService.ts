import { admin, db } from "../config/firebaseConfig";

export interface LessonData {
  [key: string]: any;
}

export interface Flashcard {
  term: string;
  definition: string;
}

export interface CourseMeta {
  title: string;
  description: string;
  createdBy: string;
}

export interface CourseContent {
  lessons: Record<string, LessonData>;
  mergedFlashcards: Flashcard[];
  summary: string;
}

/**
 * Creates an empty course document in Firestore and returns its new ID.
 * Only metadata fields are written here; lessons & flashcards come later.
 */
export async function createCourseMeta(meta: CourseMeta): Promise<string> {
  try {
    const courseRef = db.collection("courses").doc();
    await courseRef.set({
      title:        meta.title,
      description:  meta.description,
      createdBy:    meta.createdBy,
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      // leave lessons & mergedFlashcards empty for now
    });
    console.log(`📖 Reserved Course ID: ${courseRef.id}`);
    return courseRef.id;
  } catch (error) {
    console.error("❌ createCourseMeta failed:", error);
    throw new Error("Failed to create course metadata");
  }
}

/**
 * Populates the already-reserved course with lessons & flashcards.
 * Uses a batch write to ensure atomicity of sub-collection writes.
 */
export async function updateCourseContent(
  courseId: string,
  content: CourseContent
): Promise<void> {
  try {
    const courseRef  = db.collection("courses").doc(courseId);
    const lessonsRef = courseRef.collection("lessons");
    const batch      = db.batch();

    // 1️⃣ write mergedFlashcards array on the root document
    batch.update(courseRef, {
      mergedFlashcards: content.mergedFlashcards,
      updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
      summary:          content.summary,
    });

    // 2️⃣ write each lesson into the sub-collection
    for (const [lessonId, lessonData] of Object.entries(content.lessons)) {
      const lessonDoc = lessonsRef.doc(lessonId);
      batch.set(lessonDoc, lessonData);
    }

    await batch.commit();
    console.log(`✅ Course ${courseId} content updated (lessons + flashcards).`);
  } catch (error) {
    console.error("❌ updateCourseContent failed:", error);
    throw new Error("Failed to update course content");
  }
}

export const getUserCoursesFromFirebase = async (userId: string) => {
    try {
      const coursesRef = db.collection("courses").where("createdBy", "==", userId);
      const snapshot = await coursesRef.get();
  
      if (snapshot.empty) {
        console.log("No courses found for this user.");
        return [];
      }
  
      const courses = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      return courses;
    } catch (error) {
      console.error("Error retrieving courses:", error);
      throw new Error("Failed to fetch courses.");
    }
  };

  export const getUsersSavedCoursesFromFirebase = async (userId: string) => {
    try {
      const savedCoursesRef = db
        .collection("users")
        .doc(userId)
        .collection("savedCourses")
        .orderBy("lastAttempt", "desc");
  
      const snapshot = await savedCoursesRef.get();
  
      if (snapshot.empty) {
        console.log("No saved courses found for this user.");
        return [];
      }
  
      const courses = snapshot.docs.map((doc) => {
        const data = doc.data();
  
        // Safely extract lessons. Adjust the path below if your Firestore structure differs.
        const lessons = data?.progress?.lessons || {};
  
        // If `lessons` is an object where each key is a lesson,
        // and each lesson has a structure like { completed: boolean }:
        const totalLessons = Object.keys(lessons).length;
        const completedLessons = Object.values(lessons).filter(
          (lesson: any) => lesson.completed
        ).length;
  
        return {
          id: doc.id,
          ...data,
          totalLessons,
          completedLessons,
        };
      });
  
      return courses;
    } catch (error) {
      console.error("Error retrieving saved courses:", error);
      throw new Error("Failed to fetch saved courses.");
    }
  }; 

  // fixed featured courses for now
  export const getFeaturedCoursesFromFirebase = async () => {
    try {
      // Query for courses CREATED BY a specific user, ordered by creation date descending and limited to 8.
      const snapshot = await db
        .collection("courses")
        .where("createdBy", "==", "QE4WkIOW1gXzN0gGPZFvOX65Cpr2")
        .orderBy("createdAt", "asc")   // ensure you have an index on createdAt
        .limit(8)
        .get();
  
      if (snapshot.empty) {
        console.log("No courses found for that creator.");
        return [];
      }
  
      // Convert snapshots to a usable array
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error retrieving courses:", error);
      throw new Error("Failed to fetch courses.");
    }
  };
  
  export async function getCourseTitleById(courseId: string): Promise<string | null> {
    try {
      const courseDoc = await db.collection("courses").doc(courseId).get();
      if (!courseDoc.exists) {
        return null;
      }
      const data = courseDoc.data();
      return (data && (data as any).title) || null;
    } catch (error) {
      console.error("Error retrieving course title:", error);
      throw new Error("Failed to fetch course title.");
    }
  }


  export const getLessonsWithProgressFromFirebase = async (
    userId: string,
    courseId: string
  ) => {
    try {
      // 1. Retrieve the lessons from the original course
      const lessonsRef = db
        .collection("courses")
        .doc(courseId)
        .collection("lessons")
        .orderBy("lessonNumber", "asc");
      const lessonsSnapshot = await lessonsRef.get();
  
      // 2. Retrieve the saved course document from the user's subcollection
      const savedCourseRef = db
        .collection("users")
        .doc(userId)
        .collection("savedCourses")
        .doc(courseId);

        await savedCourseRef.set(
          {
            lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        
      const savedCourseSnapshot = await savedCourseRef.get();
  
      // Get the progress object (if exists) or default to an empty object.
      const progress = savedCourseSnapshot.exists
        ? savedCourseSnapshot.data()?.progress?.lessons || {}
        : {};
  
      if (lessonsSnapshot.empty) {
        console.log(`No lessons found for course: ${courseId}`);
        return { lessons: [], mergedFlashcards: [] };
      }
  
      // 3. Map over each lesson and merge the completed status from saved progress.
      const lessons = lessonsSnapshot.docs.map((doc) => {
        const lessonData = doc.data();
        const lessonProgress = progress[doc.id];
        return {
          id: doc.id,
          ...lessonData,
          completed: lessonProgress ? lessonProgress.completed : false,
        };
      });
  
      // 4. Retrieve the course document to get the merged flashcards.
      const courseDoc = await db.collection("courses").doc(courseId).get();
      const mergedFlashcards = courseDoc.exists
        ? courseDoc.data()?.mergedFlashcards || []
        : [];
  
      return { lessons, mergedFlashcards };
    } catch (error) {
      console.error("Error retrieving lessons with progress:", error);
      throw new Error("Failed to fetch lessons with progress.");
    }
  };

  export const getCourseUploadedFiles = async (courseId: string) => {
    try {
      const courseDoc = await db.collection("courses").doc(courseId).get();
      
      if (!courseDoc.exists) {
        throw new Error("Course not found");
      }
      
      const courseData = courseDoc.data();
      return courseData?.uploadedFiles || [];
      
    } catch (error) {
      console.error("Error retrieving uploaded files:", error);
      throw new Error("Failed to fetch uploaded files.");
    }
  };
  
  
  
