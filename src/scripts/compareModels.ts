/**
 * compareModels.ts
 *
 * Runs the same AP unit through multiple OpenAI models and saves the outputs
 * side by side so you can inspect quality before committing to full generation.
 *
 * Usage:
 *   npx ts-node src/scripts/compareModels.ts
 *
 *   # Compare a specific subject / unit
 *   npx ts-node src/scripts/compareModels.ts --subject "AP Statistics" --unit 4
 *
 * Outputs:
 *   src/scripts/output/model-comparison/
 *     summary.md            ← timing + cost table you can open immediately
 *     gpt-4.1-mini/
 *       lessons.json
 *       note.md
 *     gpt-4.1/
 *       lessons.json
 *       note.md
 *     gpt-5/
 *       lessons.json
 *       note.md
 */

import "../config/firebaseConfig";
import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod/v3";
import dotenv from "dotenv";
import { AP_CATALOG } from "../data/apCatalog/unitCatalog";

dotenv.config();

// ─── Config ──────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, "output/model-comparison");

interface ModelConfig {
  id: string;
  label: string;
  inputPricePerMillion:  number;
  outputPricePerMillion: number;
}

const MODELS: ModelConfig[] = [
  { id: "gpt-4.1-mini",  label: "gpt-4.1-mini (baseline)", inputPricePerMillion: 0.40, outputPricePerMillion:  1.60 },
  { id: "gpt-5.4-mini",  label: "gpt-5.4-mini",            inputPricePerMillion: 0.75, outputPricePerMillion:  4.50 },
  { id: "gpt-4.1",       label: "gpt-4.1",                 inputPricePerMillion: 2.00, outputPricePerMillion:  8.00 },
  { id: "gpt-5.4",       label: "gpt-5.4",                 inputPricePerMillion: 2.50, outputPricePerMillion: 15.00 },
  { id: "gpt-5.5",       label: "gpt-5.5 (flagship)",      inputPricePerMillion: 5.00, outputPricePerMillion: 30.00 },
];

// Cap output tokens on the note call to avoid runaway spend on verbose models
const MAX_NOTE_TOKENS = 4_000;

// Rough estimate: tokens per unit across both API calls (lesson content + note)
const AVG_INPUT_TOKENS_PER_UNIT  = 1_500;
const AVG_OUTPUT_TOKENS_PER_UNIT = 3_200;
// 38 courses × average 8.5 units
const TOTAL_UNITS_FULL_CATALOG = 323;

// ─── Zod schema ──────────────────────────────────────────────────────────────

const openai = new OpenAI();

const apQuestionSchema = z.object({
  questionText:  z.string(),
  options:       z.array(z.string()).length(4),
  correctAnswer: z.string(),
});

const apLessonSchema = z.object({
  flashcards:    z.array(z.object({ term: z.string(), definition: z.string() })).length(5),
  multipleChoice: z.array(apQuestionSchema).length(2),
  fillInTheBlank: z.array(apQuestionSchema).length(2),
});

const apUnitContentSchema = z.object({
  lesson1: apLessonSchema,
  lesson2: apLessonSchema,
});

// ─── Generation helpers ───────────────────────────────────────────────────────

async function generateLessons(
  model: string,
  apSubject: string,
  unitNumber: number,
  unitName: string,
  description: string
): Promise<{ parsed: z.infer<typeof apUnitContentSchema>; usage: OpenAI.CompletionUsage | undefined }> {
  const prompt = `You are an expert AP exam content creator. Generate exam-ready study content for the following AP course unit.

Course: ${apSubject}
Unit ${unitNumber}: ${unitName}
Description: ${description}

Requirements:
- Generate exactly 2 lessons (lesson1 covers the first half of the unit, lesson2 covers the second half).
- Each lesson has:
  • 5 flashcards — each covering one distinct concept, term, or process from this unit.
    The definition must NOT include the term itself. Be precise and AP-exam appropriate.
  • 2 multiple-choice questions — 4 options, exactly 1 correct answer that matches one of the options verbatim.
  • 2 fill-in-the-blank questions — the questionText must contain a blank (______); 4 options total; 1 correct answer that matches one of the options verbatim.
- All content must be factually accurate, at introductory college level, and representative of what appears on the AP exam.
- Math/science notation: use $$ ... $$ LaTeX delimiters for ALL math expressions.
- Avoid trivial or overly basic questions — target AP exam difficulty.`;

  const completion = await openai.chat.completions.parse({
    model,
    messages: [
      { role: "system", content: "You generate structured AP exam study content. All content must be factually accurate and AP-level." },
      { role: "user",   content: prompt },
    ],
    response_format: zodResponseFormat(apUnitContentSchema, "apUnitContent"),
  });

  return {
    parsed: completion.choices[0].message.parsed!,
    usage:  completion.usage,
  };
}

