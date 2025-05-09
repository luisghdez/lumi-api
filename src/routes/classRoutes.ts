// src/routes/classRoutes.ts
import { FastifyInstance } from "fastify";
import { authenticateUser } from "../middleware/authUser";
import { createClassController, getAllClassSubmissionsController, getClassCoursesController, getClassesController, getClassStudentsController, getOrCreateClassCourseController, getUpcomingAssignmentsController, joinClassController, markClassLessonCompletedController } from "../controllers/classController";

export default async function classRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/class",
    preHandler: authenticateUser,
    handler: createClassController,
  });

  fastify.route({
    method: "GET",
    url: "/classes",
    preHandler: authenticateUser,
    handler: getClassesController,
  });

  fastify.route({
    method: "GET",
    url: "/class/:id/courses",
    preHandler: authenticateUser,
    handler: getClassCoursesController,
  });

  fastify.route({
    method: "GET",
    url: "/class/:id/students",
    preHandler: authenticateUser,
    handler: getClassStudentsController,
  });

  fastify.route({
    method: "GET",
    url: "/class/:classId/course/:courseId",
    preHandler: authenticateUser,
    handler: getOrCreateClassCourseController,
  });

  fastify.route({
    method: "POST",
    url: "/class/join",
    preHandler: authenticateUser,
    handler: joinClassController,
  });

  fastify.route({
    method: "GET",
    url: "/assignments/upcoming",
    preHandler: authenticateUser,
    handler: getUpcomingAssignmentsController,
  });

  fastify.route({
    method: "PATCH",
    url: "/class/:classId/course/:courseId/lessons/:lessonId/complete",
    preHandler: authenticateUser,
    handler: markClassLessonCompletedController,
  });

  fastify.route({
    method: "GET",
    url: "/classes/submissions",
    preHandler: authenticateUser,
    handler: getAllClassSubmissionsController,
  });
}

