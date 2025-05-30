// src/controllers/classController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
    createClass,
    getClassesForUser,
    ClassSummary,
    getCoursesForClass,
    StudentBrief,
    ClassCourseRecord,
    getOrCreateClassCourse,
    joinClass,
    getUpcomingAssignments,
    UpcomingAssignment,
    markClassLessonCompleted,
    getAllClassSubmissions,
    SubmissionRecord,
    getStudentsWithProgress,
    StudentWithProgress,
  } from "../services/classService";

interface CreateClassBody {
  name: string;
  identifier: string;    // e.g. CRN or teacher’s own ID
  colorCode: string;     // e.g. "#FF33AA"
}

interface JoinClassBody {
    code: string;
  }

export async function createClassController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { name, identifier, colorCode } =
      request.body as CreateClassBody;
    const user = (request as any).user;
    if (!user?.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const newClass = await createClass(user.uid, {
      name,
      identifier,
      colorCode,
    });

    return reply.status(201).send(newClass);
  } catch (error) {
    console.error("Error creating class:", error);
    return reply
      .status(500)
      .send({ error: "Failed to create classroom" });
  }
}

export async function getClassesController(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const user = (request as any).user;
    if (!user?.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  
    try {
      const classes: ClassSummary[] = await getClassesForUser(user.uid);
      return reply.status(200).send(classes);
    } catch (err) {
      console.error("Error fetching classes:", err);
      return reply
        .status(500)
        .send({ error: "Failed to fetch classrooms" });
    }
  }

  export async function getClassCoursesController(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const user = (request as any).user;
      if (!user?.uid) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
  
      const classId = (request.params as { id: string }).id;
      const courses = await getCoursesForClass(user.uid, classId);
  
      return reply.status(200).send(courses);
    } catch (err) {
      console.error("Error fetching class courses:", err);
      return reply
        .status(500)
        .send({ error: "Failed to fetch class courses" });
    }
  }

  export async function getClassStudentsController(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const user = (request as any).user;
      if (!user?.uid) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
  
      const classId = (request.params as { id: string }).id;
      const students: StudentWithProgress[] = await getStudentsWithProgress(
        user.uid,
        classId
      );
  
      return reply.status(200).send(students);
    } catch (err) {
      console.error("Error fetching class students with progress:", err);
      return reply
        .status(500)
        .send({ error: "Failed to fetch class students" });
    }
  }

  export async function getOrCreateClassCourseController(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const user = (request as any).user;
      if (!user?.uid) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
  
      const { classId, courseId } = request.params as {
        classId: string;
        courseId: string;
      };
  
      const record: ClassCourseRecord = await getOrCreateClassCourse(
        user.uid,
        classId,
        courseId
      );
      return reply.status(200).send(record);
    } catch (err) {
      console.error("Error fetching/creating classCourse:", err);
      return reply
        .status(500)
        .send({ error: "Failed to load course for this classroom" });
    }
  }

  export async function joinClassController(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const user = (request as any).user;
      if (!user?.uid) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
  
      const { code } = request.body as JoinClassBody;
      if (!code) {
        return reply.status(400).send({ error: "Missing class code" });
      }
  
      const classInfo: ClassSummary = await joinClass(user.uid, code);
      return reply.status(200).send(classInfo);
    } catch (err: any) {
      console.error("Error joining class:", err);
      if (err.message.includes("not found")) {
        return reply.status(404).send({ error: "Class not found" });
      }
      return reply.status(500).send({ error: "Failed to join class" });
    }
  }

  export async function getUpcomingAssignmentsController(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const user = (request as any).user;
      if (!user?.uid) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
  
      const assignments: UpcomingAssignment[] = await getUpcomingAssignments(
        user.uid
      );
      return reply.status(200).send(assignments);
    } catch (err) {
      console.error("Error fetching upcoming assignments:", err);
      return reply
        .status(500)
        .send({ error: "Failed to fetch upcoming assignments" });
    }
  }

  export async function markClassLessonCompletedController(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const user = (request as any).user;
      if (!user?.uid) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
  
      const { classId, courseId, lessonId } = request.params as {
        classId: string;
        courseId: string;
        lessonId: string;
      };
  
      if (!classId || !courseId || !lessonId) {
        return reply
          .status(400)
          .send({ error: "Missing classId, courseId, or lessonId" });
      }
  
      await markClassLessonCompleted(
        user.uid,
        classId,
        courseId,
        lessonId
      );
  
      return reply
        .status(200)
        .send({ message: "Lesson marked complete." });
    } catch (err) {
      console.error("Error marking class lesson complete:", err);
      return reply
        .status(500)
        .send({ error: "Failed to mark lesson as completed" });
    }
  }

  export async function getAllClassSubmissionsController(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const user = (request as any).user;
      if (!user?.uid) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
  
      const submissions: SubmissionRecord[] = await getAllClassSubmissions(
        user.uid
      );
      return reply.status(200).send(submissions);
    } catch (err) {
      console.error("Error fetching all class submissions:", err);
      return reply
        .status(500)
        .send({ error: "Failed to fetch submissions" });
    }
  }