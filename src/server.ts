import dotenv from "dotenv";
dotenv.config();

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import cookie from "@fastify/cookie";

import courseRoutes from "./routes/courseRoutes";
import userRoutes from "./routes/userRoutes";
import savedCourseRoutes from "./routes/savedCourseRoutes";
import friendRoutes from "./routes/friendRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import classRoutes from "./routes/classRoutes";
import studentRoutes from "./routes/studentRoutes";
import ragRoutes from "./routes/ragRoutes";
import notiRoutes from "./routes/notifRoutes";
import cronRoutes from "./routes/cronRoutes";
import AASARoutes from "./routes/AASARoutes";

import { authRoutes } from "./routes/authRoutes";
import { blackboardRoutes } from "./routes/blackboardRoutes";
import { schoolRoutes } from "./routes/schoolRoutes";

const fastify = Fastify({ logger: true });

// Health check route
fastify.get("/", async () => {
  return { message: "Lumi API is running 🚀" };
});

const start = async () => {
  try {
    // ✅ Register plugins first
    await fastify.register(cookie);
    await fastify.register(cors);
    await fastify.register(multipart, {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    });

    // ✅ Register routes
    await fastify.register(courseRoutes);
    await fastify.register(userRoutes);
    await fastify.register(savedCourseRoutes);
    await fastify.register(friendRoutes);
    await fastify.register(reviewRoutes);
    await fastify.register(classRoutes);
    await fastify.register(studentRoutes);
    await fastify.register(ragRoutes);
    await fastify.register(notiRoutes);
    await fastify.register(cronRoutes);
    await fastify.register(AASARoutes);

    // Blackboard integration
    await fastify.register(authRoutes, { prefix: "/api/blackboard/auth" });
    await fastify.register(blackboardRoutes, { prefix: "/api/blackboard" });
    await fastify.register(schoolRoutes, { prefix: "/api/blackboard" });

    // Start server
    await fastify.listen({ port: 3000, host: "0.0.0.0" });

    console.log("🚀 Server running at http://localhost:3000");
    console.log(fastify.printRoutes());
    console.log("📚 API Documentation available at http://localhost:3000/docs");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();