import { FastifyInstance } from "fastify";
import { createCourseController, getCoursesController, getFeaturedCoursesController, getAllCoursesController, getLessonsController, getCourseFilesController, getCourseByIdController, getAPCatalogCoursesController, getAPUnitNoteController } from "../controllers/courseController";
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

  // Must be registered before /:courseId to avoid the dynamic segment capturing "ap-catalog"
  fastify.route({
    method: "GET",
    url: "/courses/ap-catalog",
    preHandler: authenticateUser,
    handler: getAPCatalogCoursesController,
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

  // Must be registered before /:courseId/files to avoid param capture issues
  fastify.route({
    method: "GET",
    url: "/courses/:courseId/notes/:unitNumber",
    preHandler: authenticateUser,
    handler: getAPUnitNoteController,
  });

  fastify.route({
    method: "GET",
    url: "/courses/:courseId/files",
    preHandler: authenticateUser,
    handler: getCourseFilesController,
  });

}

export default courseRoutes;