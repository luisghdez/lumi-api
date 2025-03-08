import { FastifyRequest, FastifyReply } from "fastify";
import { createSavedCourse } from "../services/savedCourseService";

interface CreateSavedCourseRequestBody {
  courseId: string;
  lessonCount: number;
}

export async function createSavedCourseController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { courseId, lessonCount } = request.body as CreateSavedCourseRequestBody;
    const user = (request as any).user;

    if (!user || !user.uid) {
        return reply.status(401).send({ error: "Unauthorized" });
    }

    const userId = user.uid;

    const savedCourseId = await createSavedCourse(userId, { courseId, lessonCount });
    reply.code(201).send({ savedCourseId });
  } catch (error) {
    console.error("Error creating saved course:", error);
    reply.code(500).send({ error: "Failed to create saved course" });
  }
}
