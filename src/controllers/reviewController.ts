import { FastifyRequest, FastifyReply } from "fastify";
import { assessReview } from "../services/reviewService";
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

    const { transcript, focusTerm, focusDefinition, terms, attemptNumber, conversationHistory } = request.body as {
      transcript: string;
      focusTerm: string;
      focusDefinition: string;
      terms: Array<{ term: string; definition?: string; score: number }>;
      attemptNumber: number;
      conversationHistory?: Array<{ role: "user" | "tutor"; message: string }>;
    };

    if (!transcript || !Array.isArray(terms) || typeof attemptNumber !== "number") {
      return reply.status(400).send({
        error: "Missing required fields: transcript, terms, or attemptNumber.",
      });
    }

    // Get the current score for the focus term
    const currentTerm = terms.find(t => t.term === focusTerm);
    const currentScore = currentTerm?.score || 0;

    // Score and learner-facing feedback are one atomic assessment so a second
    // model request cannot leave the client waiting after progress has changed.
    const assessmentResult = await assessReview({
      transcript,
      focusTerm,
      focusDefinition,
      conversationHistory: conversationHistory || [],
      currentScore,
      attemptNumber,
      terms,
    });

    if (!assessmentResult) {
      return reply.status(500).send({ error: "Failed to grade review" });
    }

    // Safe for operational metrics: no transcript, course content, or user ID.
    console.info("Review assessment completed", assessmentResult.telemetry);

    // Update the terms array with the new score.
    const updatedTerms = terms.map(t => 
      t.term === focusTerm ? { ...t, score: assessmentResult.score } : t
    );

    const feedbackMessage = assessmentResult.feedbackMessage;

    // Generate a unique session ID for this review session
    const sessionId = uuidv4();

    // Immediately respond with JSON so the client can proceed
    reply.status(200).send({
      sessionId,
      updatedTerms,
      feedbackMessage,
    });

    // Fire-and-forget TTS generation in the background (don’t await)
    generateTtsAudioBuffer(feedbackMessage)
      .then((audioBuffer) => storeAudio(sessionId, user.uid, audioBuffer))
      .catch((err) => {
        console.error("Error generating TTS audio with OpenAI:", err);
        // Fallback to ElevenLabs TTS
        generateElevenLabsTtsAudioBuffer(feedbackMessage)
          .then((audioBuffer) => storeAudio(sessionId, user.uid, audioBuffer))
          .catch((err) => {
            console.error("Error generating TTS audio with ElevenLabs:", err);
          });
      });

  } catch (error) {
    console.error("Error in reviewController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};
