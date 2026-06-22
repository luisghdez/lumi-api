/**
 * deleteBrokenCourses.ts
 *
 * Two-pass clean-up:
 *
 * Pass 1 — courses collection:
 *   Deletes any course doc whose title is missing or "Untitled",
 *   including its lessons/notes subcollections and all users' savedCourses entries.
 *
 * Pass 2 — each user's savedCourses subcollection:
 *   Deletes any savedCourse entry that is:
 *     a) untitled / has an empty title in the saved doc itself, OR
 *     b) orphaned — its courseId no longer exists in the courses collection
 *
 * Usage:
 *   npx ts-node src/scripts/deleteBrokenCourses.ts --dry-run   # preview only
 *   npx ts-node src/scripts/deleteBrokenCourses.ts              # delete for real
 */

import "../config/firebaseConfig";
import { db } from "../config/firebaseConfig";

const isDryRun = process.argv.includes("--dry-run");

// Safety cap — abort if more entries than expected are found.
// Verified from dry-run: 0 broken course docs + 27 bad savedCourses entries.
const MAX_EXPECTED = 27;

function isBadTitle(title: unknown): boolean {
  const t = ((title ?? "") as string).trim().toLowerCase();
  return !t || t === "untitled";
}

async function deleteBrokenCourses(): Promise<void> {
  console.log(isDryRun ? "🔍 DRY RUN — nothing will be deleted\n" : "🗑  Deleting broken courses…\n");

  // ── Pass 1: broken course documents ────────────────────────────────────────
  const coursesSnap = await db.collection("courses").get();
  const existingCourseIds = new Set(coursesSnap.docs.map((d) => d.id));

  const brokenCourses = coursesSnap.docs.filter((doc) =>
    isBadTitle(doc.data().title)
  );

  if (brokenCourses.length > 0) {
    console.log(`Pass 1 — Found ${brokenCourses.length} untitled course doc(s):`);
    brokenCourses.forEach((doc) =>
      console.log(`  "${doc.data().title ?? "(no title)"}" — ${doc.id}`)
    );
    console.log();
  } else {
    console.log("Pass 1 — No untitled course docs found.\n");
  }

  // ── Pass 2: sweep every user's savedCourses ─────────────────────────────
  const usersSnap = await db.collection("users").get();
  console.log(`Pass 2 — Scanning ${usersSnap.docs.length} user(s) for broken savedCourses…\n`);

  // Collect (userId, savedCourseDoc) pairs to remove
  type BadSaved = { userId: string; courseId: string; title: string; reason: string };
  const badSaved: BadSaved[] = [];

  for (const userDoc of usersSnap.docs) {
    const savedSnap = await userDoc.ref.collection("savedCourses").get();
    for (const saved of savedSnap.docs) {
      const d = saved.data();
      const courseId = d.courseId ?? saved.id;
      const title    = d.title ?? "(no title)";

      if (isBadTitle(d.title)) {
        badSaved.push({ userId: userDoc.id, courseId, title, reason: "untitled saved entry" });
      } else if (!existingCourseIds.has(courseId)) {
        badSaved.push({ userId: userDoc.id, courseId, title, reason: "orphaned (course deleted)" });
      }
    }
  }

  if (badSaved.length > 0) {
    console.log(`Pass 2 — Found ${badSaved.length} bad savedCourses entry/entries:`);
    badSaved.forEach(({ userId, courseId, title, reason }) =>
      console.log(`  [${reason}] "${title}" (${courseId}) — user ${userId}`)
    );
    console.log();
  } else {
    console.log("Pass 2 — No bad savedCourses entries found.\n");
  }

  if (brokenCourses.length === 0 && badSaved.length === 0) {
    console.log("✅ Nothing to delete.");
    process.exit(0);
  }

  const total = brokenCourses.length + badSaved.length;
  if (total > MAX_EXPECTED) {
    console.error(
      `\n🚨 Safety cap hit: found ${total} entries but expected at most ${MAX_EXPECTED}.\n` +
      `   Run --dry-run to review, then update MAX_EXPECTED if correct.`
    );
    process.exit(1);
  }

  if (isDryRun) {
    console.log("↩️  Dry run complete. Re-run without --dry-run to delete.");
    process.exit(0);
  }

  // ── Delete pass 1: broken course documents ─────────────────────────────────
  let deletedCourses = 0;
  for (const doc of brokenCourses) {
    const courseId = doc.id;
    const title    = doc.data().title ?? "(no title)";

    const [lessons, notes] = await Promise.all([
      doc.ref.collection("lessons").get(),
      doc.ref.collection("notes").get(),
    ]);
    const subBatch = db.batch();
    lessons.docs.forEach((l) => subBatch.delete(l.ref));
    notes.docs.forEach((n)   => subBatch.delete(n.ref));
    await subBatch.commit();
    await doc.ref.delete();

    // Remove from all users' savedCourses
    let userRefs = 0;
    for (const userDoc of usersSnap.docs) {
      const ref  = userDoc.ref.collection("savedCourses").doc(courseId);
      const snap = await ref.get();
      if (snap.exists) { await ref.delete(); userRefs++; }
    }

    console.log(`  🗑  [course] "${title}" (${courseId})${userRefs ? ` — cleared from ${userRefs} user(s)` : ""}`);
    deletedCourses++;
  }

  // ── Delete pass 2: bad savedCourses entries ─────────────────────────────────
  let deletedSaved = 0;
  for (const { userId, courseId, title, reason } of badSaved) {
    // Skip if already removed in pass 1
    const ref  = db.collection("users").doc(userId).collection("savedCourses").doc(courseId);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.delete();
      console.log(`  🗑  [savedCourse/${reason}] "${title}" — user ${userId}`);
      deletedSaved++;
    }
  }

  console.log(`\n✅ Done. Deleted ${deletedCourses} course doc(s) and ${deletedSaved} savedCourses entry/entries.`);
}

deleteBrokenCourses().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
