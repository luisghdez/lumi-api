import { FastifyInstance } from "fastify";
import { createSavedCourseController, markLessonCompletedController } from "../controllers/savedCourseController";
import { authenticateUser } from "../middleware/authUser";

// routes for saving a course, sharing course, saving course progress, finishing course.
async function savedCourseRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/saved-courses",
    preHandler: authenticateUser, // Ensure the user is authenticated
    handler: createSavedCourseController,
  });

  fastify.route({
    method: "PATCH",
    url: "/saved-courses/:courseId/lessons/:lessonId/complete",
    preHandler: authenticateUser,
    handler: markLessonCompletedController,
  });
}

export default savedCourseRoutes;
