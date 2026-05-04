import dotenv from 'dotenv';
dotenv.config();

import Fastify from "fastify";
import { parse as secureJsonParse } from "secure-json-parse";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import courseRoutes from "./routes/courseRoutes";
import userRoutes from './routes/userRoutes';
import savedCourseRoutes from './routes/savedCourseRoutes';
import friendRoutes from './routes/friendRoutes';
import reviewRoutes from './routes/reviewRoutes';
import classRoutes from './routes/classRoutes';
import studentRoutes from './routes/studentRoutes';
import ragRoutes from './routes/ragRoutes';
import notiRoutes from './routes/notifRoutes';
import cronRoutes from './routes/cronRoutes';
import AASARoutes from './routes/AASARoutes';
import videoRoutes from './routes/videoRoutes';
import videoShareWebRoutes from './routes/videoShareWebRoutes';
import podcastRoutes from './routes/podcastRoutes';


const fastify = Fastify({ logger: true });

// Flutter (and others) send Content-Type: application/json with an empty body on DELETE;
// Fastify's default parser rejects that — treat empty body as {}.
fastify.removeContentTypeParser("application/json");
fastify.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  function (req, body: string, done) {
    if (body === "" || body == null) {
      done(null, {});
      return;
    }
    try {
      done(
        null,
        secureJsonParse(body, null, {
          protoAction: "error",
          constructorAction: "error",
        })
      );
    } catch (err: unknown) {
      const e = err as { statusCode?: number };
      e.statusCode = 400;
      done(err as Error, undefined);
    }
  }
);

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
fastify.register(classRoutes);
fastify.register(studentRoutes);
fastify.register(ragRoutes);
fastify.register(notiRoutes)
fastify.register(cronRoutes);
fastify.register(AASARoutes);
fastify.register(videoShareWebRoutes);
fastify.register(videoRoutes);
fastify.register(podcastRoutes);

// Health check route
fastify.get("/", async () => {
  return { message: "Lumi API is running 🚀" };
});

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log("🚀 Server running at http://localhost:3000");
    
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
