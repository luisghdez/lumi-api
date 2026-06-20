/**
 * seedAPCourses.ts
 *
 * One Firestore course document per AP subject (e.g. "AP Biology").
 * All units are flattened into sequential lessons; each lesson carries
 * `unitNumber` and `unitName` so the client can group them visually.
 *
 * Usage:
 *   npx ts-node src/scripts/seedAPCourses.ts            # seed new subjects (skip existing)
 *   npx ts-node src/scripts/seedAPCourses.ts --update   # upsert — overwrite existing subjects
 *   npx ts-node src/scripts/seedAPCourses.ts --delete   # delete all ap_catalog courses
 */

import "../config/firebaseConfig";
import { db } from "../config/firebaseConfig";
import admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import planetThemes from "../data/planet_themes.json";
import { AP_EXAMS, APLesson, APUnit } from "../data/apCatalog/index";
import { APExam } from "../data/apCatalog/types";

const GENERATED_DIR = path.join(__dirname, "../data/apCatalog/generated");

// ─── Load generated JSON exams ────────────────────────────────────────────────

function loadGeneratedExams(): APExam[] {
  if (!fs.existsSync(GENERATED_DIR)) return [];
  return fs
    .readdirSync(GENERATED_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, f), "utf8")) as APExam);
}

/**
 * Merge hand-crafted TypeScript exams with AI-generated JSON exams.
 * Hand-crafted entries take precedence when both define the same apSubject.
 */
function getAllExams(): APExam[] {
  const handCrafted = AP_EXAMS;
  const generated   = loadGeneratedExams();
  const handCraftedSubjects = new Set(handCrafted.map((e) => e.apSubject));
  return [
    ...handCrafted,
    ...generated.filter((e) => !handCraftedSubjects.has(e.apSubject)),
  ];
}

// ─── Planet theming helpers ───────────────────────────────────────────────────

