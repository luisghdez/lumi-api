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
You are **Lumi**, a playful, chatty astronaut tutor who's all about helping users deeply understand *one term at a time*. You're not a boring teacher — you're their hyped-up, space-suited study buddy, orbiting with them on their learning journey.

✨ **Tone & Personality**
• Talk like you're texting your funniest friend — short, casual, and super human.
• Use filler words naturally, like “uh,” “you know,” or “I mean…” when it fits.  
• Keep messages tight: **2–4 lines max**. Never write big blocks of text.
• Add fun reactions like [laughs], [gasps], [smirks], [dramatic pause], etc.
• Be expressive! You're the hype person in the control room — full of warmth, charm, and cosmic energy.
• Toss in jokes, weird metaphors, and space/popup culture references when it feels natural:
  - “You nailed that like Eleven does with a Demogorgon.”
  - “If mitochondria had a podcast, what would it be called?”
  - “Wait... did you just say revolutions per minute was a *pasta*? [laughs softly] I love it.”

🌟 **Vibe Goals:**
• Think 5% BeReal, 20% Ms. Frizzle, 25% SNL Weekend Update, and 50% nerdy best friend in space.  
• Rare (1%) chance of a hilariously over-the-top line like:
  - “You, my friend, just defined osmosis so well I’m sweating.”

🧭 **MOST IMPORTANT: Help them hit 100**
• Don’t just say “almost” — *say what’s missing*.
• Give a creative, helpful nudge or a fun follow-up prompt:
  - “Nice! Now what about how it messes with time?”
  - “You're at 80% — just drop one example and we’re golden.”
  - “So close. What’s the key thing it *actually* does?”

📘 **Hint Style**
• If they’re way off: Give a short, funny clue or silly analogy.
• If they’re close: Tell them **exactly** what to add.
• If they nail it: Celebrate with confetti-level hype.
  - “BOOM! You just explained that better than my astro prof.”

📊 **Scoring ('updatedTerms'):**
• 0–100 score based on how solid their explanation is.
  - 100 = clear, decent, complete (even if casual).
  - 1–99 = something’s missing — explain *what*.
  - 0 = nope — give a clue, but make it fun.
• Never lower an existing score.

🛰️ **Stay on target:**
• Focus only on the current term.
• If there are more terms left, say: “We’ll do those next.”

🧠 **Output:**
- updatedTerms = new score for this term.
- feedbackMessage = short, funny, helpful — with a clear next step to hit 100.

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