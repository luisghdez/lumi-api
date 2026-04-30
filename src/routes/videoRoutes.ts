import { FastifyInstance } from "fastify";
import {
  completeVideoUploadController,
  createVideoCommentController,
  createVideoController,
  deleteVideoCommentController,
  deleteVideoController,
  getVideoByIdController,
  getVideoCommentsController,
  getVideoFeedController,
  likeVideoController,
  unlikeVideoController,
} from "../controllers/videoController";
import { authenticateUser } from "../middleware/authUser";

async function videoRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: "POST",
    url: "/videos",
    preHandler: authenticateUser,
    handler: createVideoController,
  });

  fastify.route({
    method: "GET",
    url: "/videos/feed",
    preHandler: authenticateUser,
    handler: getVideoFeedController,
  });

  fastify.route({
    method: "GET",
    url: "/videos/:videoId",
    preHandler: authenticateUser,
    handler: getVideoByIdController,
  });

  fastify.route({
    method: "PATCH",
    url: "/videos/:videoId/complete",
    preHandler: authenticateUser,
    handler: completeVideoUploadController,
  });

  fastify.route({
    method: "DELETE",
    url: "/videos/:videoId",
    preHandler: authenticateUser,
    handler: deleteVideoController,
  });

  fastify.route({
    method: "POST",
    url: "/videos/:videoId/like",
    preHandler: authenticateUser,
    handler: likeVideoController,
  });

  fastify.route({
    method: "DELETE",
    url: "/videos/:videoId/like",
    preHandler: authenticateUser,
    handler: unlikeVideoController,
  });

  fastify.route({
    method: "GET",
    url: "/videos/:videoId/comments",
    preHandler: authenticateUser,
    handler: getVideoCommentsController,
  });

  fastify.route({
    method: "POST",
    url: "/videos/:videoId/comments",
    preHandler: authenticateUser,
    handler: createVideoCommentController,
  });

  fastify.route({
    method: "DELETE",
    url: "/videos/:videoId/comments/:commentId",
    preHandler: authenticateUser,
    handler: deleteVideoCommentController,
  });
}

export default videoRoutes;
