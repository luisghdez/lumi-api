import { FastifyRequest, FastifyReply } from "fastify";
import { answerCourseQuestion } from "../services/ragService";
import { createThread } from "../services/threadService";
import { processGeneralMessage } from "../services/generalChatService";

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

export const createThreadController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }    

    const { initialMessage, courseId } = request.body as {
      initialMessage: string;
      courseId?: string;
    };

    if (!initialMessage?.trim()) {
      return reply.status(400).send({ error: "Missing initial message" });
    }

    // Controller decides which service to call for message processing
    let initialResponse: string;
    
    if (courseId) {
      // Use course-specific RAG service
      const result = await answerCourseQuestion(courseId, initialMessage, {
        conversationHistory: [] // Empty conversation history for first message
      });
      initialResponse = result.answer;
    } else {
      // Use general chat service
      initialResponse = await processGeneralMessage(initialMessage);
    }

    // Create thread with the processed response
    const result = await createThread(user.uid, initialMessage.trim(), initialResponse, courseId);

    return reply.status(201).send({
      threadId: result.threadId,
      ...result.thread,
    });
  } catch (error: any) {
    console.error("Error in createThreadController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};


