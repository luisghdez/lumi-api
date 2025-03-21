import { FastifyRequest, FastifyReply } from "fastify";
import { processReviewService } from "../services/reviewService";
import { generateElevenLabsTtsAudioBuffer, generateTtsAudioBuffer } from "../services/textToSpeechService";
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

    const { transcript, terms, attemptNumber, conversationHistory } = request.body as {
      transcript: string;
      terms: Array<{ term: string; status: string }>;
      attemptNumber: number;
      conversationHistory?: Array<{ role: "user" | "tutor"; message: string }>;
    };
    

    if (!transcript || !Array.isArray(terms) || typeof attemptNumber !== "number") {
      return reply.status(400).send({
        error: "Missing required fields: transcript, terms, or attemptNumber.",
      });
    }

    // Process the review using GPT-based logic
    const result = await processReviewService({ transcript, terms, attemptNumber, conversationHistory });
    if (!result) {
      return reply.status(500).send({ error: "Failed to process review" });
    }
    const { updatedTerms, feedbackMessage } = result;

    // Generate a unique session ID for this review session
    const sessionId = uuidv4();

    // Immediately respond with JSON so the client can proceed
    reply.status(200).send({
      sessionId,
      updatedTerms,
      feedbackMessage,
    });

    // Fire-and-forget TTS generation in the background (don’t await)
    generateElevenLabsTtsAudioBuffer(feedbackMessage)
      .then((audioBuffer) => {
        storeAudio(sessionId, audioBuffer);
      })
      .catch((err) => {
        console.error("Error generating TTS audio with ElevenLabs:", err);
        // Fallback to OpenAI TTS
        generateTtsAudioBuffer(feedbackMessage)
          .then((audioBuffer) => {
            storeAudio(sessionId, audioBuffer);
          })
          .catch((err) => {
            console.error("Error generating TTS audio with OpenAI:", err);
          });
      });

  } catch (error) {
    console.error("Error in reviewController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};
