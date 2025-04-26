// src/routes/classRoutes.ts
import { FastifyInstance } from "fastify";
import { authenticateUser } from "../middleware/authUser";
import { createClassController, getClassesController } from "../controllers/classController";

export default async function classRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/class",
    preHandler: authenticateUser,          // ensure JWT / Firebase token
    handler: createClassController,
  });

  fastify.route({
    method: "GET",
    url: "/classes",
    preHandler: authenticateUser,
    handler: getClassesController,
  });

}

