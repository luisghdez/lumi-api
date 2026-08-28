import { FastifyReply, FastifyRequest } from "fastify";
import { assessTalkAttempt, createTalkSession, createTalkWebRtcOffer, TalkSessionError } from "../services/talkSessionService";

function sendTalkError(reply: FastifyReply, error: unknown) {
  if (error instanceof TalkSessionError) return reply.status(error.statusCode).send({ error: error.message });
  console.error("Talk to Lumi request failed:", error);
  return reply.status(500).send({ error: "Talk to Lumi is unavailable right now." });
}

export async function createTalkSessionController(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  if (!user?.uid) return reply.status(401).send({ error: "Unauthorized" });
  const { courseId, lessonId, clientAttemptId } = request.body as Record<string, string>;
  if (!courseId || !lessonId || !clientAttemptId) {
    return reply.status(400).send({ error: "courseId, lessonId, and clientAttemptId are required." });
  }
  try {
    return reply.send(await createTalkSession({ ownerUid: user.uid, courseId, lessonId, clientAttemptId }));
  } catch (error) {
    return sendTalkError(reply, error);
  }
}

export async function assessTalkAttemptController(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  if (!user?.uid) return reply.status(401).send({ error: "Unauthorized" });
  const { attemptId } = request.params as { attemptId: string };
  const { transcript, turnId, durationMs } = request.body as { transcript: string; turnId: string; durationMs?: number };
  if (!attemptId || !transcript || !turnId) {
    return reply.status(400).send({ error: "attemptId, transcript, and turnId are required." });
  }
  try {
    return reply.send(await assessTalkAttempt({ ownerUid: user.uid, attemptId, transcript, turnId, durationMs }));
  } catch (error) {
    return sendTalkError(reply, error);
  }
}

export async function createTalkWebRtcOfferController(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  if (!user?.uid) return reply.status(401).send({ error: "Unauthorized" });
  const { attemptId } = request.params as { attemptId: string };
  const { sdp } = request.body as { sdp: string };
  if (!attemptId || !sdp) return reply.status(400).send({ error: "attemptId and sdp are required." });
  try {
    return reply.send(await createTalkWebRtcOffer({ ownerUid: user.uid, attemptId, sdp }));
  } catch (error) {
    return sendTalkError(reply, error);
  }
}
