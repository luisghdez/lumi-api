import { FastifyRequest, FastifyReply } from "fastify";
import { processReviewService } from "../services/reviewService";

export const reviewController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    // Pull user data from your auth logic
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // think we initially get the transcript from the user or audio
    // TODO change transcript to be audio URL instead and generate transcript off of this audio

    // Destructure the body
    const { transcript, terms, attemptNumber } = request.body as {
      transcript: string;
      terms: Array<{ term: string; status: string }>;
      attemptNumber: number;
    };

    console.log('🔥 Processing review:', transcript, terms, attemptNumber);

    // Validate that we got the required fields
    if (!transcript || !Array.isArray(terms) || typeof attemptNumber !== "number") {
      return reply.status(400).send({
        error: "Missing required fields: transcript, terms, or attemptNumber.",
      });
    }

  // Call service to process the review
  const result = await processReviewService({
    transcript,
    terms,
    attemptNumber,
  });

  // Check if result is null before destructuring
  if (!result) {
    return reply.status(500).send({
      error: "Failed to process review"
    });
  }

  // Now we can safely destructure
  const { updatedTerms, feedbackMessage } = result;

  console.log('🚀 Review processed successfully:', updatedTerms, feedbackMessage);

  // TODO generate text to speech and get audio

  // Return structured JSON
  return reply.status(200).send({
    updatedTerms,
    feedbackMessage,
    // audioUrl: "Generated TTS audio link here, if applicable"
  });

  } catch (error) {
    console.error("Error in reviewController:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};
