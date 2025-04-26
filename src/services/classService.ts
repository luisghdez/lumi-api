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