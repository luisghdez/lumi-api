// src/routes/studentRoutes.ts
import { FastifyInstance } from "fastify";
import { authenticateUser } from "../middleware/authUser";
import { getStudentClassesController } from "../controllers/studentController";

export default async function studentRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "GET",
    url: "/student/classes",
    preHandler: authenticateUser,
    handler: getStudentClassesController,
  });
}
