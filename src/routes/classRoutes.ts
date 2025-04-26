// src/routes/classRoutes.ts
import { FastifyInstance } from "fastify";
import { authenticateUser } from "../middleware/authUser";
import { createClassController, getClassCoursesController, getClassesController } from "../controllers/classController";

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

}

