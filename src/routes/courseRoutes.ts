import { FastifyInstance } from "fastify";
import { createCourseController, getCoursesController, getFeaturedCoursesController, getAllCoursesController, getLessonsController, getCourseFilesController, getCourseByIdController } from "../controllers/courseController";
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
    url: "/courses/all",
    preHandler: authenticateUser,
    handler: getAllCoursesController,
  });

  fastify.route({
    method: "GET",
    url: "/courses/:courseId",
    preHandler: authenticateUser,
    handler: getCourseByIdController,
  });

  fastify.route({
    method: "GET",
    url: "/courses/:courseId/lessons",
    preHandler: authenticateUser,
    handler: getLessonsController,
  });

  fastify.route({
    method: "GET",
    url: "/courses/:courseId/files",
    preHandler: authenticateUser,
    handler: getCourseFilesController,
  });

}

export default courseRoutes;