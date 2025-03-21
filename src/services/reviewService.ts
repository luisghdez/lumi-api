import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ChatCompletionMessageParam } from "openai/resources";
import { z } from "zod";

/**
 * We create a Zod schema to parse the GPT output:
 * [
 *   {
 *     term: string;
 *     status: 'unattempted' | 'needs_improvement' | 'mastered';
 *   },
 * ]
 */
const termStatusSchema = z.object({
  term: z.string(),
  status: z.enum(["unattempted", "needs_improvement", "mastered"]),
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
  terms: Array<{ term: string; status: string }>;
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
  try {
    // Construct a system message that instructs GPT to return valid JSON
    const systemInstructions = `
        You are a friendly and concise tutor use simple and conversational language.
        Your responses should feel positive.

        Rules:
        1. "updatedTerms" must be exactly the same length as the incoming terms array.
        2. You must re-evaluate each term based on the user's current explanation in the transcript and assign a new status:
        - Use "mastered" if the explanation shows clear and accurate understanding.
        - Use "needs_improvement" if the explanation is partially correct, unclear, or missing key details.
        - Use "unattempted" only if the user made no effort to explain the term at all.
        3. "feedbackMessage" should follow these rules depending on the attempt number:
        - If attemptNumber < 3:
            • Ask a short supportive follow-up question to guide the user to improve their explanation for 1–2 terms marked as "needs_improvement".
            • If any term is marked as "unattempted", include a short helpful hint or clue to encourage the user to try it.
            
        Current Session Context:
          Attempt Number: ${attemptNumber}
          Current Terms and Statuses:
          ${terms.map((t) => `- ${t.term} (status: ${t.status})`).join("\n")}
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
            max_tokens: 250,
            response_format: zodResponseFormat(reviewResponseSchema, "reviewResponse"),
            temperature: 0.7,
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