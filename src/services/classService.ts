import { db } from "../config/firebaseConfig";
import { nanoid } from "nanoid";

export interface ClassInput {
  name: string;
  identifier: string;
  colorCode: string;
}

  export interface ClassSummary {
    id: string;
    name: string;
    identifier: string;
    studentCount: number;
    courseCount: number;
  }

  export interface CourseBrief {
    id: string;
    title: string;
  }

  export interface StudentBrief {
    id: string;
    name: string;
  }

export async function createClass(
  ownerId: string,
  data: ClassInput
) {
  // 1) Build your new class record
  const inviteCode = nanoid(6).toUpperCase();   // e.g. "A1B2C3"
  const createdAt = new Date().toISOString();
  const classRef = db.collection("classrooms").doc();  
  const classId = classRef.id;

  // 2) Write classroom
  await classRef.set({
    id: classId,
    ownerId,
    name: data.name,
    identifier: data.identifier,
    colorCode: data.colorCode,
    inviteCode,
    createdAt,
  });

  // 3) Add teacher as first member
  await classRef
    .collection("members")
    .doc(ownerId)
    .set({
      userId: ownerId,
      role: "teacher",
      joinedAt: createdAt,
    });

  // 4) Return the new classroom payload
  return {
    id: classId,
    ownerId,
    name: data.name,
    identifier: data.identifier,
    colorCode: data.colorCode,
    inviteCode,
    createdAt,
  };
}

export async function getClassesForUser(
    ownerId: string
  ): Promise<ClassSummary[]> {
    // 1) fetch all classrooms owned by this user
    const snap = await db
      .collection("classrooms")
      .where("ownerId", "==", ownerId)
      .get();
  
    // 2) for each class, count members & courses
    const results = await Promise.all(
      snap.docs.map(async (doc) => {
        const { name, identifier } = doc.data();
  
        // count students (role === 'student')
        const studentSnap = await doc.ref
          .collection("members")
          .where("role", "==", "student")
          .get();
        const studentCount = studentSnap.size;
  
        // count assigned courses
        const courseSnap = await doc.ref
          .collection("courses")
          .get();
        const courseCount = courseSnap.size;
  
        return {
          id: doc.id,
          name,
          identifier,
          studentCount,
          courseCount,
        };
      })
    );
  
    return results;
  }

  /**
 * Returns all courses assigned to a classroom, with just id + title.
 */
export async function getCoursesForClass(
    userId: string,
    classId: string
  ): Promise<CourseBrief[]> {
    const classRef = db.collection("classrooms").doc(classId);
  
    // 1) Optional: verify user is a member (teacher or student)
    const memberDoc = await classRef.collection("members").doc(userId).get();
    if (!memberDoc.exists) {
      throw new Error("Access denied: not a class member");
    }
  
    // 2) Fetch all assigned course IDs
    const assignedSnap = await classRef.collection("courses").get();
    const courseIds = assignedSnap.docs.map((d) => d.id);
  
    // 3) Fetch each course’s metadata in parallel
    const courses = await Promise.all(
      courseIds.map(async (courseId) => {
        const courseSnap = await db.collection("courses").doc(courseId).get();
        const data = courseSnap.data() || {};
        return {
          id: courseId,
          title: data.title || "Untitled",
        };
      })
    );
  
    return courses;
  }

  export async function getStudentsForClass(
    userId: string,
    classId: string
  ): Promise<StudentBrief[]> {
    const classRef = db.collection("classrooms").doc(classId);
  
    // 1) Verify caller is teacher in this class
    const me = await classRef.collection("members").doc(userId).get();
    if (!me.exists || me.data()?.role !== "teacher") {
      throw new Error("Access denied: only teachers may list students");
    }
  
    // 2) Query all student-member docs
    const studentsSnap = await classRef
      .collection("members")
      .where("role", "==", "student")
      .get();
  
    // 3) For each, fetch the user's name
    const students = await Promise.all(
      studentsSnap.docs.map(async (memberDoc) => {
        const studentId = memberDoc.data().userId;
        const userSnap = await db.collection("users").doc(studentId).get();
        const userData = userSnap.data() || {};
        return {
          id: studentId,
          name: userData.name || userData.displayName || "Unknown",
        };
      })
    );
  
    return students;
  }