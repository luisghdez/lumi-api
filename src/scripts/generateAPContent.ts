/**
 * generateAPContent.ts
 *
 * Uses OpenAI structured output to generate AP lesson content (flashcards,
 * multiple-choice, fill-in-the-blank) for every unit in the AP catalog.
 * Output is written as JSON files to src/data/apCatalog/generated/.
 * Those JSON files are then picked up by seedAPCourses.ts.
 *
 * Usage:
 *   # Generate the 5 STEM courses (default when no flags given)
 *   npx ts-node src/scripts/generateAPContent.ts
 *
 *   # Generate specific subjects (comma-separated, must match apSubject in unitCatalog)
 *   npx ts-node src/scripts/generateAPContent.ts --subjects "AP Chemistry,AP Statistics"
 *
 *   # Generate ALL 38 courses (~$0.70, ~3 min)
 *   npx ts-node src/scripts/generateAPContent.ts --all
 *
 *   # Force-regenerate even if the file already exists
 *   npx ts-node src/scripts/generateAPContent.ts --subjects "AP Chemistry" --force
 *
 *   # Preview what would run without making API calls
 *   npx ts-node src/scripts/generateAPContent.ts --all --dry-run
 */

import "../config/firebaseConfig"; // not needed here but keeps imports consistent
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
const CONCURRENCY = 4; // parallel OpenAI requests per exam
const MODEL = "gpt-4.1-mini";

const STEM_DEFAULT_SUBJECTS = [
  "AP Chemistry",
  "AP Physics 1",
  "AP Statistics",
  "AP Computer Science A",
  "AP Environmental Science",
];

// ─── Zod schema for one AP lesson ────────────────────────────────────────────

const apQuestionSchema = z.object({
  questionText: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswer: z.string(),
});

const apLessonSchema = z.object({
  flashcards: z.array(
    z.object({ term: z.string(), definition: z.string() })
  ).length(5),
  multipleChoice: z.array(apQuestionSchema).length(2),
  fillInTheBlank: z.array(apQuestionSchema).length(2),
});

const apUnitContentSchema = z.object({
  lesson1: apLessonSchema,
  lesson2: apLessonSchema,
});

type GeneratedUnitContent = z.infer<typeof apUnitContentSchema>;

// ─── OpenAI client ───────────────────────────────────────────────────────────

const openai = new OpenAI();

// ─── Generate content for one unit ───────────────────────────────────────────

async function generateUnitContent(
  apSubject: string,
  unit: CatalogUnit
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
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You generate structured AP exam study content. Respond only with the structured JSON as specified. All content must be factually accurate and AP-level.",
      },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(apUnitContentSchema, "apUnitContent"),
  });

  const result = completion.choices[0].message.parsed;
  if (!result) throw new Error(`OpenAI returned null for ${apSubject} Unit ${unit.unitNumber}`);
  return result;
}

// ─── Process a single exam ────────────────────────────────────────────────────

async function processExam(
  exam: CatalogExam,
  force: boolean,
  dryRun: boolean
): Promise<void> {
  const outputPath = path.join(GENERATED_DIR, `${exam.slug}.json`);

  if (!force && fs.existsSync(outputPath)) {
    console.log(`  ⏭  Skipping ${exam.apSubject} (already generated — use --force to overwrite)`);
    return;
  }

  if (dryRun) {
    console.log(`  🔍 [dry-run] Would generate ${exam.apSubject} (${exam.units.length} units × 2 lessons)`);
    return;
  }

  console.log(`\n📚 Generating ${exam.apSubject} (${exam.units.length} units)...`);

  const apExam: APExam = {
    apSubject: exam.apSubject,
    units: [],
  };

  // Process units in batches of CONCURRENCY
  for (let i = 0; i < exam.units.length; i += CONCURRENCY) {
    const batch = exam.units.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map(async (unit) => {
        const t0 = Date.now();
        try {
          const content = await generateUnitContent(exam.apSubject, unit);
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          console.log(`  ✅ Unit ${unit.unitNumber}: ${unit.unitName} (${elapsed}s)`);
          return { unit, content };
        } catch (err) {
          console.error(`  ❌ Unit ${unit.unitNumber}: ${unit.unitName} — ${err}`);
          throw err;
        }
      })
    );

    for (const { unit, content } of results) {
      apExam.units.push({
        unitNumber: unit.unitNumber,
        unitName: unit.unitName,
        description: unit.description,
        lessons: [
          {
            flashcards:     content.lesson1.flashcards,
            multipleChoice: content.lesson1.multipleChoice.map((q) => ({
              ...q,
              lessonType: "multipleChoice" as const,
            })),
            fillInTheBlank: content.lesson1.fillInTheBlank.map((q) => ({
              ...q,
              lessonType: "fillInTheBlank" as const,
            })),
          },
          {
            flashcards:     content.lesson2.flashcards,
            multipleChoice: content.lesson2.multipleChoice.map((q) => ({
              ...q,
              lessonType: "multipleChoice" as const,
            })),
            fillInTheBlank: content.lesson2.fillInTheBlank.map((q) => ({
              ...q,
              lessonType: "fillInTheBlank" as const,
            })),
          },
        ],
      });
    }
  }

  // Sort units by unitNumber before writing
  apExam.units.sort((a, b) => a.unitNumber - b.unitNumber);

  fs.writeFileSync(outputPath, JSON.stringify(apExam, null, 2), "utf8");
  console.log(`  💾 Saved → ${path.relative(process.cwd(), outputPath)}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force  = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const all    = args.includes("--all");

  const subjectsArg = args.find((a) => a.startsWith("--subjects="))?.slice("--subjects=".length)
    ?? (args[args.indexOf("--subjects") + 1] !== undefined && !args[args.indexOf("--subjects") + 1].startsWith("--")
        ? args[args.indexOf("--subjects") + 1]
        : undefined);

  let exams: CatalogExam[];

  if (all) {
    exams = AP_CATALOG;
  } else if (subjectsArg) {
    const requested = subjectsArg.split(",").map((s) => s.trim());
    exams = requested.map((subject) => {
      const found = AP_CATALOG.find(
        (e) => e.apSubject.toLowerCase() === subject.toLowerCase()
      );
      if (!found) {
        console.error(`❌ Unknown subject: "${subject}". Available subjects:`);
        AP_CATALOG.forEach((e) => console.error(`   ${e.apSubject}`));
        process.exit(1);
      }
      return found;
    });
  } else {
    // Default: STEM subset
    exams = AP_CATALOG.filter((e) =>
      STEM_DEFAULT_SUBJECTS.includes(e.apSubject)
    );
  }

  // Ensure output directory exists
  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  console.log(
    dryRun
      ? `🔍 Dry run — ${exams.length} exam(s) selected, no API calls will be made.\n`
      : `🤖 Generating content for ${exams.length} exam(s) using ${MODEL}...\n`
  );

  for (const exam of exams) {
    await processExam(exam, force, dryRun);
  }

  console.log(
    dryRun
      ? "\n✅ Dry run complete."
      : "\n✅ Content generation complete. Run seedAPCourses.ts to push to Firestore."
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Generation failed:", err);
  process.exit(1);
});
