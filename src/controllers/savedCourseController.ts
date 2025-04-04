import { FastifyRequest, FastifyReply } from "fastify";
import { createSavedCourse, createSharedSavedCourse, markLessonAsCompleted } from "../services/savedCourseService";
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
    const { xp } = request.body as { xp: number };
    if (xp === undefined) {
      return reply.status(400).send({ error: "Missing XP value in request body" });
    }

    // Call the service to mark the lesson as completed and update user XP
    await markLessonAsCompleted(user.uid, courseId, lessonId, xp);
    // 2) Update the user streak and capture the result
    const streakResult = await updateUserStreak(user.uid);

    // 3) Return response, including whether the streak was extended
    return reply.status(200).send({
      message: "Lesson marked as completed, XP updated, and streak checked.",
      streakInfo: streakResult,
    });
  } catch (error) {
    console.error("Error marking lesson as completed:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};