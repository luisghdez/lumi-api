import { FastifyRequest, FastifyReply } from "fastify";
import { gradeReview, generateFeedback } from "../services/reviewService";
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

    console.log("Received request body:", request.body);
    

    if (!transcript || !Array.isArray(terms) || typeof attemptNumber !== "number") {
      return reply.status(400).send({
        error: "Missing required fields: transcript, terms, or attemptNumber.",
      });
    }

    // Get the current score for the focus term
    const currentTerm = terms.find(t => t.term === focusTerm);
    const currentScore = currentTerm?.score || 0;

    // Step 1: Grade the user's response
    const gradingResult = await gradeReview({
      focusTerm,
      focusDefinition,
      conversationHistory: conversationHistory || [],
      currentScore,
    });

    if (!gradingResult) {
      return reply.status(500).send({ error: "Failed to grade review" });
    }

    // Step 2: Update the terms array with the new score
    const updatedTerms = terms.map(t => 
      t.term === focusTerm ? { ...t, score: gradingResult.score } : t
    );

    // Step 3: Generate feedback based on score and attempt number
    const feedbackResult = await generateFeedback({
      score: gradingResult.score,
      attemptNumber,
      focusTerm,
      focusDefinition,
      terms: updatedTerms,
      conversationHistory: conversationHistory || [],
    });

    if (!feedbackResult) {
      return reply.status(500).send({ error: "Failed to generate feedback" });
    }

    const feedbackMessage = feedbackResult.feedbackMessage;

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
      .then((audioBuffer) => {
        storeAudio(sessionId, audioBuffer);
      })
      .catch((err) => {
        console.error("Error generating TTS audio with OpenAI:", err);
        // Fallback to ElevenLabs TTS
        generateElevenLabsTtsAudioBuffer(feedbackMessage)
          .then((audioBuffer) => {
            storeAudio(sessionId, audioBuffer);
          })
          .catch((err) => {
            console.error("Error generating TTS audio with ElevenLabs:", err);
          });
      });

  } catch (error) {
    console.error("Error in reviewController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};
