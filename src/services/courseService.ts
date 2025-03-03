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
  
  export const getLessonsFromFirebase = async (courseId: string) => {
    try {
      const lessonsRef = db.collection("courses").doc(courseId).collection("lessons");
      const snapshot = await lessonsRef.get();
  
      if (snapshot.empty) {
        console.log(`❌ No lessons found for course: ${courseId}`);
        return [];
      }
  
      const lessons = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      return lessons;
    } catch (error) {
      console.error("Error retrieving lessons:", error);
      throw new Error("Failed to fetch lessons.");
    }
  };
  
