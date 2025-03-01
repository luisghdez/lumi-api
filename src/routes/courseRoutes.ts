import { FastifyInstance } from "fastify";
import { createCourseController, getCoursesController, getLessonsController } from "../controllers/courseController";
import { authenticateUser } from '../middleware/authUser';


async function courseRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/courses",
    // schema: createCourseSchema,
    preHandler: authenticateUser,
    handler: createCourseController,
  });

  fastify.route({
    method: "GET",
    url: "/courses",
    preHandler: authenticateUser, // 🔥 Ensure user is authenticated
    handler: getCoursesController,
  });

  fastify.route({
    method: "GET",
    url: "/courses/:courseId/lessons",
    preHandler: authenticateUser,
    handler: getLessonsController,
  });
}

export default courseRoutes;