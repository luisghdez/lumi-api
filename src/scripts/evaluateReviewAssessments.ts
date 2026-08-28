/**
 * Compare review-assessment models against the labelled fixture before changing
 * REVIEW_ASSESSMENT_MODEL. This makes live API calls only with an explicit flag.
 *
 * Example:
 *   npm run evaluate:review -- --models gpt-4.1-nano,gpt-5.6-luna --confirm-live-run
 */
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { REVIEW_EVALUATION_CASES, ReviewEvaluationCase } from "../data/reviewEvaluationCases";

dotenv.config();

const { assessReview } = require("../services/reviewService") as typeof import("../services/reviewService");

const OUTPUT_ROOT = path.join(__dirname, "output/review-evaluations");

const PRICING: Record<string, { input: number; output: number }> = {
  // USD per one million text tokens. Reconfirm against official pricing before
  // interpreting a report as a production budget commitment.
  "gpt-4.1-nano": { input: 0.10, output: 0.40 },
  "gpt-5.6-luna": { input: 0.20, output: 1.20 },
};

interface CaseResult {
  id: string;
  score: number;
  feedback: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  usedFallback: boolean;
  passed: boolean;
  failures: string[];
  estimatedCostUsd?: number;
}

interface ModelResult {
  model: string;
  cases: CaseResult[];
}

function argValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * p) - 1)];
}

function requiredFeedbackFailures(
  fixture: ReviewEvaluationCase,
  feedback: string,
): string[] {
  const failures: string[] = [];
  const normalized = feedback.toLowerCase();
  for (const fragment of fixture.requiredFeedbackFragments ?? []) {
    if (!normalized.includes(fragment.toLowerCase())) {
      failures.push(`feedback is missing required fragment: ${fragment}`);
    }
  }
  if (/\[[^\]]+\]/.test(feedback)) {
    failures.push("feedback contains a bracketed stage direction");
  }
  return failures;
}

async function evaluateCase(model: string, fixture: ReviewEvaluationCase): Promise<CaseResult> {
  const assessment = await assessReview({
    model,
    transcript: fixture.transcript,
    focusTerm: fixture.term,
    focusDefinition: fixture.definition,
    currentScore: fixture.currentScore,
    attemptNumber: fixture.attemptNumber,
    conversationHistory: [],
    terms: [
      { term: fixture.term, definition: fixture.definition, score: fixture.currentScore },
      { term: "next concept", definition: "a placeholder next concept for transition behavior", score: 0 },
    ],
  });

  const failures = requiredFeedbackFailures(fixture, assessment.feedbackMessage);
  if (assessment.telemetry.usedFallback) failures.push("assessment used fallback response");
  if (assessment.score < fixture.expectedScore.min || assessment.score > fixture.expectedScore.max) {
    failures.push(
      `score ${assessment.score} outside expected ${fixture.expectedScore.min}–${fixture.expectedScore.max}`,
    );
  }

  const pricing = PRICING[model];
  const estimatedCostUsd = pricing
    ? (assessment.telemetry.inputTokens / 1_000_000) * pricing.input +
      (assessment.telemetry.outputTokens / 1_000_000) * pricing.output
    : undefined;

  return {
    id: fixture.id,
    score: assessment.score,
    feedback: assessment.feedbackMessage,
    durationMs: assessment.telemetry.durationMs,
    inputTokens: assessment.telemetry.inputTokens,
    outputTokens: assessment.telemetry.outputTokens,
    usedFallback: assessment.telemetry.usedFallback,
    passed: failures.length === 0,
    failures,
    estimatedCostUsd,
  };
}

async function evaluateModel(model: string, fixtures: ReviewEvaluationCase[]): Promise<ModelResult> {
  const cases: CaseResult[] = [];
  // Deliberately serial: reports are easy to correlate with provider usage and
  // the full 64-case evaluation remains safely below a burst of parallel calls.
  for (const fixture of fixtures) {
    process.stdout.write(`  ${model} · ${fixture.id}\n`);
    cases.push(await evaluateCase(model, fixture));
  }
  return { model, cases };
}

function renderSummary(results: ModelResult[]): string {
  const lines = [
    "# Lumi review-assessment evaluation",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Cases: ${REVIEW_EVALUATION_CASES.length} human-labelled explanations`,
    "",
    "| Model | Pass rate | p50 | p95 | Input tokens | Output tokens | Estimated cost | Fallbacks |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const result of results) {
    const passed = result.cases.filter((item) => item.passed).length;
    const durations = result.cases.map((item) => item.durationMs);
    const inputTokens = result.cases.reduce((sum, item) => sum + item.inputTokens, 0);
    const outputTokens = result.cases.reduce((sum, item) => sum + item.outputTokens, 0);
    const costs = result.cases.map((item) => item.estimatedCostUsd).filter((value): value is number => value !== undefined);
    const fallbacks = result.cases.filter((item) => item.usedFallback).length;
    const costText = costs.length === result.cases.length
      ? `$${costs.reduce((sum, value) => sum + value, 0).toFixed(4)}`
      : "price not configured";
    lines.push(
      `| ${result.model} | ${passed}/${result.cases.length} | ${percentile(durations, 0.5)} ms | ${percentile(durations, 0.95)} ms | ${inputTokens} | ${outputTokens} | ${costText} | ${fallbacks} |`,
    );
  }

  lines.push("", "## Failures", "");
  for (const result of results) {
    const failures = result.cases.filter((item) => !item.passed);
    lines.push(`### ${result.model}`);
    if (failures.length === 0) {
      lines.push("All automated gates passed.", "");
      continue;
    }
    for (const failure of failures) {
      lines.push(`- \`${failure.id}\`: ${failure.failures.join("; ")}`);
    }
    lines.push("");
  }

  lines.push(
    "## Review instructions",
    "",
    "Automated score ranges catch regressions; review the saved JSON feedback for specificity, encouragement, and age-appropriate language before selecting a default model.",
  );
  return lines.join("\n");
}

async function main(): Promise<void> {
  if (!hasFlag("--confirm-live-run")) {
    throw new Error("Refusing to make paid model calls. Re-run with --confirm-live-run after reviewing model selection and cost.");
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to run the live evaluation.");
  }

  const models = (argValue("--models") || "gpt-4.1-nano,gpt-5.6-luna")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const limitText = argValue("--limit");
  const limit = limitText ? Number.parseInt(limitText, 10) : REVIEW_EVALUATION_CASES.length;
  if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit must be a positive integer");
  const fixtures = REVIEW_EVALUATION_CASES.slice(0, limit);

  const results: ModelResult[] = [];
  for (const model of models) results.push(await evaluateModel(model, fixtures));

  const directory = path.join(OUTPUT_ROOT, new Date().toISOString().replace(/[:.]/g, "-"));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(directory, "summary.md"), renderSummary(results));
  console.log(`\nSaved evaluation report to ${directory}`);
}

main().catch((error) => {
  console.error("Review evaluation failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});

