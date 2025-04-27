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

  export interface StudentClassSummary {
    id: string;
    name: string;
    identifier: string;
    studentCount: number;
    courseCount: number;
    totalCourses: number;
    completedCourses: number;
    // optional detailed progress per course:
    // courses?: CourseProgress[];
  }

  export interface ClassCourseProgress {
    lessons: { [lessonId: string]: { completed: boolean } };
  }
  export interface ClassCourseRecord {
    classId: string;
    courseId: string;
    assignedAt: string;
    dueAt: string | null;
    progress: ClassCourseProgress;
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

  /**
 * Returns all classes for which `userId` is a member (student or teacher),
 * plus the student’s completion stats in each.
 */
export async function getStudentClassesForUser(
    userId: string
  ): Promise<StudentClassSummary[]> {
    // 1) Find all classes where the user is listed in members
    const membershipSnaps = await db
      .collectionGroup("members")
      .where("__name__", "==", userId)
      .get();
  
    // membershipSnaps.docs[i].ref.parent.parent is the classRef
    const classRefs = membershipSnaps.docs.map((m) => m.ref.parent.parent!);
  
    const results = await Promise.all(
      classRefs.map(async (classRef) => {
        const classId = classRef.id;
        const { name, identifier } = (await classRef.get()).data()!;
  
        // 2) Count students
        const studentsSnap = await classRef
          .collection("members")
          .where("role", "==", "student")
          .get();
        const studentCount = studentsSnap.size;
  
        // 3) Count assigned courses
        const assignedSnap = await classRef.collection("courses").get();
        const courseCount = assignedSnap.size;
  
        // 4) Compute this user’s progress:
        //    look up savedCourses/userId/{courseId} for each assigned course
        let completedCourses = 0;
        for (const courseDoc of assignedSnap.docs) {
          const courseId = courseDoc.id;
          const savedSnap = await db
            .collection("users")
            .doc(userId)
            .collection("savedCourses")
            .doc(courseId)
            .get();
  
          if (savedSnap.exists) {
            const prog = savedSnap.data()!.progress;
            // assume overallScore field (0–100)
            if (prog?.overallScore >= 100) {
              completedCourses++;
            }
          }
        }
  
        return {
          id: classId,
          name,
          identifier,
          studentCount,
          courseCount,
          totalCourses: courseCount,
          completedCourses,
          // Optionally: build CourseProgress[] here if you need per-lesson data
        };
      })
    );
  
    return results;
  }

/**
 * Fetches—or if missing, creates—a classCourse record for a user.
 */
export async function getOrCreateClassCourse(
    userId: string,
    classId: string,
    courseId: string
  ): Promise<ClassCourseRecord> {
    const userCourseRef = db
      .collection("users")
      .doc(userId)
      .collection("classCourses")
      .doc(`${classId}_${courseId}`);
  
    const existing = await userCourseRef.get();
    if (existing.exists) {
      return existing.data() as ClassCourseRecord;
    }
  
    // 1) Fetch class assignment metadata
    const assignRef = db
      .collection("classrooms")
      .doc(classId)
      .collection("courses")
      .doc(courseId);
    const assignSnap = await assignRef.get();
    if (!assignSnap.exists) {
      throw new Error("Course not assigned to this classroom");
    }
    const { assignedAt, dueAt = null } = assignSnap.data()!;
  
    // 2) Fetch all lesson IDs from the master course
    const lessonSnap = await db
      .collection("courses")
      .doc(courseId)
      .collection("lessons")
      .get();
    const lessons: ClassCourseProgress["lessons"] = {};
    lessonSnap.docs.forEach((doc) => {
      lessons[doc.id] = { completed: false };
    });
  
    // 3) Seed the user’s classCourses entry
    const record: ClassCourseRecord = {
      classId,
      courseId,
      assignedAt,
      dueAt,
      progress: { lessons },
    };
    await userCourseRef.set(record);
  
    return record;
  }

  /**
 * Adds the user as a 'student' to the classroom matching inviteCode.
 * Seeds any existing class->course assignments into users/{userId}/classCourses.
 * Returns summary info for front‐end display.
 */
export async function joinClass(
    userId: string,
    inviteCode: string
  ): Promise<ClassSummary> {
    // 1) Find the class by code
    const snap = await db
      .collection("classrooms")
      .where("inviteCode", "==", inviteCode)
      .limit(1)
      .get();
  
    if (snap.empty) {
      throw new Error("Classroom not found");
    }
    const classDoc = snap.docs[0];
    const classRef = classDoc.ref;
    const { name, identifier } = classDoc.data();
  
    // 2) Create membership record
    const joinedAt = new Date().toISOString();
    await classRef
      .collection("members")
      .doc(userId)
      .set({
        userId,
        role: "student",
        joinedAt,
      });
  
    // 3) Seed classCourses entries for all assigned courses
    const assignedSnap = await classRef.collection("courses").get();
    for (const assDoc of assignedSnap.docs) {
      const { assignedAt, dueAt = null } = assDoc.data();
      // fetch lessons for initial progress
      const lessonSnap = await db
        .collection("courses")
        .doc(assDoc.id)
        .collection("lessons")
        .get();
  
      const lessons: { [key: string]: { completed: boolean } } = {};
      lessonSnap.docs.forEach((l) => {
        lessons[l.id] = { completed: false };
      });
  
      const userClassCourseRef = db
        .collection("users")
        .doc(userId)
        .collection("classCourses")
        .doc(`${classDoc.id}_${assDoc.id}`);
  
      const exists = await userClassCourseRef.get();
      if (!exists.exists) {
        await userClassCourseRef.set({
          classId: classDoc.id,
          courseId: assDoc.id,
          assignedAt,
          dueAt,
          progress: { lessons },
        });
      }
    }
  
    // 4) Compute counts to send back
    const studentCount = (
      await classRef
        .collection("members")
        .where("role", "==", "student")
        .get()
    ).size;
    const courseCount = assignedSnap.size;
  
    return {
      id: classDoc.id,
      name,
      identifier,
      studentCount,
      courseCount,
    };
  }

  export interface UpcomingAssignment {
    classId:     string;
    className:   string;
    courseId:    string;
    courseTitle: string;
    dueAt:       string;    // ISO string
  }

  /**
 * Returns all class-course assignments for the user with a due date ≥ now,
 * ordered by ascending dueAt.
 */
export async function getUpcomingAssignments(
    userId: string
  ): Promise<UpcomingAssignment[]> {
    const now = new Date().toISOString();
  
    // 1) Query only those classCourses with a dueAt in the future
    const snap = await db
      .collection("users")
      .doc(userId)
      .collection("classCourses")
      .where("dueAt", ">", now)
      .orderBy("dueAt", "asc")
      .get();
  
    // 2) For each, fetch class name + course title
    const assignments = await Promise.all(
      snap.docs.map(async (doc) => {
        const {
          classId,
          courseId,
          dueAt,
        } = doc.data() as {
          classId: string;
          courseId: string;
          dueAt:   string;
        };
  
        // fetch class name
        const classSnap = await db
          .collection("classrooms")
          .doc(classId)
          .get();
        const className = classSnap.data()?.name || "Unknown Class";
  
        // fetch course title
        const courseSnap = await db
          .collection("courses")
          .doc(courseId)
          .get();
        const courseTitle = courseSnap.data()?.title || "Untitled Course";
  
        return {
          classId,
          className,
          courseId,
          courseTitle,
          dueAt,
        };
      })
    );
  
    return assignments;
  }
  
  /**
 * Marks a lesson complete in the user’s `classCourses` record.
 */

  export async function markClassLessonCompleted(
    userId: string,
    classId: string,
    courseId: string,
    lessonId: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const userCourseRef = db
      .collection("users")
      .doc(userId)
      .collection("classCourses")
      .doc(`${classId}_${courseId}`);
  
    // 1) Ensure the record exists
    const snap = await userCourseRef.get();
    if (!snap.exists) {
      throw new Error("Class-course record not found");
    }
  
    // 2) Mark lesson complete
    await userCourseRef.update({
      [`progress.lessons.${lessonId}.completed`]: true,
      lastAttempt: now,
    });
  
    // 3) Log a submission into the classroom’s submissions feed
    const submissionRef = db
      .collection("classrooms")
      .doc(classId)
      .collection("submissions")
      .doc(); // auto‐ID
  
    await submissionRef.set({
      userId,
      courseId,
      lessonId,
      completedAt: now,
    });
  }

  export interface SubmissionRecord {
    classId:     string;
    userId:      string;
    courseId:    string;
    lessonId:    string;
    completedAt: string;
  }

  /**
 * Returns every submission (lesson-complete event) across all classrooms
 * owned by the given teacher, sorted by most recent.
 */
export async function getAllClassSubmissions(
    ownerId: string
  ): Promise<SubmissionRecord[]> {
    // 1) Fetch all classes this user owns
    const classSnap = await db
      .collection("classrooms")
      .where("ownerId", "==", ownerId)
      .get();
  
    const submissions: SubmissionRecord[] = [];
  
    // 2) For each class, pull its submissions
    for (const classDoc of classSnap.docs) {
      const classId = classDoc.id;
      const subsSnap = await classDoc.ref
        .collection("submissions")
        .orderBy("completedAt", "desc")
        .get();
  
      subsSnap.docs.forEach((doc) => {
        const data = doc.data();
        submissions.push({
          classId,
          userId:      data.userId,
          courseId:    data.courseId,
          lessonId:    data.lessonId,
          completedAt: data.completedAt,
        });
      });
    }
  
    // 3) Already sorted per-class; if you need a global sort:
    submissions.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
  
    return submissions;
  }