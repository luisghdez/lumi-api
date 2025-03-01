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

// export async function verifyFirebaseToken(token: string) {
//     try {
//       const decodedToken = await auth.verifyIdToken(token);
//       return {
//         uid: decodedToken.uid,
//         email: decodedToken.email,
//         name: decodedToken.name || null,
//       };
//     } catch (error) {
//       console.error("🔥 Error verifying Firebase token:", error);
//       throw new Error("Invalid Firebase token");
//     }
//   }