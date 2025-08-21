import { FastifyRequest, FastifyReply } from "fastify";
import { answerCourseQuestion, searchCourseContext } from "../services/ragService";
import { createThread, getUserThreads, getThreadMessages, getThreadByCourseId, createMessageInThread } from "../services/threadService";
import { getCourseTitleById } from "../services/courseService";
import { processGeneralMessage, processGeneralMessageWithHistory } from "../services/generalChatService";
import OpenAI from "openai";

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

    // Prepare streaming NDJSON response
    reply.raw.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Transfer-Encoding": "chunked",
    });
    // @ts-ignore
    if (typeof reply.raw.flushHeaders === "function") reply.raw.flushHeaders();

    const writeObject = (obj: any) => {
      try { reply.raw.write(`${JSON.stringify(obj)}\n`); } catch {}
    };

    // Controller decides which service to call for message processing
    let sources: any[] | undefined;
    let courseTitle: string | undefined;

    const openai = new OpenAI();
    let messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

    if (courseId) {
      const fetchedCourseTitle = await getCourseTitleById(courseId);
      if (!fetchedCourseTitle) {
        writeObject({ type: "error", error: "Invalid courseId: course not found" });
        try { reply.raw.end(); } catch {}
        return;
      }
      courseTitle = fetchedCourseTitle;

      const retrieval = await searchCourseContext(courseId, initialMessage, 5);
      sources = retrieval.chunks;

      messages.push(
        { role: "system", content: "You are a helpful tutor for this specific course. Answer the user's question using ONLY the provided sources. If the answer isn't in the sources, say you don't find it in the course materials and offer a brief next step. Keep answers concise and cite where relevant as [Source N]." },
        { role: "system", content: `Sources (most relevant first):\n\n${retrieval.context}` },
      );
    } else {
      messages.push({ role: "system", content: "You are a helpful AI assistant. Provide clear, concise, and helpful responses to user questions." });
    }

    messages.push({ role: "user", content: initialMessage });

    writeObject({ type: "start", role: "assistant", ...(sources && { sources }) });

    const stream = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: courseId ? 0.2 : 0.7,
      stream: true,
    } as any);

    let fullText = "";
    for await (const chunk of stream as any) {
      if (reply.raw.writableEnded) break;
      const delta = chunk?.choices?.[0]?.delta?.content || "";
      if (delta) {
        fullText += delta;
        writeObject({ type: "delta", delta });
      }
    }

    try {
      const result = await createThread(
        user.uid,
        initialMessage.trim(),
        fullText,
        courseId,
        courseTitle,
        sources
      );

      writeObject({ type: "thread", threadId: result.threadId, ...result.thread });
      writeObject({ type: "message", ...result.assistantMessage, ...(sources && { sources }) });
      writeObject({ type: "done" });
    } catch (persistErr: any) {
      writeObject({ type: "error", error: "Failed to create thread", details: persistErr?.message || String(persistErr) });
    } finally {
      try { reply.raw.end(); } catch {}
    }

    return;
  } catch (error: any) {
    console.error("Error in createThreadController:", error);
    try {
      if (reply.raw.headersSent) {
        try {
          reply.raw.write(`${JSON.stringify({ type: "error", error: "Internal Server Error" })}\n`);
          reply.raw.end();
          return;
        } catch {}
      }
    } catch {}
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

    const { limit = 10, cursor, lastDoc } = request.query as {
      limit?: number;
      cursor?: string; // preferred param
      lastDoc?: string; // legacy
    };

    // Validate limit
    const validatedLimit = Math.min(Math.max(limit || 10, 1), 50); // Between 1 and 50

    const result = await getUserThreads(user.uid, validatedLimit, cursor || lastDoc);

    return reply.status(200).send({
      threads: result.threads,
      hasMore: result.hasMore,
      ...(result.lastDoc && { lastDoc: result.lastDoc.id }), // legacy
      ...(result.nextCursor && { nextCursor: result.nextCursor }),
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
    const { limit = 10, cursor, lastDoc } = request.query as {
      limit?: number;
      cursor?: string;
      lastDoc?: string;
    };

    // Validate limit for lazy loading (smaller chunks)
    const validatedLimit = Math.min(Math.max(limit || 10, 1), 50);
    const result = await getThreadMessages(user.uid, threadId, validatedLimit, cursor || lastDoc);

    return reply.status(200).send({
      threadId,
      messages: result.messages,
      hasMore: result.hasMore,
      ...(result.lastDoc && { lastDoc: result.lastDoc.id }),
      ...(result.nextCursor && { nextCursor: result.nextCursor }),
      ...(result.totalCount !== undefined && { totalCount: result.totalCount }),
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
    const { limit = 10, cursor, lastDoc } = request.query as {
      limit?: number;
      cursor?: string;
      lastDoc?: string;
    };

    // Validate limit for lazy loading (smaller chunks)
    const validatedLimit = Math.min(Math.max(limit || 10, 1), 50);
    const threadId = await getThreadByCourseId(user.uid, courseId);
    
    if (!threadId) {
      return reply.status(404).send({ error: "No thread found for this course" });
    }

    const result = await getThreadMessages(user.uid, threadId, validatedLimit, cursor || lastDoc);

    return reply.status(200).send({
      threadId,
      courseId,
      messages: result.messages,
      hasMore: result.hasMore,
      ...(result.lastDoc && { lastDoc: result.lastDoc.id }),
      ...(result.nextCursor && { nextCursor: result.nextCursor }),
      ...(result.totalCount !== undefined && { totalCount: result.totalCount }),
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

    // Get conversation history for context (using larger limit for AI context)
    const historyResult = await getThreadMessages(user.uid, threadId, 50);
    const conversationHistory = historyResult.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Prepare streaming NDJSON response (works with POST + fetch streaming)
    reply.raw.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Transfer-Encoding": "chunked",
    });
    // @ts-ignore flushHeaders exists on Node's ServerResponse
    if (typeof reply.raw.flushHeaders === "function") reply.raw.flushHeaders();

    const writeObject = (obj: any) => {
      try {
        reply.raw.write(`${JSON.stringify(obj)}\n`);
      } catch (err) {
        // ignore write errors (client may have disconnected)
      }
    };

    const openai = new OpenAI();
    let sources: any[] | undefined;

    // Build messages for the model
    let messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
    if (courseId) {
      // RAG: retrieve relevant context and include as system content
      const retrieval = await searchCourseContext(courseId, message, 5);
      sources = retrieval.chunks;

      messages.push(
        { role: "system", content: "You are a helpful tutor for this specific course. Answer the user's question using ONLY the provided sources. If the answer isn't in the sources, say you don't find it in the course materials and offer a brief next step. Keep answers concise and cite where relevant as [Source N]." },
        { role: "system", content: `Sources (most relevant first):\n\n${retrieval.context}` },
      );
    } else {
      // General chat system prompt
      messages.push({
        role: "system",
        content: "You are a helpful AI assistant. Provide clear, concise, and helpful responses to user questions. Maintain context from the conversation history.",
      });
    }

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
    // Add the current user message
    messages.push({ role: "user", content: message });

    // Inform client of start and any metadata (e.g., sources)
    writeObject({ type: "start", threadId, role: "assistant", ...(sources && { sources }) });

    const stream = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      // temperature: courseId ? 0.2 : 0.7,
      stream: true,
    } as any);

    let fullText = "";

    for await (const chunk of stream as any) {
      if ((request as any).raw?.aborted || reply.raw.writableEnded) {
        break;
      }
      const delta = chunk?.choices?.[0]?.delta?.content || "";
      if (delta) {
        fullText += delta;
        writeObject({ type: "delta", delta });
      }
    }

    // Persist the final message and then announce completion
    try {
      const result = await createMessageInThread(
        user.uid,
        threadId,
        message.trim(),
        fullText,
        sources,
      );

      writeObject({ type: "message", ...result.message, ...(sources && { sources }) });
      writeObject({ type: "done" });
    } catch (persistErr: any) {
      writeObject({ type: "error", error: "Failed to save message", details: persistErr?.message || String(persistErr) });
    } finally {
      try { reply.raw.end(); } catch {}
    }

    return; // We have handled the response via streaming
  } catch (error: any) {
    console.error("Error in createMessageController:", error);
    try {
      // If headers already sent for SSE, emit error event; otherwise send JSON error
      if (reply.raw.headersSent) {
        try {
          reply.raw.write(`${JSON.stringify({ type: "error", error: "Internal Server Error" })}\n`);
          reply.raw.end();
          return;
        } catch {}
      }
    } catch {}
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};


