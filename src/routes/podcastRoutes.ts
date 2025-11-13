import { FastifyInstance } from "fastify";
import { authenticateUser } from "../middleware/authUser";

import {
  createPodcastController,
  // podcastInterruptController,
  checkPodcastExistsController,
  getPodcastMetadataController,
  getPodcastSegmentsController,
  getPodcastSegmentController,
  getPodcastInterruptionsController,
  transcribeAudioQuestionController, // ✅ include here directly
} from "../controllers/podcastController";

async function podcastRoutes(fastify: FastifyInstance) {
  // 🎙️ Create new podcast
  fastify.route({
    method: "POST",
    url: "/podcasts",
    preHandler: authenticateUser,
    handler: createPodcastController,
  });

  // ☎️ Handle podcast interrupt (user question)
  // fastify.route({
  //   method: "POST",
  //   url: "/podcasts/interrupt",
  //   preHandler: authenticateUser,
  //   handler: podcastInterruptController,
  // });

  // 🧠 Check if podcast exists
  fastify.route({
    method: "GET",
    url: "/podcasts/:courseId/exists",
    preHandler: authenticateUser,
    handler: checkPodcastExistsController,
  });

  // 🗂️ Get metadata
  fastify.route({
    method: "GET",
    url: "/podcasts/:courseId/metadata",
    preHandler: authenticateUser,
    handler: getPodcastMetadataController,
  });

  // 🎧 Get all segments
  fastify.route({
    method: "GET",
    url: "/podcasts/:courseId/segments",
    preHandler: authenticateUser,
    handler: getPodcastSegmentsController,
  });

  // 🔊 Get single segment
  fastify.route({
    method: "GET",
    url: "/podcasts/:courseId/segments/:segmentId",
    preHandler: authenticateUser,
    handler: getPodcastSegmentController,
  });

  // 🔁 Get interruptions (call-ins)
  fastify.route({
    method: "GET",
    url: "/podcasts/:courseId/interruptions",
    preHandler: authenticateUser,
    handler: getPodcastInterruptionsController,
  });

  // 🎤 NEW: Transcribe audio call-in (radio-style)
  fastify.route({
    method: "POST",
    url: "/podcasts/transcribe",
    preHandler: authenticateUser,
    handler: transcribeAudioQuestionController,
  });
}

export default podcastRoutes;
