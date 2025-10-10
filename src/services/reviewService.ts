import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ChatCompletionMessageParam } from "openai/resources";
import { z } from "zod";

// Schema for grading only
const gradingResponseSchema = z.object({
  score: z.number(),
  reasoning: z.string(),
});

// Schema for feedback generation
const feedbackResponseSchema = z.object({
  feedbackMessage: z.string(),
});

// Create OpenAI client
const openai = new OpenAI();

// TypeScript interface for grading params
interface GradeReviewParams {
  focusTerm: string;
  focusDefinition: string;
  conversationHistory: Array<{ role: "user" | "tutor"; message: string }>;
  currentScore: number;
}

// TypeScript interface for feedback generation params
interface GenerateFeedbackParams {
  score: number;
  attemptNumber: number;
  focusTerm: string;
  focusDefinition: string;
  terms: Array<{ term: string; definition?: string; score: number }>;
  conversationHistory: Array<{ role: "user" | "tutor"; message: string }>;
}

/**
 * GRADING ONLY: This function evaluates the user's understanding 
 * of the focusTerm based on the conversation history.
 * Returns a score (0-100) and reasoning.
 */
export async function gradeReview({
  focusTerm,
  focusDefinition,
  conversationHistory,
  currentScore,
}: GradeReviewParams) {
  try {
    const gradingSystemPrompt = `
Grade the user's understanding of "${focusTerm}" based on this definition: "${focusDefinition}"

Scoring:
- 100: Captures core meaning (exact wording not required)
- 75-95: Good understanding, minor gaps
- 50-70: Partial understanding, missing key concepts
- 25-45: Minimal understanding
- 0-20: Incorrect or unrelated

Current score: ${currentScore}. Only increase, never decrease. Be generous if they capture the core idea.
`;

    const messages = [
      { role: "system", content: gradingSystemPrompt },
      ...conversationHistory.map((item) => ({
        role: item.role === "tutor" ? "assistant" : "user",
        content: item.message,
      })),
    ] as ChatCompletionMessageParam[];

    const response = await openai.beta.chat.completions.parse({
      model: "gpt-4.1-nano",
      messages,
      max_tokens: 150,
      temperature: 0.3, // Lower temperature for more consistent grading
      response_format: zodResponseFormat(gradingResponseSchema, "gradingResponse"),
    });

    const parsed = response.choices[0].message.parsed;
    console.log("Grading response:", parsed);

    return parsed;
  } catch (error) {
    console.error("Error in gradeReview:", error);
    return {
      score: currentScore, // Keep current score on error
      reasoning: "Error occurred during grading",
    };
  }
}

/**
 * FEEDBACK & TRANSITION: This function generates feedback messages
 * and handles transitions to the next term based on score and attempt number.
 */
export async function generateFeedback({
  score,
  attemptNumber,
  focusTerm,
  focusDefinition,
  terms,
  conversationHistory,
}: GenerateFeedbackParams) {
  try {
    // Find the next term in the list
    const currentTermIndex = terms.findIndex(t => t.term === focusTerm);
    const nextTermObj = currentTermIndex !== -1 && currentTermIndex < terms.length - 1 
      ? terms[currentTermIndex + 1] 
      : null;
    const nextTerm = nextTermObj?.term;
    const nextTermDefinition = nextTermObj?.definition;

    let feedbackSystemPrompt = "";

    // Scenario 1: Score is 100 - Celebrate and move to next term
    if (score === 100) {
      feedbackSystemPrompt = `
You're a supportive study buddy. Be spontaneous, cheerful, humorous. Use filler words (ummm, uh, like, you know) and reactions [laughs softly].

User nailed "${focusTerm}"! 

Task: Celebrate (1 sentence), then ask a guiding question about "${nextTerm || "the next term"}".
${nextTermDefinition ? `\nNext term definition: "${nextTermDefinition}"` : ""}

Keep it 2-3 sentences, conversational and fun.
`;
    } 
    // Scenario 2: Score is not 100 but attempt is 3 - Give definition and move to next term
    else if (attemptNumber === 3) {
      feedbackSystemPrompt = `
You're a supportive study buddy. Be spontaneous, cheerful, humorous. Use filler words (ummm, uh, like, you know) and reactions [laughs softly].

User struggled with "${focusTerm}" - time to move forward.

Task: Say "Let's come back to ${focusTerm} later", provide its definition ("${focusDefinition}"), then ask a guiding question about "${nextTerm || "the next term"}".
${nextTermDefinition ? `\nNext term definition: "${nextTermDefinition}"` : ""}

Keep it 3-4 sentences, encouraging and conversational.
`;
    } 
    // Scenario 3: Score is not 100 and attempt is under 3 - Guide towards the answer
    else {
      feedbackSystemPrompt = `
You're a supportive study buddy. Be spontaneous, cheerful, humorous. Use filler words (ummm, uh, like, you know) and reactions [laughs softly].

User is working on "${focusTerm}" (Attempt #${attemptNumber}). Definition: "${focusDefinition}"

Task: Guide them toward the answer without giving it away. Point out what's right, give a hint/example, then ask a follow-up question about ${focusTerm}.

Stay focused ONLY on ${focusTerm}. Keep it 2-3 sentences, encouraging and specific.
`;
    }

    const messages = [
      { role: "system", content: feedbackSystemPrompt },
      ...conversationHistory.map((item) => ({
        role: item.role === "tutor" ? "assistant" : "user",
        content: item.message,
      })),
    ] as ChatCompletionMessageParam[];

    const response = await openai.beta.chat.completions.parse({
      model: "gpt-4.1-nano",
      messages,
      max_tokens: 200,
      temperature: 0.7,
      response_format: zodResponseFormat(feedbackResponseSchema, "feedbackResponse"),
    });

    const parsed = response.choices[0].message.parsed;
    console.log("Feedback response:", parsed);

    return parsed;
  } catch (error) {
    console.error("Error in generateFeedback:", error);
    return {
      feedbackMessage: "Great effort! Let's keep moving forward.",
    };
  }
}