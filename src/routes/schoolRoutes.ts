import { FastifyPluginAsync } from "fastify";
import { schoolSearchHandler } from "../controllers/schoolController";

export const schoolRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/schools/search", schoolSearchHandler);
};