import { FastifyPluginAsync } from "fastify";
import { authStartHandler, authCallbackHandler } from "../controllers/authController";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/start", authStartHandler);
  fastify.get("/callback", authCallbackHandler);
};