import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

const fastify = Fastify({ logger: true });

// Register plugins
fastify.register(cors);
fastify.register(multipart);

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
