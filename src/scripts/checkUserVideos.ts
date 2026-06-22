/**
 * checkUserVideos.ts
 *
 * Looks up a user by email and prints all their uploaded videos.
 *
 * Usage:
 *   npx ts-node src/scripts/checkUserVideos.ts --email sammy.lopz18@gmail.com
 *   npx ts-node src/scripts/checkUserVideos.ts --email sammy.lopz18@gmail.com --status all
 */

import "../config/firebaseConfig";
import { db, auth } from "../config/firebaseConfig";

const args = process.argv.slice(2);
const emailFlag = args.indexOf("--email");
const statusFlag = args.indexOf("--status");

const email = emailFlag !== -1 ? args[emailFlag + 1] : "sammy.lopz18@gmail.com";
const statusFilter = statusFlag !== -1 ? args[statusFlag + 1] : "all";

async function main() {
  console.log(`\nLooking up user: ${email}`);

  // 1. Resolve Firebase Auth UID from email
  let userRecord: import("firebase-admin/auth").UserRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch {
    console.error(`❌  No Firebase Auth user found with email "${email}"`);
    process.exit(1);
  }

  const uid = userRecord.uid;
  console.log(`✅  Found user — UID: ${uid}`);
  console.log(`    Display name : ${userRecord.displayName ?? "(none)"}`);
  console.log(`    Email        : ${userRecord.email}`);
  console.log(`    Created      : ${userRecord.metadata.creationTime}`);
  console.log(`    Last sign-in : ${userRecord.metadata.lastSignInTime ?? "(never)"}`);

  // 2. Optionally fetch username from the users collection
  const userDoc = await db.collection("users").doc(uid).get();
  if (userDoc.exists) {
    const userData = userDoc.data()!;
    console.log(`    Username     : ${userData.username ?? userData.name ?? "(not set)"}`);
    console.log(`    Name         : ${userData.name ?? "(not set)"}`);
  }

  // 3. Query videos uploaded by this user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db.collection("videos").where("ownerId", "==", uid);

  if (statusFilter !== "all") {
    query = query.where("status", "==", statusFilter);
  }

  const snapshot = await query.get();

  console.log(`\n📹  Videos found: ${snapshot.size}${statusFilter !== "all" ? ` (status: ${statusFilter})` : ""}\n`);

  if (snapshot.empty) {
    console.log("No videos found.");
    return;
  }

  let i = 0;
  snapshot.forEach((doc: any) => {
    i++;
    const v = doc.data();
    const createdAt = v.createdAt?.toDate?.()?.toISOString() ?? "unknown";
    console.log(`--- Video ${i} ---`);
    console.log(`  ID          : ${doc.id}`);
    console.log(`  Caption     : ${v.caption || "(none)"}`);
    console.log(`  Subject     : ${v.subject || "(none)"}`);
    console.log(`  Kind        : ${v.contentKind}`);
    console.log(`  Status      : ${v.status}`);
    console.log(`  Visibility  : ${v.visibility}`);
    console.log(`  Likes       : ${v.likeCount ?? 0}`);
    console.log(`  Comments    : ${v.commentCount ?? 0}`);
    console.log(`  Created at  : ${createdAt}`);
    console.log(`  Storage     : ${v.storagePath || v.playbackStoragePath || "(none)"}`);
    console.log();
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
