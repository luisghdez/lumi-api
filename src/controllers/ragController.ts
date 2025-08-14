import { FastifyRequest, FastifyReply } from "fastify";
import { answerCourseQuestion } from "../services/ragService";

export const courseChatController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { courseId } = request.params as { courseId: string };
    const { question, topK, conversationHistory } = request.body as {
      question: string;
      topK?: number;
      conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!courseId || !question?.trim()) {
      return reply.status(400).send({ error: "Missing courseId or question" });
    }

    const result = await answerCourseQuestion(courseId, question, { topK, conversationHistory });

    return reply.status(200).send({
      answer: result.answer,
      sources: result.sources,
    });
  } catch (error: any) {
    console.error("Error in courseChatController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};


