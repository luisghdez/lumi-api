import { db } from "../config/firebaseConfig";

interface CourseData {
  title: string;
  description: string;
  createdBy: string;
  lessons: { [key: string]: any };
}

// 🔹 Save Course in Firestore
export async function saveCourseToFirebase(courseData: CourseData): Promise<string> {
  try {
    const courseRef = db.collection("courses").doc(); // Generate a new course ID
    await courseRef.set({
      title: courseData.title,
      description: courseData.description,
      createdAt: new Date().toISOString(),
      createdBy: courseData.createdBy, // Store the creator
    });

    const lessonsRef = courseRef.collection("lessons");

    for (const [lessonKey, lessonData] of Object.entries(courseData.lessons)) {
      await lessonsRef.doc(lessonKey).set(lessonData);
    }

    console.log(`✅ Course saved with ID: ${courseRef.id}`);
    return courseRef.id;
  } catch (error) {
    console.error("🔥 Error saving course to Firebase:", error);
    throw new Error("Failed to save course");
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
      // Reference the "savedCourses" subcollection under the user's document
      const savedCoursesRef = db.collection("users").doc(userId).collection("savedCourses");
      const snapshot = await savedCoursesRef.get();
  
      if (snapshot.empty) {
        console.log("No saved courses found for this user.");
        return [];
      }
  
      const courses = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      return courses;
    } catch (error) {
      console.error("Error retrieving saved courses:", error);
      throw new Error("Failed to fetch saved courses.");
    }
  };

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
      const savedCourseSnapshot = await savedCourseRef.get();
  
      // Get the progress object (if exists) or default to an empty object.
      const progress = savedCourseSnapshot.exists
        ? savedCourseSnapshot.data()?.progress?.lessons || {}
        : {};
  
      if (lessonsSnapshot.empty) {
        console.log(`No lessons found for course: ${courseId}`);
        return [];
      }
  
      // 3. Map over each lesson and merge the completed status from saved progress.
      const lessons = lessonsSnapshot.docs.map((doc) => {
        const lessonData = doc.data();
        // Assume the lesson's document ID is used as key in the progress object.
        const lessonProgress = progress[doc.id];
        return {
          id: doc.id,
          ...lessonData,
          completed: lessonProgress ? lessonProgress.completed : false,
        };
      });

      console.log('Lessons:', lessons);
  
      return lessons;
    } catch (error) {
      console.error("Error retrieving lessons with progress:", error);
      throw new Error("Failed to fetch lessons with progress.");
    }
  };
  
  