async function generateNote(
  model: string,
  apSubject: string,
  unitNumber: number,
  unitName: string,
  description: string
): Promise<{ content: string; usage: OpenAI.CompletionUsage | undefined }> {
  const prompt = `Create a comprehensive, visually rich study guide for the following AP course unit.
This guide is shown to students BEFORE they do their practice lessons.

Course: ${apSubject}
Unit ${unitNumber}: ${unitName}
Description: ${description}

REQUIRED STRUCTURE (use ALL of these sections):

# Unit ${unitNumber}: ${unitName}

## Overview
2-3 sentences summarising what this unit covers and why it matters for the AP exam.

## Key Concepts at a Glance
A markdown table with 3 columns: **Concept** | **What It Is** | **Why It Matters (AP angle)**
Include the 6-8 most important concepts for this unit.

## Core Processes / Relationships
Use a Mermaid diagram (\`\`\`mermaid ... \`\`\`) for processes/flows/hierarchies where relevant, or a well-structured list.
Mermaid node labels with parentheses must be quoted: \`A["Label (sub)"] --> B\`. Do NOT use colours.

## Essential Formulas / Laws / Rules
Key equations/rules the student MUST know. Use $$ ... $$ LaTeX for all math/science expressions.

## Connections & Comparisons
A table or diagram comparing 2-4 related concepts within this unit.

## Common AP Exam Traps
3-5 bullet points of common misconceptions or tricky exam points.

## Quick Review Checklist
Checkbox list (- [ ] ...) of 6-8 things the student should be able to do after this unit.

RULES: Bold key terms. LaTeX for all math. Mermaid diagrams must be dark-mode safe (no colours). 600-1200 words.`;

  const createParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: [
      { role: "system", content: "You create highly visual, structured AP study guides in Markdown. Use tables, Mermaid diagrams, LaTeX, and clear section structure." },
      { role: "user",   content: prompt },
    ],
  };
  // gpt-5.x and newer only accept the default temperature
  if (!model.startsWith("gpt-5")) {
    createParams.temperature = 0.3;
  }
  createParams.max_completion_tokens = MAX_NOTE_TOKENS;
  const response = await openai.chat.completions.create(createParams);

  return {
    content: response.choices[0].message.content?.trim() ?? "",
    usage:   response.usage,
  };
}

// ─── Run one model against one unit ──────────────────────────────────────────

interface ModelResult {
  model:           ModelConfig;
  lessonsMs:       number;
  noteMs:          number;
  totalMs:         number;
  lessonsTokensIn: number;
  lessonsTokensOut: number;
  noteTokensIn:    number;
  noteTokensOut:   number;
  totalTokensIn:   number;
  totalTokensOut:  number;
  callCostUSD:     number;
  lessons:         z.infer<typeof apUnitContentSchema>;
  note:            string;
  error?:          string;
}

