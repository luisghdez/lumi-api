import { db } from "../config/firebaseConfig";

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
      lessonsProgress[`lesson_${i}`] = { completed: false };
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
