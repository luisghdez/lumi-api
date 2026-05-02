import { FastifyReply, FastifyRequest } from "fastify";
import {
  completeVideoUpload,
  createVideoComment,
  createVideoUpload,
  deleteVideo,
  deleteVideoComment,
  getVideoById,
  getVideoComments,
  getVideoFeed,
  likeVideo,
  unlikeVideo,
  VideoVisibility,
} from "../services/videoService";

function getAuthenticatedUserId(request: FastifyRequest): string | null {
  const user = (request as any).user;
  return user?.uid || null;
}

function handleVideoError(reply: FastifyReply, error: unknown) {
  const statusCode = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 500;
  const message = error instanceof Error ? error.message : "Internal Server Error";

  console.error("Video controller error:", error);
  return reply.status(statusCode).send({ error: message });
}

function parsePagination(query: { cursor?: string; limit?: string | number }) {
  const limit = typeof query.limit === "string" ? Number(query.limit) : query.limit;
  return {
    cursor: query.cursor,
    limit,
  };
}

export async function createVideoController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { caption, mimeType, subject, thumbnailMimeType, visibility } = request.body as {
      caption?: string;
      mimeType?: string;
      subject?: string;
      thumbnailMimeType?: string;
      visibility?: VideoVisibility;
    };

    if (!mimeType) {
      return reply.status(400).send({ error: "Missing required field: mimeType" });
    }

    const result = await createVideoUpload(userId, {
      caption,
      mimeType,
      subject,
      thumbnailMimeType,
      visibility,
    });

    return reply.status(201).send(result);
  } catch (error) {
    return handleVideoError(reply, error);
  }
}

export async function completeVideoUploadController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { videoId } = request.params as { videoId: string };
    const { durationMs, thumbnailUrl } = request.body as {
      durationMs?: number;
      thumbnailUrl?: string;
    };

    const video = await completeVideoUpload(videoId, userId, {
      durationMs,
      thumbnailUrl,
    });

    return reply.status(200).send({ video });
  } catch (error) {
    return handleVideoError(reply, error);
  }
}

export async function getVideoFeedController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const result = await getVideoFeed(userId, parsePagination(request.query as { cursor?: string; limit?: string }));
    return reply.status(200).send(result);
  } catch (error) {
    return handleVideoError(reply, error);
  }
}

export async function getVideoByIdController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { videoId } = request.params as { videoId: string };
    const video = await getVideoById(videoId, userId);
    return reply.status(200).send({ video });
  } catch (error) {
    return handleVideoError(reply, error);
  }
}

export async function deleteVideoController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { videoId } = request.params as { videoId: string };
    await deleteVideo(videoId, userId);
    return reply.status(200).send({ message: "Video deleted successfully" });
  } catch (error) {
    return handleVideoError(reply, error);
  }
}

export async function likeVideoController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { videoId } = request.params as { videoId: string };
    const result = await likeVideo(videoId, userId);
    return reply.status(200).send(result);
  } catch (error) {
    return handleVideoError(reply, error);
  }
}

export async function unlikeVideoController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { videoId } = request.params as { videoId: string };
    const result = await unlikeVideo(videoId, userId);
    return reply.status(200).send(result);
  } catch (error) {
    return handleVideoError(reply, error);
  }
}

export async function getVideoCommentsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { videoId } = request.params as { videoId: string };
    const result = await getVideoComments(
      videoId,
      userId,
      parsePagination(request.query as { cursor?: string; limit?: string })
    );
    return reply.status(200).send(result);
  } catch (error) {
    return handleVideoError(reply, error);
  }
}

export async function createVideoCommentController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { videoId } = request.params as { videoId: string };
    const { text } = request.body as { text?: string };
    if (!text) {
      return reply.status(400).send({ error: "Missing required field: text" });
    }

    const comment = await createVideoComment(videoId, userId, text);
    return reply.status(201).send({ comment });
  } catch (error) {
    return handleVideoError(reply, error);
  }
}

export async function deleteVideoCommentController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { videoId, commentId } = request.params as { videoId: string; commentId: string };
    await deleteVideoComment(videoId, commentId, userId);
    return reply.status(200).send({ message: "Comment deleted successfully" });
  } catch (error) {
    return handleVideoError(reply, error);
  }
}