async function runModel(
  config: ModelConfig,
  apSubject: string,
  unitNumber: number,
  unitName: string,
  description: string
): Promise<ModelResult> {
  const t0 = Date.now();
  let lessonsMs = 0, noteMs = 0;
  let lessonsTokensIn = 0, lessonsTokensOut = 0;
  let noteTokensIn = 0, noteTokensOut = 0;

  let lessons!: z.infer<typeof apUnitContentSchema>;
  let note = "";

  try {
    // Run both calls concurrently
    const tL = Date.now();
    const [lessonsResult, noteResult] = await Promise.all([
      generateLessons(config.id, apSubject, unitNumber, unitName, description),
      generateNote(config.id, apSubject, unitNumber, unitName, description),
    ]);
    lessonsMs = Date.now() - tL;
    noteMs    = lessonsMs; // concurrent, same wall time

    lessons          = lessonsResult.parsed;
    note             = noteResult.content;
    lessonsTokensIn  = lessonsResult.usage?.prompt_tokens     ?? 0;
    lessonsTokensOut = lessonsResult.usage?.completion_tokens ?? 0;
    noteTokensIn     = noteResult.usage?.prompt_tokens        ?? 0;
    noteTokensOut    = noteResult.usage?.completion_tokens    ?? 0;
  } catch (err) {
    return {
      model: config, lessonsMs: 0, noteMs: 0, totalMs: Date.now() - t0,
      lessonsTokensIn: 0, lessonsTokensOut: 0, noteTokensIn: 0, noteTokensOut: 0,
      totalTokensIn: 0, totalTokensOut: 0, callCostUSD: 0,
      lessons: {} as any, note: "", error: String(err),
    };
  }

  const totalTokensIn  = lessonsTokensIn + noteTokensIn;
  const totalTokensOut = lessonsTokensOut + noteTokensOut;
  const callCostUSD    =
    (totalTokensIn  / 1_000_000) * config.inputPricePerMillion +
    (totalTokensOut / 1_000_000) * config.outputPricePerMillion;

  return {
    model: config,
    lessonsMs, noteMs,
    totalMs: Date.now() - t0,
    lessonsTokensIn, lessonsTokensOut,
    noteTokensIn, noteTokensOut,
    totalTokensIn, totalTokensOut,
    callCostUSD,
    lessons, note,
  };
}

// ─── Render markdown summary ──────────────────────────────────────────────────

