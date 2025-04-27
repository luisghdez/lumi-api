import { db } from "../config/firebaseConfig";
import { nanoid } from "nanoid";

export interface ClassInput {
  name: string;
  identifier: string;
  colorCode: string;
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

export interface ClassSummary {
    id: string;
    name: string;
    identifier: string;
    studentCount: number;
    courseCount: number;
    colorCode: string;   // new
    inviteCode: string;  // new
    ownerName: string;   // new
  }
  
  export async function getClassesForUser(
    ownerId: string
  ): Promise<ClassSummary[]> {
    const snap = await db
      .collection("classrooms")
      .where("ownerId", "==", ownerId)
      .get();
  
    const results = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data();
        const { name, identifier, colorCode, inviteCode, ownerId: oid } = data;
  
        // count students & courses
        const studentCount = (
          await doc.ref.collection("members").where("role", "==", "student").get()
        ).size;
        const courseCount = (await doc.ref.collection("courses").get()).size;
  
        // fetch owner’s name
        const ownerSnap = await db.collection("users").doc(oid).get();
        const ownerName =
          ownerSnap.data()?.name ||
          ownerSnap.data()?.displayName ||
          "Unknown";
  
        return {
          id: doc.id,
          name,
          identifier,
          studentCount,
          courseCount,
          colorCode,
          inviteCode,
          ownerName,
        };
      })
    );
  
    return results;
  }

//  FOCUS ROUTE
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

  export interface StudentWithProgress {
    id: string;
    name: string;
    progress: Array<{
      courseId: string;
      totalLessons: number;
      completedLessons: number;
    }>;
  }
  
/**
 * Returns all ‘student’ members of a class, plus their progress
 * in every course assigned to that class.
 * Only teachers may call this.
 */
export async function getStudentsWithProgress(
    teacherId: string,
    classId: string
  ): Promise<StudentWithProgress[]> {
    const classRef = db.collection("classrooms").doc(classId);
  
    // 1) Verify caller is teacher
    const me = await classRef.collection("members").doc(teacherId).get();
    if (!me.exists || me.data()?.role !== "teacher") {
      throw new Error("Access denied: only teachers may list students");
    }
  
    // 2) Load all student member IDs
    const memberSnap = await classRef
      .collection("members")
      .where("role", "==", "student")
      .get();
  
    // 3) Load all course IDs assigned to this class
    const courseSnap = await classRef.collection("courses").get();
    const courseIds = courseSnap.docs.map((d) => d.id);
  
    // 4) For each student, fetch their name + each course’s progress
    const results: StudentWithProgress[] = await Promise.all(
      memberSnap.docs.map(async (memDoc) => {
        const studentId = memDoc.id;
        // fetch student name
        const userSnap = await db.collection("users").doc(studentId).get();
        const userData = userSnap.data() || {};
        const name = userData.name || userData.displayName || "Unknown";
  
        // fetch classCourses for this student & class
        const progSnap = await db
          .collection("users")
          .doc(studentId)
          .collection("classCourses")
          .where("classId", "==", classId)
          .get();
  
        // build a map courseId -> lessons object
        const progMap: Record<string, { total: number; completed: number }> = {};
        progSnap.docs.forEach((doc) => {
          const { courseId, progress } = doc.data() as any;
          const lessons: Record<string, { completed: boolean }> =
            progress.lessons || {};
          const total = Object.keys(lessons).length;
          const completed = Object.values(lessons).filter(
            (l) => l.completed
          ).length;
          progMap[courseId] = { total, completed };
        });
  
        // for any course that has no entry (maybe just assigned), default 0/0
        const progress = courseIds.map((cid) => {
          const stats = progMap[cid] || { total: 0, completed: 0 };
          return {
            courseId: cid,
            totalLessons: stats.total,
            completedLessons: stats.completed,
          };
        });
  
        return { id: studentId, name, progress };
      })
    );
  
    return results;
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
      .where("userId", "==", userId)
      .orderBy("joinedAt", "desc")

      .get();
  
    // membershipSnaps.docs[i].ref.parent.parent is the classRef
    const classRefs = membershipSnaps.docs.map((m) => m.ref.parent.parent!);
  
    const results = await Promise.all(
      classRefs.map(async (classRef) => {
        const classId = classRef.id;
        const { name, identifier, colorCode } = (await classRef.get()).data()!;
  
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
            .collection("classCourses")
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
          colorCode,
          // Optionally: build CourseProgress[] here if you need per-lesson data
        };
      })
    );
  
    return results;
  }

//   when click on course
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
        colorCode: classDoc.data().colorCode,
        inviteCode: classDoc.data().inviteCode,
        ownerName: classDoc.data().ownerName,

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

// Extend the SubmissionRecord type:
export interface SubmissionRecord {
    classId:     string;
    className:   string;   // ← new
    classColor:  string;   // ← new (hex code)
    userId:      string;
    courseId:    string;
    lessonId:    string;
    completedAt: string;
  }
  
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
      // grab name + colorCode from the class document
      const { name: className, colorCode: classColor = "#000000" } =
        classDoc.data();
  
      const subsSnap = await classDoc.ref
        .collection("submissions")
        .orderBy("completedAt", "desc")
        .get();
  
      subsSnap.docs.forEach((doc) => {
        const data = doc.data();
        submissions.push({
          classId,
          className,      // pass it through
          classColor,     // pass it through
          userId:      data.userId,
          courseId:    data.courseId,
          lessonId:    data.lessonId,
          completedAt: data.completedAt,
        });
      });
    }
  
    // 3) Globally sort by time, if desired
    submissions.sort(
      (a, b) =>
        new Date(b.completedAt).getTime() -
        new Date(a.completedAt).getTime()
    );
  
    return submissions;
  }
  