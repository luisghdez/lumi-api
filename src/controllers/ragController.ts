import { FastifyRequest, FastifyReply } from "fastify";
import { answerCourseQuestion } from "../services/ragService";
import { createThread, getUserThreads, getThreadMessages, getThreadByCourseId, createMessageInThread } from "../services/threadService";
import { processGeneralMessage, processGeneralMessageWithHistory } from "../services/generalChatService";

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
    let sources: any[] | undefined;
    
    if (courseId) {
      // Use course-specific RAG service
      const result = await answerCourseQuestion(courseId, initialMessage, {
        conversationHistory: [] // Empty conversation history for first message
      });
      initialResponse = result.answer;
      sources = result.sources;
    } else {
      // Use general chat service
      initialResponse = await processGeneralMessage(initialMessage);
    }

    // Create thread with the processed response and sources
    const result = await createThread(user.uid, initialMessage.trim(), initialResponse, courseId, sources);

    return reply.status(201).send({
      threadId: result.threadId,
      ...result.thread,
      ...(sources && { sources }), // Include sources in response if available
    });
  } catch (error: any) {
    console.error("Error in createThreadController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

export const getUserThreadsController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { limit = 10, lastDoc } = request.query as {
      limit?: number;
      lastDoc?: string;
    };

    // Validate limit
    const validatedLimit = Math.min(Math.max(limit || 10, 1), 50); // Between 1 and 50

    const result = await getUserThreads(user.uid, validatedLimit, lastDoc);

    return reply.status(200).send({
      threads: result.threads,
      hasMore: result.hasMore,
      ...(result.lastDoc && { lastDoc: result.lastDoc.id }),
    });
  } catch (error: any) {
    console.error("Error in getUserThreadsController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

export const getThreadMessagesController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { threadId } = request.params as { threadId: string };
    const { limit = 20, lastDoc } = request.query as {
      limit?: number;
      lastDoc?: string;
    };

    const validatedLimit = Math.min(Math.max(limit || 20, 1), 100);
    const result = await getThreadMessages(user.uid, threadId, validatedLimit, lastDoc);

    return reply.status(200).send({
      threadId,
      messages: result.messages,
      hasMore: result.hasMore,
      ...(result.lastDoc && { lastDoc: result.lastDoc.id }),
    });
  } catch (error: any) {
    console.error("Error in getThreadMessagesController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

export const getCourseMessagesController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { courseId } = request.params as { courseId: string };
    const { limit = 20, lastDoc } = request.query as {
      limit?: number;
      lastDoc?: string;
    };

    const validatedLimit = Math.min(Math.max(limit || 20, 1), 100);
    const threadId = await getThreadByCourseId(user.uid, courseId);
    
    if (!threadId) {
      return reply.status(404).send({ error: "No thread found for this course" });
    }

    const result = await getThreadMessages(user.uid, threadId, validatedLimit, lastDoc);

    return reply.status(200).send({
      threadId,
      courseId,
      messages: result.messages,
      hasMore: result.hasMore,
      ...(result.lastDoc && { lastDoc: result.lastDoc.id }),
    });
  } catch (error: any) {
    console.error("Error in getCourseMessagesController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

export const createMessageController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { threadId } = request.params as { threadId: string };
    const { message, courseId } = request.body as {
      message: string;
      courseId?: string;
    };

    if (!message?.trim()) {
      return reply.status(400).send({ error: "Missing message" });
    }

    // Get conversation history for context
    const historyResult = await getThreadMessages(user.uid, threadId, 50); // Get last 50 messages for context
    const conversationHistory = historyResult.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Controller decides which service to call for message processing
    let aiResponse: string;
    let sources: any[] | undefined;
    
    if (courseId) {
      // Use course-specific RAG service with conversation history
      const result = await answerCourseQuestion(courseId, message, {
        conversationHistory
      });
      aiResponse = result.answer;
      sources = result.sources;
    } else {
      // Use general chat service with conversation history
      aiResponse = await processGeneralMessageWithHistory(message, conversationHistory);
    }

    // Create message in thread
    const result = await createMessageInThread(user.uid, threadId, message.trim(), aiResponse, sources);

    return reply.status(201).send({
      ...result.message,
      ...(sources && { sources }),
    });
  } catch (error: any) {
    console.error("Error in createMessageController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};


