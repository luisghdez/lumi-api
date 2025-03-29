import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ChatCompletionMessageParam } from "openai/resources";
import { z } from "zod";

/**
 * We create a Zod schema to parse the GPT output:
 * [
 *   {
 *     term: string;
 *     score: 0-100;
 *   },
 * ]
 */
const termStatusSchema = z.object({
  term: z.string(),
  score: z.number(),  // Adjusting the score to range from 0 to 100
});


const reviewResponseSchema = z.object({
  updatedTerms: z.array(termStatusSchema),
  feedbackMessage: z.string(),
});

// Create OpenAI client
const openai = new OpenAI();

// TypeScript interface for the service params
interface ProcessReviewParams {
  transcript: string;
  terms: Array<{ term: string; score: number }>;
  attemptNumber: number;
  conversationHistory?: Array<{ role: "user" | "tutor"; message: string }>;
}


/**
 * This function calls the OpenAI API with a structured prompt 
 * and returns updated terms & feedback message.
 */
export async function processReviewService({
  transcript,
  terms,
  attemptNumber,
  conversationHistory,
}: ProcessReviewParams) {
  console.log("log the progress passed in the function", terms);

  try {
    // Construct a system message that instructs GPT to return valid JSON
    const systemInstructions = `
    You are a friendly, concise AI tutor—like a supportive friend.
    The speech should feel spontaneous, cheerful, and humorous.
    
    When generating the feedbackMessage:
    • Your job is to respond to provided text as if it’s being spoken casually by a friendly, playful AI tutor who sounds more like a friend than a formal teacher. The speech should feel spontaneous, cheerful, and lightly humorous but not overdone—like someone who's smart but not trying too hard.

    • Use gentle humor, friendly curiosity, and encouragement—but **avoid using modern slang or trendy expressions**. For example do not use ‘vibe’.
    • Use small reactions limited to ([laughs softly], [pause], [clears throat]).
    • Use capitalized words for emphasis.
    • Include the occasional natural filler words like “uh,” “like,” “you know,” or “I mean,” where they make sense—but don’t force them. Think: a friend who laughs with you when you’re unsure, then gently nudges you to keep exploring the idea.

    
    Scoring for "updatedTerms":
    1. Score each term (0–100) based on the overall explanation in the conversation:
       - 100: Solid undertstanding. (should be easy for the user to get 100)
       - 0: No attempt or completely off-track.
       - 1–99: Some understanding, but missing key details. Provide a hint on how to reach 100.
    2. Existing scores must not decrease.
    3. The "updatedTerms" array must match the length of the incoming "terms" array.
    4. For any 0 score, include a brief, encouraging clue.
    
    Current Session Context:
      Attempt Number: ${attemptNumber}
      Terms and Scores:
      ${terms.map((t) => `- ${t.term} (score: ${t.score})`).join("\n")}
    `;
    
      
          // Construct the full messages array with system instructions, conversation history, and the current user message.
          const messages = [
            { role: "system", content: systemInstructions },
            ...((conversationHistory || []).map((item) => ({
              role: item.role === "tutor" ? "assistant" : "user",
              content: item.message,
            }))),
          ] as ChatCompletionMessageParam[];
          
      
          // Call GPT with Zod-based structured output
          const response = await openai.beta.chat.completions.parse({
            model: "gpt-4o-mini",
            messages,
            max_tokens: 1000,
            response_format: zodResponseFormat(reviewResponseSchema, "reviewResponse"),
          });
      
          // Extract structured result from GPT
          const parsed = response.choices[0].message.parsed;
          console.log("Parsed response:", parsed);
      
          // parsed will be { updatedTerms: [...], feedbackMessage: "..." }
          return parsed;
        } catch (error) {
          console.error("Error in processReviewService:", error);
          // Fallback: return safe defaults
          return {
            updatedTerms: terms, // fallback to same statuses
            feedbackMessage: "There was an error processing your request. Please try again later.",
          };
        }
      }