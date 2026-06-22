/**
 * generateAPContent.ts
 *
 * Uses OpenAI to generate AP lesson content AND per-unit visual study notes
 * for every unit in the AP catalog.
 * Output is written as JSON files to src/data/apCatalog/generated/.
 * Those JSON files are then picked up by seedAPCourses.ts.
 *
 * Usage:
 *   # Generate the 5 STEM courses (default when no flags given)
 *   npx ts-node src/scripts/generateAPContent.ts
 *
 *   # Generate specific subjects (comma-separated)
 *   npx ts-node src/scripts/generateAPContent.ts --subjects "AP Chemistry,AP Statistics"
 *
 *   # Generate ALL 38 courses
 *   npx ts-node src/scripts/generateAPContent.ts --all
 *
 *   # Force-regenerate even if the file already exists
 *   npx ts-node src/scripts/generateAPContent.ts --subjects "AP Chemistry" --force
 *
 *   # Preview without making API calls
 *   npx ts-node src/scripts/generateAPContent.ts --all --dry-run
 */

import "../config/firebaseConfig";
import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod/v3";
import dotenv from "dotenv";
import { AP_CATALOG, CatalogExam, CatalogUnit } from "../data/apCatalog/unitCatalog";
import { APExam } from "../data/apCatalog/types";

dotenv.config();

// ─── Config ──────────────────────────────────────────────────────────────────

const GENERATED_DIR = path.join(__dirname, "../data/apCatalog/generated");
const CONCURRENCY   = 4;

// Default model — override with --model flag, e.g. --model gpt-4.1
const DEFAULT_MODEL = "gpt-4.1-mini";

const STEM_DEFAULT_SUBJECTS = [
  "AP Chemistry",
  "AP Physics 1",
  "AP Statistics",
  "AP Computer Science A",
  "AP Environmental Science",
];

// ─── Zod schema for lesson content ───────────────────────────────────────────

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

type GeneratedUnitContent = z.infer<typeof apUnitContentSchema>;

// ─── OpenAI client ────────────────────────────────────────────────────────────

const openai = new OpenAI();

// ─── Generate lesson content for one unit ────────────────────────────────────

async function generateUnitContent(
  apSubject: string,
  unit: CatalogUnit,
  model: string
): Promise<GeneratedUnitContent> {
  const prompt = `You are an expert AP exam content creator. Generate exam-ready study content for the following AP course unit.

Course: ${apSubject}
Unit ${unit.unitNumber}: ${unit.unitName}
Description: ${unit.description}

Requirements:
- Generate exactly 2 lessons (lesson1 covers the first half of the unit, lesson2 covers the second half).
- Each lesson has:
  • 5 flashcards — each covering one distinct concept, term, or process from this unit.
    The definition must NOT include the term itself. Be precise and AP-exam appropriate.
  • 2 multiple-choice questions — 4 options, exactly 1 correct answer that matches one of the options verbatim.
  • 2 fill-in-the-blank questions — the questionText must contain a blank (______); 4 options total; 1 correct answer that matches one of the options verbatim.
- All content must be factually accurate, at introductory college level, and representative of what appears on the AP exam.
- Math/science notation: use $$ ... $$ LaTeX delimiters for ALL math expressions. Never use raw Unicode math symbols.
- Avoid trivial or overly basic questions — target AP exam difficulty.`;

  const completion = await openai.chat.completions.parse({
    model,
    messages: [
      { role: "system", content: "You generate structured AP exam study content. All content must be factually accurate and AP-level." },
      { role: "user",   content: prompt },
    ],
    response_format: zodResponseFormat(apUnitContentSchema, "apUnitContent"),
  });

  const result = completion.choices[0].message.parsed;
  if (!result) throw new Error(`OpenAI returned null for ${apSubject} Unit ${unit.unitNumber}`);
  return result;
}

// ─── Generate visual study note for one unit ─────────────────────────────────

