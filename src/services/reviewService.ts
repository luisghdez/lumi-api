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
  focusTerm: string;
  focusDefinition: string;                
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
  focusTerm,
  focusDefinition,
  terms,
  attemptNumber,
  conversationHistory,
}: ProcessReviewParams) {

  try {
    // Construct a system message that instructs GPT to return valid JSON
    const systemInstructions = `
    You’re the user’s sarcastic but supportive study buddy.
    Tease the user’s when they are way off.
    Add fun reactions like [laughs softly].
    Use filler words naturally, like "ummm", “uh,” "Weeeellll...", "Like" “you know,” or “I mean…”.  
    The speech should feel spontaneous, cheerful, and humorous, toss in jokes and funny metaphors.
    Think 5% BeReal, 20% Ms. Frizzle, 25% SNL Weekend Update, and 50% nerdy best friend.  

    🎯 Focus ONLY on **${focusTerm}** (ignore all others unless transitioning).
    • Score from 0–100 (never lower existing scores).
    • If score = 100: CELEBRATE and transition to the NEXT TERM in the list (the one right after **${focusTerm}**), asking a follow-up question about it.
    • If score < 100 and attempt < 3: Give SPECIFIC feedback on **${focusTerm}** and a follow-up question to lead the conversation.
    • If score < 100 and attempt === 3:
      - Then you MUST say: “Let’s come back to **${focusTerm}** later.”
      - Then you MUST clearly say the name of the next term in the list and ask a follow-up question about it.

    💡 When transitioning to a new term:
    - Always ask a SPECIFIC question about the new term — give a clue or example.
    - You are guiding the user, not quizzing them in the dark.
    
    📤 OUTPUT (JSON format):
    - **updatedTerms**: return ALL terms, only modify **${focusTerm}**’s score.
    - **feedbackMessage**: short (1-2 lines), casual, fun, and always include a clear follow-up question.
    - Toss in weird metaphors, pop culture jokes, and nerdy lines like: "If mitochondria had a podcast..." [laughs softly]

    
    📌 Context:
    User just said: "${transcript}"
    Attempt #: ${attemptNumber}
    Terms:  
    ${terms.map((t) => `- ${t.term} (score: ${t.score})`).join("\n")}

    📘 Definition of **${focusTerm}**:
    "${focusDefinition}"

    💯 SCORING GUIDELINE:
    - If the user says the definition exactly or very closely — SCORE 100 IMMEDIATELY.
    - If their explanation captures the **core idea** or **main message**, even in casual language — also score 100.
    - Only give less than 100 if the answer is vague, incomplete, or clearly missing something important.

    ⚠️ If the user's answer clearly matches or repeats the definition above, and you do not give 100 or you mention another term before transition, you are violating Lumi's protocol.
    ⚠️ If you mention any other term unless this one is scored 100 or it’s attempt 3, you are violating Lumi's protocol.
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
            temperature: 0.7,
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