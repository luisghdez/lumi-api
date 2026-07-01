import "../config/firebaseConfig";
import { db } from "../config/firebaseConfig";

async function check() {
  const snap = await db.collection("courses")
    .where("apSubject", "==", "AP Biology")
    .get();

  if (snap.empty) {
    console.log("❌ No AP Biology course found in Firestore!");
    return;
  }

  for (const doc of snap.docs) {
    const d = doc.data();
    console.log(`\nCourse: ${d.title} (${doc.id})`);
    console.log(`  tags: ${JSON.stringify(d.tags)}`);
    console.log(`  apSubject: ${d.apSubject}`);

    const lessons = await doc.ref.collection("lessons").get();
    console.log(`  lessons in DB: ${lessons.size}`);

    const notes = await doc.ref.collection("notes").orderBy("unitNumber").get();
    console.log(`  notes in DB: ${notes.size}`);
    notes.docs.forEach((n: any) => {
      const nd = n.data();
      const hasContent = !!(nd.content && nd.content.trim());
      console.log(`    Unit ${nd.unitNumber}: ${nd.unitName} — ${hasContent ? '✅ (' + nd.content.length + ' chars)' : '❌ MISSING CONTENT'}`);
    });
  }
}

check().catch(console.error).finally(() => process.exit(0));
