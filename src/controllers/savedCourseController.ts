import { FastifyRequest, FastifyReply } from "fastify";
import { createSavedCourse, createSharedSavedCourse, markLessonAsCompleted, deleteSavedCourse } from "../services/savedCourseService";
import { updateUserStreak } from "../services/streakService";

interface CreateSavedCourseRequestBody {
  courseId: string;
  lessonCount: number;
}

export async function createSavedCourseController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { courseId } = request.body as CreateSavedCourseRequestBody;
    const user = (request as any).user;

    if (!user || !user.uid) {
        return reply.status(401).send({ error: "Unauthorized" });
    }

    const userId = user.uid;

    const savedCourse = await createSharedSavedCourse(userId, courseId);
    reply.code(201).send(savedCourse);
  } catch (error) {
    console.error("Error creating saved course:", error);
    reply.code(500).send({ error: "Failed to create saved course" });
  }
}

export const markLessonCompletedController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // Extract courseId and lessonId from the URL parameters
    const { courseId, lessonId } = request.params as { courseId: string; lessonId: string };
    if (!courseId || !lessonId) {
      return reply.status(400).send({ error: "Missing courseId or lessonId parameter" });
    }

    // Extract xp from the request body (allowing frontend to decide the XP count)
    const { xp, lessonAttemptId, durationMs } = request.body as {
      xp: number; lessonAttemptId?: string; durationMs?: number;
    };
    if (!Number.isInteger(xp) || xp < 0 || xp > 1000) {
      return reply.status(400).send({ error: "Invalid XP value" });
    }
    if (lessonAttemptId !== undefined && !/^[a-zA-Z0-9_-]{8,128}$/.test(lessonAttemptId)) {
      return reply.status(400).send({ error: "Invalid lessonAttemptId" });
    }
    if (durationMs !== undefined && (!Number.isInteger(durationMs) || durationMs < 0 || durationMs > 86_400_000)) {
      return reply.status(400).send({ error: "Invalid durationMs" });
    }

    // Call the service to mark the lesson as completed and update user XP
    const completion = await markLessonAsCompleted(user.uid, courseId, lessonId, xp, lessonAttemptId, durationMs);
    let streakResult = null;
    if (!completion.wasPreviouslyCompleted) {
      try {
        streakResult = await updateUserStreak(user.uid);
      } catch (streakError) {
        // A failed secondary streak update must not turn a committed lesson into a retryable 500.
        console.error("Lesson completed, but streak update failed:", streakError);
      }
    }

    // 3) Return response, including whether the streak was extended
    return reply.status(200).send({
      message: "Lesson marked as completed, XP updated, and streak checked.",
      streakInfo: streakResult,
      ...completion,
    });
  } catch (error) {
    console.error("Error marking lesson as completed:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

export async function deleteSavedCourseController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { courseId } = request.params as { courseId: string };
    if (!courseId) {
      return reply.status(400).send({ error: "Missing courseId parameter" });
    }

    await deleteSavedCourse(user.uid, courseId);
    
    reply.code(200).send({ message: "Saved course deleted successfully" });
  } catch (error) {
    console.error("Error deleting saved course:", error);
    if (error instanceof Error && error.message === "Saved course does not exist") {
      return reply.status(404).send({ error: "Saved course not found" });
    }
    reply.code(500).send({ error: "Failed to delete saved course" });
  }
}
