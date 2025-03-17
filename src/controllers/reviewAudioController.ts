import { FastifyRequest, FastifyReply } from "fastify";
import { retrieveAudio, deleteAudio } from "../services/audioCacheService";

export const reviewAudioController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    // Expect sessionId to be passed as a query parameter
    const { sessionId } = request.query as { sessionId: string };

    if (!sessionId) {
      return reply.status(400).send({ error: "Missing sessionId parameter." });
    }

    const audioBuffer = retrieveAudio(sessionId);
    if (!audioBuffer) {
      return reply.status(404).send({ error: "Audio not found or expired." });
    }

    // Optionally remove the audio after retrieval (if ephemeral)
    deleteAudio(sessionId);

    // Set header and send raw audio buffer
    reply.header("Content-Type", "audio/mpeg");
    return reply.send(audioBuffer);
  } catch (error) {
    console.error("Error in reviewAudioController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};
