import dotenv from 'dotenv';
dotenv.config();

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import courseRoutes from "../src/routes/courseRoutes";
import userRoutes from './routes/userRoutes';
import savedCourseRoutes from './routes/savedCourseRoutes';
import friendRoutes from './routes/friendRoutes';
import reviewRoutes from './routes/reviewRoutes';


const fastify = Fastify({ logger: true });

// Register plugins
fastify.register(cors);
fastify.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20 MB
    },
  });
fastify.register(courseRoutes);
fastify.register(userRoutes);
fastify.register(savedCourseRoutes);
fastify.register(friendRoutes);
fastify.register(reviewRoutes)

// Health check route
fastify.get("/", async () => {
  return { message: "Lumi API is running 🚀" };
});

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log("🚀 Server running at http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
