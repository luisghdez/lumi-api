import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ChatCompletionMessageParam } from "openai/resources";
import { z } from "zod/v3";

// One response is the source of both progress and learner-facing feedback.
// Keeping them together prevents a partial backend failure from updating a
// score without explaining the result (or vice versa).
const assessmentResponseSchema = z.object({
  score: z.number().finite(),
  feedbackMessage: z.string().min(1).max(700),
});

const reviewModel = process.env.REVIEW_ASSESSMENT_MODEL || "gpt-4.1-nano";

interface AssessmentParams {
  transcript: string;
  focusTerm: string;
  focusDefinition: string;
  conversationHistory: Array<{ role: "user" | "tutor"; message: string }>;
  currentScore: number;
  attemptNumber: number;
  terms: Array<{ term: string; definition?: string; score: number }>;
  model?: string;
}

export interface ReviewAssessmentResult {
  score: number;
  feedbackMessage: string;
  telemetry: {
    model: string;
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    usedFallback: boolean;
  };
}

/**
 * Assess a single learner turn and write the corresponding coaching response in
 * one model call. `REVIEW_ASSESSMENT_MODEL` is deliberately configurable so the
 * evaluation harness can compare a candidate model before it becomes default.
 */
export async function assessReview({
  transcript,
  focusTerm,
  focusDefinition,
  conversationHistory,
  currentScore,
  attemptNumber,
  terms,
  model,
}: AssessmentParams) {
  const selectedModel = model || reviewModel;
  const startedAt = Date.now();
  try {
    // The current Flutter client includes the transcript in its history before
    // submitting. Keep only a short context and avoid presenting the latest
    // explanation twice to the model.
    const boundedHistory = conversationHistory.slice(-8);
    const lastHistoryItem = boundedHistory[boundedHistory.length - 1];
    if (
      lastHistoryItem?.role === "user" &&
      lastHistoryItem.message.trim() === transcript.trim()
    ) {
      boundedHistory.pop();
    }

    const currentTermIndex = terms.findIndex((term) => term.term === focusTerm);
    const nextTerm =
      currentTermIndex !== -1 && currentTermIndex < terms.length - 1
        ? terms[currentTermIndex + 1]
        : undefined;

    const systemPrompt = `
You are Lumi, a precise and encouraging study coach.

Assess the learner's latest explanation of "${focusTerm}" against this canonical
definition: "${focusDefinition}".

Current stored score: ${currentScore}. A score must be an integer from 0 to 100
and must never be lower than the stored score. Use 100 only when the learner
captures the core meaning. Give 75–95 for a mostly correct explanation with a
minor gap, 50–70 for a partial explanation, 25–45 for minimal understanding,
and 0–20 for an incorrect or unrelated explanation.

Write feedback in 1–3 short, specific sentences. If the score is 100, celebrate
briefly and ask about the next term${nextTerm ? `, "${nextTerm.term}"` : " or invite the learner to finish"}.
If this is attempt ${attemptNumber} and it is the third or later attempt without
mastery, say that Lumi will revisit "${focusTerm}" later, state its definition
plainly, then move to the next term when one exists. Otherwise name what was
right or missing and give one focused hint. Do not use filler words, stage
directions, or bracketed reactions.
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...boundedHistory.map((item) => ({
        role: item.role === "tutor" ? "assistant" : "user",
        content: item.message,
      })),
      {
        role: "user",
        content: `Latest explanation to assess: ${transcript}`,
      },
    ] as ChatCompletionMessageParam[];

    const request = {
      model: selectedModel,
      messages,
      max_completion_tokens: 250,
      response_format: zodResponseFormat(
        assessmentResponseSchema,
        "reviewAssessment",
      ),
    };
    // GPT-5-family models require their default temperature. The legacy model
    // retains its more deterministic setting until the eval selects a default.
    if (!selectedModel.startsWith("gpt-5")) {
      (request as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming).temperature = 0.4;
    }

    const response = await openai.chat.completions.parse(request);

    const parsed = response.choices[0].message.parsed;
    if (!parsed) throw new Error("Missing parsed review assessment");

    return {
      // Never round an almost-mastered decimal response up to a perfect score.
      score: Math.max(currentScore, Math.min(100, Math.trunc(parsed.score))),
      feedbackMessage: parsed.feedbackMessage.trim(),
      telemetry: {
        model: selectedModel,
        durationMs: Date.now() - startedAt,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        usedFallback: false,
      },
    };
  } catch (error) {
    console.error("Error assessing review:", error);
    return {
      score: currentScore,
      feedbackMessage: "I couldn't review that just now. Please try explaining it once more.",
      telemetry: {
        model: selectedModel,
        durationMs: Date.now() - startedAt,
        inputTokens: 0,
        outputTokens: 0,
        usedFallback: true,
      },
    };
  }
}

// Keep each assessment bounded so a provider stall cannot leave the client
// waiting forever. The caller returns a safe fallback when this times out.
const openai = new OpenAI({
  timeout: 8000,
  maxRetries: 0,
});
