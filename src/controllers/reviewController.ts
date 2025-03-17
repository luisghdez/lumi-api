import { FastifyRequest, FastifyReply } from "fastify";
import { processReviewService } from "../services/reviewService";
import { generateTtsAudioBuffer } from "../services/textToSpeechService";
import { v4 as uuidv4 } from "uuid";
import { storeAudio } from "../services/audioCacheService";

export const reviewController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { transcript, terms, attemptNumber } = request.body as {
      transcript: string;
      terms: Array<{ term: string; status: string }>;
      attemptNumber: number;
    };

    if (!transcript || !Array.isArray(terms) || typeof attemptNumber !== "number") {
      return reply.status(400).send({
        error: "Missing required fields: transcript, terms, or attemptNumber.",
      });
    }

    // Process the review using GPT-based logic
    const result = await processReviewService({ transcript, terms, attemptNumber });
    if (!result) {
      return reply.status(500).send({ error: "Failed to process review" });
    }
    const { updatedTerms, feedbackMessage } = result;

    // Generate TTS audio buffer for the feedback message
    const audioBuffer = await generateTtsAudioBuffer(feedbackMessage);

    // Generate a unique session ID for this audio response
    const sessionId = uuidv4();

    // Store the audio buffer in our in-memory cache
    storeAudio(sessionId, audioBuffer);

    // Return JSON response with sessionId, updated terms, and feedback
    return reply.status(200).send({
      sessionId,
      updatedTerms,
      feedbackMessage,
    });
  } catch (error) {
    console.error("Error in reviewController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};