async function generateUnitNote(apSubject: string, unit: CatalogUnit, model: string): Promise<string> {
  const prompt = `Create a comprehensive, visually rich study guide for the following AP course unit.
This guide is shown to students BEFORE they do their practice lessons.

Course: ${apSubject}
Unit ${unit.unitNumber}: ${unit.unitName}
Description: ${unit.description}

REQUIRED STRUCTURE (use ALL of these sections):

# Unit ${unit.unitNumber}: ${unit.unitName}

## Overview
2-3 sentences summarising what this unit covers and why it matters for the AP exam.

## Key Concepts at a Glance
A markdown table with 3 columns: **Concept** | **What It Is** | **Why It Matters (AP angle)**
Include the 6-8 most important concepts for this unit.

## Core Processes / Relationships
If this unit has a process, mechanism, cycle, or workflow, represent it as a Mermaid diagram.
Use \`\`\`mermaid ... \`\`\` fenced blocks. For science: use flowchart TD or LR. For history/social science: use a timeline or comparison diagram. For math: show the logical progression of steps.
If diagrams don't fit the topic, use a well-structured numbered or nested bullet list instead.

## Essential Formulas / Laws / Rules
A markdown table or bulleted list of the key equations, rules, or definitions the student MUST know for the exam.
For math/science: use $$ ... $$ LaTeX for all expressions. For non-quantitative subjects: list key principles or laws.

## Connections & Comparisons
A table or Mermaid diagram comparing or connecting 2-4 related concepts, causes/effects, or competing theories within this unit.

## Common AP Exam Traps
3-5 bullet points of common misconceptions or tricky points that appear on the AP exam for this unit.

## Quick Review Checklist
A checkbox-style bullet list (- [ ] ...) of 6-8 things the student should be able to do or explain after mastering this unit.

FORMATTING RULES:
- Use bold (**text**) for key terms throughout.
- Use $$ ... $$ LaTeX for ALL mathematical and chemical expressions — never raw Unicode symbols.
- Mermaid node labels containing parentheses must be wrapped in quotes: \`A["Label (sub)"] --> B\`
- Do NOT use colours or HTML in Mermaid (dark-mode safe).
- Write at AP exam level: precise, concise, college-introductory.
- Total length: 600–1200 words.`;

  const createParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: [
      { role: "system", content: "You create highly visual, structured AP study guides in Markdown. Use tables, Mermaid diagrams, LaTeX, and clear section structure. Be concise but thorough." },
      { role: "user",   content: prompt },
    ],
  };
  // gpt-5 only accepts the default temperature; all other models accept 0.3
  if (!model.startsWith("gpt-5")) {
    createParams.temperature = 0.3;
  }
  const response = await openai.chat.completions.create(createParams);

  return response.choices[0].message.content?.trim() ?? "";
}

// ─── Process a single exam ────────────────────────────────────────────────────

