import { FastifyPluginAsync } from "fastify";
import { meHandler, coursesHandler } from "../controllers/blackboardController";

export const blackboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/me", meHandler);
  fastify.get("/courses", coursesHandler);
};