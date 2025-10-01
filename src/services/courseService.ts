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
  createdByName?: string;
  hasEmbeddings?: boolean;
  visibility?: string;
}

export interface CourseContent {
  lessons: Record<string, LessonData>;
  mergedFlashcards: Flashcard[];
  summary: string;
}

export interface SavedCourse {
  id: string;
  hasEmbeddings: boolean;
  totalLessons: number;
  completedLessons: number;
  savedCount: number;
  createdBy?: string;
  createdByName?: string;
  [key: string]: any;
}

export interface PaginatedCoursesResponse {
  courses: SavedCourse[];
  totalCount: number;
  hasNextPage: boolean;
}

export interface AllCourse {
  id: string;
  hasEmbeddings: boolean;
  lessonCount: number;
  savedCount: number;
  createdBy?: string;
  createdByName?: string;
  [key: string]: any;
}

export interface PaginatedAllCoursesResponse {
  courses: AllCourse[];
  totalCount: number;
  hasNextPage: boolean;
}

/**
 * Creates an empty course document in Firestore and returns its new ID.
 * Only metadata fields are written here; lessons & flashcards come later.
 */
export async function createCourseMeta(meta: CourseMeta): Promise<string> {
  try {
    // Fetch the creator's name from the users collection
    let createdByName = "Unknown User";
    try {
      const userDoc = await db.collection("users").doc(meta.createdBy).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        createdByName = userData?.name || userData?.displayName || "Unknown User";
      }
    } catch (userError) {
      console.warn(`⚠️ Could not fetch user name for ${meta.createdBy}:`, userError);
      // Continue with default value
    }

    const courseRef = db.collection("courses").doc();
    await courseRef.set({
      title:        meta.title,
      description:  meta.description,
      createdBy:    meta.createdBy,
      createdByName: createdByName,
      hasEmbeddings: meta.hasEmbeddings || false,
      visibility:   meta.visibility || "Private",
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      // leave lessons & mergedFlashcards empty for now
    });
    console.log(`📖 Reserved Course ID: ${courseRef.id} (created by: ${createdByName})`);
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
  
      const courses = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          hasEmbeddings: data.hasEmbeddings || false,
        };
      });
  
      return courses;
    } catch (error) {
      console.error("Error retrieving courses:", error);
      throw new Error("Failed to fetch courses.");
    }
  };

  export const getUsersSavedCoursesFromFirebase = async (
    userId: string, 
    page: number = 1, 
    limit: number = 10,
    subject?: string
  ): Promise<PaginatedCoursesResponse> => {
    try {
      // Build query based on whether subject filter is provided
      let totalSnapshot;
      let paginatedQuery;
      
      if (subject && subject.trim()) {
        // Query with subject filter
        totalSnapshot = await db
          .collection("users")
          .doc(userId)
          .collection("savedCourses")
          .where("subject", "==", subject.trim())
          .orderBy("lastAttempt", "desc")
          .get();
      } else {
        // Query without subject filter
        totalSnapshot = await db
          .collection("users")
          .doc(userId)
          .collection("savedCourses")
          .orderBy("lastAttempt", "desc")
          .get();
      }

      const totalCount = totalSnapshot.size;

      if (totalCount === 0) {
        console.log(subject ? `No saved courses found for subject: ${subject}` : "No saved courses found for this user.");
        return {
          courses: [],
          totalCount: 0,
          hasNextPage: false
        };
      }

      // Calculate offset
      const offset = (page - 1) * limit;

      // Get paginated results
      if (subject && subject.trim()) {
        // Paginated query with subject filter
        paginatedQuery = db
          .collection("users")
          .doc(userId)
          .collection("savedCourses")
          .where("subject", "==", subject.trim())
          .orderBy("lastAttempt", "desc")
          .offset(offset)
          .limit(limit);
      } else {
        // Paginated query without subject filter
        paginatedQuery = db
          .collection("users")
          .doc(userId)
          .collection("savedCourses")
          .orderBy("lastAttempt", "desc")
          .offset(offset)
          .limit(limit);
      }

      const snapshot = await paginatedQuery.get();
      
      // Fetch savedCount from original course documents in parallel
      const courses = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
    
          // Safely extract lessons. Adjust the path below if your Firestore structure differs.
          const lessons = data?.progress?.lessons || {};
    
          // If `lessons` is an object where each key is a lesson,
          // and each lesson has a structure like { completed: boolean }:
          const totalLessons = Object.keys(lessons).length;
          const completedLessons = Object.values(lessons).filter(
            (lesson: any) => lesson.completed
          ).length;

          // Fetch savedCount, createdBy, and createdByName from the original course document
          let savedCount = 0;
          let createdBy = undefined;
          let createdByName = undefined;
          try {
            const courseRef = db.collection("courses").doc(data.courseId || doc.id);
            const courseSnapshot = await courseRef.get();
            if (courseSnapshot.exists) {
              const courseData = courseSnapshot.data();
              savedCount = courseData?.savedCount || 0;
              createdBy = courseData?.createdBy;
              createdByName = courseData?.createdByName;
            }
          } catch (error) {
            console.error(`Error fetching course data for ${data.courseId || doc.id}:`, error);
          }
    
          return {
            id: doc.id,
            ...data,
            hasEmbeddings: data.hasEmbeddings || false,
            totalLessons,
            completedLessons,
            savedCount,
            createdBy,
            createdByName,
          };
        })
      );

      // Calculate if there are more pages
      const hasNextPage = offset + limit < totalCount;
  
      return {
        courses,
        totalCount,
        hasNextPage
      };
    } catch (error) {
      console.error("Error retrieving saved courses:", error);
      throw new Error("Failed to fetch saved courses.");
    }
  }; 

  // Featured courses: Top 20 most saved courses
  export const getFeaturedCoursesFromFirebase = async () => {
    try {
      // Query for top 20 courses ordered by savedCount (most saved first)
      // Note: Ensure you have a Firestore index on savedCount in descending order
      const snapshot = await db
        .collection("courses")
        .orderBy("savedCount", "desc")
        .limit(20)
        .get();
  
      if (snapshot.empty) {
        console.log("No featured courses found.");
        return [];
      }
  
      // Convert snapshots to a usable array with lesson count
      const coursesWithLessonCount = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          
          // Get lesson count by querying the lessons subcollection
          const lessonsSnapshot = await doc.ref.collection("lessons").get();
          const lessonCount = lessonsSnapshot.size;

          return {
            id: doc.id,
            ...data,
            hasEmbeddings: data.hasEmbeddings || false,
            lessonCount,
            savedCount: data.savedCount || 0,
          };
        })
      );

      return coursesWithLessonCount;
    } catch (error) {
      console.error("Error retrieving courses:", error);
      throw new Error("Failed to fetch courses.");
    }
  };

  // Get all courses from any users with optional subject filtering and pagination
  export const getAllCoursesFromFirebase = async (subject?: string, page: number = 1, limit: number = 10): Promise<PaginatedAllCoursesResponse> => {
    try {
      // Build query based on whether subject filter is provided
      let query;
      
      if (subject && subject.trim()) {
        // Query with subject filter
        query = db
          .collection("courses")
          .where("subject", "==", subject.trim())
          .orderBy("createdAt", "desc");
      } else {
        // Query without subject filter
        query = db
          .collection("courses")
          .orderBy("createdAt", "desc");
      }

      // Get total count for pagination metadata
      const totalSnapshot = await query.get();
      const totalCount = totalSnapshot.size;

      if (totalCount === 0) {
        console.log(subject ? `No courses found for subject: ${subject}` : "No courses found.");
        return {
          courses: [],
          totalCount: 0,
          hasNextPage: false
        };
      }

      // Calculate offset
      const offset = (page - 1) * limit;

      // Get paginated results
      const paginatedQuery = query
        .offset(offset)
        .limit(limit);

      const snapshot = await paginatedQuery.get();

      // Convert snapshots to a usable array with lesson count
      const coursesWithLessonCount = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          
          // Get lesson count by querying the lessons subcollection
          const lessonsSnapshot = await doc.ref.collection("lessons").get();
          const lessonCount = lessonsSnapshot.size;

          return {
            id: doc.id,
            ...data,
            hasEmbeddings: data.hasEmbeddings || false,
            lessonCount,
            savedCount: data.savedCount || 0,
          };
        })
      );

      // Calculate if there are more pages
      const hasNextPage = offset + limit < totalCount;

      return {
        courses: coursesWithLessonCount,
        totalCount,
        hasNextPage
      };
    } catch (error) {
      console.error("Error retrieving all courses:", error);
      throw new Error("Failed to fetch all courses.");
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
  
      // 4. Retrieve the course document to get the merged flashcards and summary.
      const courseDoc = await db.collection("courses").doc(courseId).get();
      const courseData = courseDoc.exists ? courseDoc.data() : {};
      const mergedFlashcards = courseData?.mergedFlashcards || [];
      const summary = courseData?.summary || '';
  
      return { lessons, mergedFlashcards, summary };
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

  export const updateCourseEmbeddingsStatus = async (courseId: string, hasEmbeddings: boolean) => {
    try {
      const courseRef = db.collection("courses").doc(courseId);
      await courseRef.update({
        hasEmbeddings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✅ Updated embeddings status for course ${courseId}: ${hasEmbeddings}`);
    } catch (error) {
      console.error("❌ Failed to update embeddings status:", error);
      throw new Error("Failed to update embeddings status");
    }
  };

  export const checkCourseHasEmbeddings = async (courseId: string): Promise<boolean> => {
    try {
      const courseDoc = await db.collection("courses").doc(courseId).get();
      
      if (!courseDoc.exists) {
        return false;
      }
      
      const courseData = courseDoc.data();
      return courseData?.hasEmbeddings || false;
      
    } catch (error) {
      console.error("Error checking embeddings status:", error);
      return false;
    }
  };


  
  
  