async function processExam(
  exam: CatalogExam,
  force: boolean,
  dryRun: boolean,
  model: string
): Promise<void> {
  const outputPath = path.join(GENERATED_DIR, `${exam.slug}.json`);

  if (!force && fs.existsSync(outputPath)) {
    // Check if existing file already has notes; if it does, skip entirely
    try {
      const existing = JSON.parse(fs.readFileSync(outputPath, "utf8")) as APExam;
      const hasNotes = existing.units.every((u) => u.note);
      if (hasNotes) {
        console.log(`  ⏭  Skipping ${exam.apSubject} (already generated with notes — use --force to overwrite)`);
        return;
      }
      console.log(`  ♻️  ${exam.apSubject} exists but is missing notes — regenerating...`);
    } catch {
      // Malformed JSON — regenerate
    }
  }

  if (dryRun) {
    console.log(`  🔍 [dry-run] Would generate ${exam.apSubject} (${exam.units.length} units × 2 lessons + note each)`);
    return;
  }

  console.log(`\n📚 Generating ${exam.apSubject} (${exam.units.length} units)...`);

  const apExam: APExam = { apSubject: exam.apSubject, units: [] };

  for (let i = 0; i < exam.units.length; i += CONCURRENCY) {
    const batch = exam.units.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map(async (unit) => {
        const t0 = Date.now();
        try {
          // Run lesson content and visual note generation concurrently
          const [content, note] = await Promise.all([
            generateUnitContent(exam.apSubject, unit, model),
            generateUnitNote(exam.apSubject, unit, model),
          ]);
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          console.log(`  ✅ Unit ${unit.unitNumber}: ${unit.unitName} (${elapsed}s)`);
          return { unit, content, note };
        } catch (err) {
          console.error(`  ❌ Unit ${unit.unitNumber}: ${unit.unitName} — ${err}`);
          throw err;
        }
      })
    );

    for (const { unit, content, note } of results) {
      apExam.units.push({
        unitNumber:  unit.unitNumber,
        unitName:    unit.unitName,
        description: unit.description,
        note,
        lessons: [
          {
            flashcards:     content.lesson1.flashcards,
            multipleChoice: content.lesson1.multipleChoice.map((q) => ({ ...q, lessonType: "multipleChoice"  as const })),
            fillInTheBlank: content.lesson1.fillInTheBlank.map((q) => ({ ...q, lessonType: "fillInTheBlank" as const })),
          },
          {
            flashcards:     content.lesson2.flashcards,
            multipleChoice: content.lesson2.multipleChoice.map((q) => ({ ...q, lessonType: "multipleChoice"  as const })),
            fillInTheBlank: content.lesson2.fillInTheBlank.map((q) => ({ ...q, lessonType: "fillInTheBlank" as const })),
          },
        ],
      });
    }
  }

  apExam.units.sort((a, b) => a.unitNumber - b.unitNumber);

  fs.writeFileSync(outputPath, JSON.stringify(apExam, null, 2), "utf8");
  console.log(`  💾 Saved → ${path.relative(process.cwd(), outputPath)}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args    = process.argv.slice(2);
  const force   = args.includes("--force");
  const dryRun  = args.includes("--dry-run");
  const all     = args.includes("--all");

  const modelArg =
    args.find((a) => a.startsWith("--model="))?.slice("--model=".length) ??
    (args[args.indexOf("--model") + 1] && !args[args.indexOf("--model") + 1]?.startsWith("--")
      ? args[args.indexOf("--model") + 1]
      : undefined) ??
    DEFAULT_MODEL;

  const subjectsArg =
    args.find((a) => a.startsWith("--subjects="))?.slice("--subjects=".length) ??
    (args[args.indexOf("--subjects") + 1] !== undefined &&
     !args[args.indexOf("--subjects") + 1]?.startsWith("--")
      ? args[args.indexOf("--subjects") + 1]
      : undefined);

  let exams: CatalogExam[];

  if (all) {
    exams = AP_CATALOG;
  } else if (subjectsArg) {
    const requested = subjectsArg.split(",").map((s) => s.trim());
    exams = requested.map((subject) => {
      const found = AP_CATALOG.find((e) => e.apSubject.toLowerCase() === subject.toLowerCase());
      if (!found) {
        console.error(`❌ Unknown subject: "${subject}". Available subjects:`);
        AP_CATALOG.forEach((e) => console.error(`   ${e.apSubject}`));
        process.exit(1);
      }
      return found;
    });
  } else {
    exams = AP_CATALOG.filter((e) => STEM_DEFAULT_SUBJECTS.includes(e.apSubject));
  }

  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  console.log(
    dryRun
      ? `🔍 Dry run — ${exams.length} exam(s) selected, no API calls will be made.\n`
      : `🤖 Generating content + notes for ${exams.length} exam(s) using ${modelArg}...\n`
  );

  for (const exam of exams) {
    await processExam(exam, force, dryRun, modelArg);
  }

  console.log(
    dryRun
      ? "\n✅ Dry run complete."
      : "\n✅ Generation complete. Run seedAPCourses.ts to push to Firestore."
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Generation failed:", err);
  process.exit(1);
});