function renderSummary(
  results: ModelResult[],
  apSubject: string,
  unitNumber: number,
  unitName: string
): string {
  const lines: string[] = [
    `# Model Comparison — ${apSubject} · Unit ${unitNumber}: ${unitName}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Per-Request Results",
    "",
    "| Model | Time (s) | Input tokens | Output tokens | Cost for this unit |",
    "|---|---|---|---|---|",
  ];

  for (const r of results) {
    if (r.error) {
      lines.push(`| ${r.model.label} | ❌ ERROR | — | — | ${r.error} |`);
    } else {
      lines.push(
        `| ${r.model.label} | ${(r.totalMs / 1000).toFixed(1)} | ${r.totalTokensIn.toLocaleString()} | ${r.totalTokensOut.toLocaleString()} | $${r.callCostUSD.toFixed(4)} |`
      );
    }
  }

  lines.push("");
  lines.push("## Projected Cost — Full Catalog (38 courses, ~323 units)");
  lines.push("");
  lines.push("*Based on actual token usage from this unit scaled to the full catalog.*");
  lines.push("");
  lines.push("| Model | Est. total cost | Est. time (4× concurrency) |");
  lines.push("|---|---|---|");

  for (const r of results) {
    if (r.error) continue;
    const scaledCost = r.callCostUSD * TOTAL_UNITS_FULL_CATALOG;
    // Rough time: CONCURRENCY=4, so groups of 4 units per exam, ~8.5 units avg → 3 batches per exam × 38 exams
    const batchesTotal     = Math.ceil(TOTAL_UNITS_FULL_CATALOG / 4);
    const estTimeSecs      = batchesTotal * (r.totalMs / 1000);
    const estTimeFormatted = estTimeSecs > 120
      ? `~${(estTimeSecs / 60).toFixed(0)} min`
      : `~${estTimeSecs.toFixed(0)}s`;
    lines.push(`| ${r.model.label} | **$${scaledCost.toFixed(2)}** | ${estTimeFormatted} |`);
  }

  lines.push("");
  lines.push("## Output Quality — Inspect the files below");
  lines.push("");
  lines.push("Each model's outputs are saved next to this file:");
  lines.push("");
  for (const r of results) {
    if (r.error) continue;
    lines.push(`- \`${r.model.id}/lessons.json\` — flashcards, MCQ, fill-in-the-blank`);
    lines.push(`- \`${r.model.id}/note.md\` — unit study guide (tables, Mermaid, LaTeX)`);
  }

  lines.push("");
  lines.push("## Quick Content Metrics");
  lines.push("");
  lines.push("| Model | Note length (chars) | Has Mermaid | Has LaTeX | Has table | Has checklist |");
  lines.push("|---|---|---|---|---|---|");

  for (const r of results) {
    if (r.error) continue;
    const note = r.note;
    lines.push(
      `| ${r.model.label} | ${note.length.toLocaleString()} | ${note.includes("```mermaid") ? "✅" : "❌"} | ${note.includes("$$") ? "✅" : "❌"} | ${note.includes("|---|") ? "✅" : "❌"} | ${note.includes("- [ ]") ? "✅" : "❌"} |`
    );
  }

  lines.push("");
  lines.push("## Recommendation");
  lines.push("");
  lines.push("Review the note.md and lessons.json files in each model folder, then run generation with your chosen model:");
  lines.push("");
  lines.push("```bash");
  lines.push("npx ts-node src/scripts/generateAPContent.ts --model gpt-4.1 --force");
  lines.push("```");

  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const subjectArg = args.find((a) => a.startsWith("--subject="))?.slice("--subject=".length)
    ?? (args[args.indexOf("--subject") + 1] && !args[args.indexOf("--subject") + 1].startsWith("--")
        ? args[args.indexOf("--subject") + 1]
        : undefined)
    ?? "AP Chemistry";

  const unitArg = parseInt(
    args.find((a) => a.startsWith("--unit="))?.slice("--unit=".length) ??
    (args[args.indexOf("--unit") + 1] ?? "1"),
    10
  );

  const exam = AP_CATALOG.find((e) => e.apSubject.toLowerCase() === subjectArg.toLowerCase());
  if (!exam) {
    console.error(`❌ Unknown subject: "${subjectArg}"`);
    process.exit(1);
  }

  const unit = exam.units.find((u) => u.unitNumber === unitArg);
  if (!unit) {
    console.error(`❌ Unit ${unitArg} not found in ${exam.apSubject}`);
    process.exit(1);
  }

  console.log(`\n🔬 Comparing models for: ${exam.apSubject} · Unit ${unit.unitNumber}: ${unit.unitName}`);
  console.log(`   Models: ${MODELS.map((m) => m.id).join(", ")}\n`);

  // Run all models concurrently
  const results = await Promise.all(
    MODELS.map(async (config) => {
      const t0 = Date.now();
      process.stdout.write(`  ⏳ ${config.label}...`);
      const result = await runModel(config, exam.apSubject, unit.unitNumber, unit.unitName, unit.description);
      process.stdout.write(
        result.error
          ? ` ❌ ${result.error}\n`
          : ` ✅ ${(result.totalMs / 1000).toFixed(1)}s  $${result.callCostUSD.toFixed(4)}\n`
      );
      return result;
    })
  );

  // Write outputs
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const r of results) {
    if (r.error) continue;
    const modelDir = path.join(OUTPUT_DIR, r.model.id);
    fs.mkdirSync(modelDir, { recursive: true });
    fs.writeFileSync(path.join(modelDir, "lessons.json"), JSON.stringify(r.lessons, null, 2), "utf8");
    fs.writeFileSync(path.join(modelDir, "note.md"),      r.note, "utf8");
  }

  const summary = renderSummary(results, exam.apSubject, unit.unitNumber, unit.unitName);
  const summaryPath = path.join(OUTPUT_DIR, "summary.md");
  fs.writeFileSync(summaryPath, summary, "utf8");

  console.log(`\n📁 Results saved to: ${path.relative(process.cwd(), OUTPUT_DIR)}/`);
  console.log(`   Open summary.md to see the cost + quality table.`);

  // Print the summary inline too
  console.log("\n" + summary);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Comparison failed:", err);
  process.exit(1);
});
