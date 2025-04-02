import { FastifyInstance } from "fastify";
import { createCourseController, getCoursesController, getFeaturedCoursesController, getLessonsController } from "../controllers/courseController";
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
    preHandler: authenticateUser,
    handler: getCoursesController,
  });

  fastify.route({
    method: "GET",
    url: "/courses/featured",
    preHandler: authenticateUser,
    handler: getFeaturedCoursesController,
  });

  fastify.route({
    method: "GET",
    url: "/courses/:courseId/lessons",
    preHandler: authenticateUser,
    handler: getLessonsController,
  });
}

export default courseRoutes;