function pickPlanet(usedPlanets: Set<string>): string {
  const all       = planetThemes.planets as string[];
  const available = all.filter((p) => !usedPlanets.has(p));
  const pool      = available.length > 0 ? available : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildPlanetDescription(planetName: string, terms: string[]): string {
  const templates =
    (planetThemes.descriptions as Record<string, string[]>)["StrongReview"] ?? [];
  let template = templates[Math.floor(Math.random() * templates.length)] ?? "";
  template = template.replace("{planet}", planetName);
  template = template.replace("{term1}", terms[0] ?? "");
  template = template.replace("{term2}", terms[1] ?? "");
  template = template.replace("{term3}", terms[2] ?? "");
  return template;
}

// ─── Build one Firestore lesson doc ──────────────────────────────────────────

function buildLessonObject(
  lesson: APLesson,
  lessonNumber: number,
  unit: APUnit,
  usedPlanets: Set<string>
): Record<string, unknown> {
  const planetName = pickPlanet(usedPlanets);
  usedPlanets.add(planetName);

  const terms            = lesson.flashcards.map((fc) => fc.term);
  const planetDescription = buildPlanetDescription(planetName, terms);

  const speakOrWrite =
    lessonNumber % 2 === 0
      ? { speakQuestion: { prompt: "Explain everything you remember about this lesson.", options: terms, lessonType: "speakAll" } }
      : { writeQuestion: { prompt: "Write everything you remember about this lesson.",   options: terms, lessonType: "writeAll" } };

  return {
    lessonNumber,
    // Unit context — lets the client group and label lessons by unit
    unitNumber: unit.unitNumber,
    unitName:   unit.unitName,
    flashcards:     lesson.flashcards,
    multipleChoice: lesson.multipleChoice,
    fillInTheBlank: lesson.fillInTheBlank,
    planetName,
    planetDescription,
    ...speakOrWrite,
  };
}

// ─── Find existing course doc for an apSubject ───────────────────────────────

async function findExistingCourseId(apSubject: string): Promise<string | null> {
  const snap = await db
    .collection("courses")
    .where("courseType", "==", "ap_catalog")
    .where("apSubject", "==", apSubject)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

// ─── Generate a human-readable course description ────────────────────────────

function buildCourseDescription(exam: APExam): string {
  const unitNames = exam.units.map((u) => u.unitName);
  if (unitNames.length <= 3) return `Covers ${unitNames.join(", ")}.`;
  return `Covers ${unitNames.slice(0, 3).join(", ")}, and ${unitNames.length - 3} more unit${unitNames.length - 3 > 1 ? "s" : ""}.`;
}

// ─── Write (create or update) one course per AP subject ──────────────────────

async function writeCourse(exam: APExam, existingId: string | null): Promise<void> {
  const usedPlanets = new Set<string>();
  const lessons: Record<string, Record<string, unknown>> = {};
  let lessonCount = 0;

  // Flatten all units' lessons into sequential lesson1, lesson2, ...
  for (const unit of exam.units) {
    for (const lesson of unit.lessons) {
      lessonCount++;
      lessons[`lesson${lessonCount}`] = buildLessonObject(lesson, lessonCount, unit, usedPlanets);
    }
  }

  const mergedFlashcards = exam.units.flatMap((u) => u.lessons.flatMap((l) => l.flashcards));
  const description      = buildCourseDescription(exam);

  const courseData: Record<string, unknown> = {
    title:         exam.apSubject,
    description,
    subject:       exam.apSubject,
    courseType:    "ap_catalog",
    apSubject:     exam.apSubject,
    createdBy:     "system",
    createdByName: "Lumi",
    visibility:    "Public",
    hasEmbeddings: false,
    mergedFlashcards,
    summary:       "",
    updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
  };

  let courseRef: FirebaseFirestore.DocumentReference;

  if (existingId) {
    courseRef = db.collection("courses").doc(existingId);
    await courseRef.update(courseData);
    // Delete existing lessons before rewriting so removed lessons don't linger
    const oldLessons = await courseRef.collection("lessons").get();
    const delBatch   = db.batch();
    oldLessons.docs.forEach((d) => delBatch.delete(d.ref));
    await delBatch.commit();
  } else {
    courseRef = db.collection("courses").doc();
    await courseRef.set({
      ...courseData,
      savedCount: 0,
      createdAt:  admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Write all lessons in batches of 500 (Firestore batch limit)
  const lessonEntries = Object.entries(lessons);
  for (let i = 0; i < lessonEntries.length; i += 500) {
    const batch = db.batch();
    lessonEntries.slice(i, i + 500).forEach(([lessonId, lessonData]) => {
      batch.set(courseRef.collection("lessons").doc(lessonId), lessonData);
    });
    await batch.commit();
  }

  const action = existingId ? "Updated" : "Created";
  console.log(
    `  ✅ ${action} "${exam.apSubject}" (${lessonCount} lessons across ${exam.units.length} units) → ${courseRef.id}`
  );
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed(updateExisting: boolean): Promise<void> {
  const exams = getAllExams();
  console.log(
    updateExisting
      ? `🔄 Seeding AP catalog (update mode)... [${exams.length} subjects]\n`
      : `🌱 Seeding AP catalog (skip mode)...   [${exams.length} subjects]\n`
  );

  for (const exam of exams) {
    const existingId = await findExistingCourseId(exam.apSubject);

    if (existingId && !updateExisting) {
      console.log(
        `  ⏭  Skipping "${exam.apSubject}" (already seeded — use --update to overwrite)`
      );
      continue;
    }

    await writeCourse(exam, existingId);
  }

  console.log("\n✅ Seed complete.");
}

// ─── Delete all ap_catalog courses ───────────────────────────────────────────

async function deleteAll(): Promise<void> {
  console.log("🗑  Deleting all ap_catalog courses...\n");

  const snapshot = await db
    .collection("courses")
    .where("courseType", "==", "ap_catalog")
    .get();

  if (snapshot.empty) {
    console.log("  Nothing to delete.");
    process.exit(0);
  }

  for (const doc of snapshot.docs) {
    const data    = doc.data();
    const lessons = await doc.ref.collection("lessons").get();
    const batch   = db.batch();
    lessons.docs.forEach((l) => batch.delete(l.ref));
    await batch.commit();
    await doc.ref.delete();
    console.log(`  🗑  Deleted "${data.title ?? doc.id}" (${lessons.size} lessons)`);
  }

  console.log(`\n✅ Deleted ${snapshot.size} ap_catalog course(s).`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--delete")) {
    await deleteAll();
  } else {
    await seed(args.includes("--update"));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
