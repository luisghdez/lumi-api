/**
 * uploadVideos.ts
 *
 * Manually seeds videos from the /uploads folder into Firebase Storage + Firestore.
 *
 * HOW TO USE
 * ----------
 * 1. Drop video files into the uploads/ folder at the repo root.
 *    Supported formats: .mp4, .mov, .webm, .m4v
 *
 * 2. (Optional) Place a JSON sidecar next to each video with the same base name:
 *      uploads/my-video.mp4
 *      uploads/my-video.json   ← optional metadata
 *
 *    Sidecar fields (all optional):
 *      {
 *        "caption":    "Some caption",          // default: ""
 *        "subject":    "AP Biology",            // default: ""
 *        "visibility": "public|friends|private",// default: "public"
 *        "ownerId":    "<firebase-uid>"         // overrides --owner flag for this file
 *      }
 *
 * 3. Run:
 *      npx ts-node src/scripts/uploadVideos.ts --owner <firebase-uid>
 *
 *    --owner  Required. Default owner UID for any video without a sidecar ownerId.
 *    --dry-run  Print what would be done without writing anything.
 */

import "../config/firebaseConfig";
import { db, storage, auth } from "../config/firebaseConfig";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
const VIDEOS_COLLECTION = "videos";

const args = process.argv.slice(2);
const ownerFlag = args.indexOf("--owner");
const defaultOwnerId = ownerFlag !== -1 ? args[ownerFlag + 1] : undefined;
const isDryRun = args.includes("--dry-run");

const MIME_MAP: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
};

interface Sidecar {
  caption?: string;
  subject?: string;
  unitNumber?: number;
  visibility?: "public" | "friends" | "private";
  ownerId?: string;
}

function getMimeType(filePath: string): string | null {
  return MIME_MAP[path.extname(filePath).toLowerCase()] ?? null;
}

function readSidecar(videoPath: string): Sidecar {
  const sidecarPath = videoPath.replace(/\.[^.]+$/, ".json");
  if (fs.existsSync(sidecarPath)) {
    try {
      return JSON.parse(fs.readFileSync(sidecarPath, "utf-8"));
    } catch {
      console.warn(`  ⚠️  Could not parse sidecar ${path.basename(sidecarPath)}, using defaults.`);
    }
  }
  return {};
}

async function resolveOwnerMeta(ownerId: string): Promise<{ ownerName: string; ownerProfilePicture: string }> {
  const userDoc = await db.collection("users").doc(ownerId).get();
  const data = userDoc.data() || {};
  return {
    ownerName: data.name || "Unknown User",
    ownerProfilePicture: data.profilePicture || "default",
  };
}

async function uploadVideoFile(
  localPath: string,
  storagePath: string,
  mimeType: string
): Promise<number> {
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: { contentType: mimeType },
  });
  const [meta] = await file.getMetadata();
  return Number(meta.size) || 0;
}

async function main() {
  if (!defaultOwnerId) {
    console.error("❌  --owner <firebase-uid> is required.");
    console.error("    Example: npx ts-node src/scripts/uploadVideos.ts --owner BiAI4H59h9Zh9sjhvMsv3z2whT23");
    process.exit(1);
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error(`❌  uploads/ folder not found at ${UPLOADS_DIR}`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(UPLOADS_DIR);
  const videoFiles = allFiles.filter((f) => getMimeType(path.join(UPLOADS_DIR, f)) !== null);

  if (videoFiles.length === 0) {
    console.log("No video files found in uploads/. Drop .mp4, .mov, .webm, or .m4v files there.");
    process.exit(0);
  }

  console.log(`\nFound ${videoFiles.length} video(s) in uploads/${isDryRun ? " [DRY RUN]" : ""}\n`);

  for (const filename of videoFiles) {
    const localPath = path.join(UPLOADS_DIR, filename);
    const donePath = localPath + ".done";

    if (fs.existsSync(donePath)) {
      const doneInfo = JSON.parse(fs.readFileSync(donePath, "utf-8"));
      console.log(`⏭️   ${filename} — already uploaded (doc: ${doneInfo.videoId}), skipping.\n`);
      continue;
    }

    const mimeType = getMimeType(localPath)!;
    const sidecar = readSidecar(localPath);

    const ownerId = sidecar.ownerId || defaultOwnerId;
    const caption = sidecar.caption ?? "";
    const subject = sidecar.subject ?? "";
    const unitNumber = sidecar.unitNumber ?? null;
    const visibility = sidecar.visibility ?? "public";

    console.log(`📹  ${filename}`);
    console.log(`    Owner      : ${ownerId}`);
    console.log(`    Caption    : ${caption || "(none)"}`);
    console.log(`    Subject    : ${subject || "(none)"}`);
    console.log(`    Unit       : ${unitNumber ?? "(none)"}`);
    console.log(`    Visibility : ${visibility}`);

    if (isDryRun) {
      console.log(`    [DRY RUN] Would upload and create Firestore doc.\n`);
      continue;
    }

    try {
      // Validate owner exists
      const ownerMeta = await resolveOwnerMeta(ownerId);

      // Generate a new Firestore doc ID
      const videoRef = db.collection(VIDEOS_COLLECTION).doc();
      const videoId = videoRef.id;

      const ext = path.extname(filename).toLowerCase().replace(".", "");
      const storagePath = `videos/${ownerId}/${videoId}/original.${ext}`;

      console.log(`    Uploading  → ${storagePath} ...`);
      const sizeBytes = await uploadVideoFile(localPath, storagePath, mimeType);
      console.log(`    Uploaded   ✅ (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

      const videoDoc = {
        ownerId,
        ownerName: ownerMeta.ownerName,
        ownerProfilePicture: ownerMeta.ownerProfilePicture,
        caption,
        subject,
        ...(unitNumber !== null ? { unitNumber } : {}),
        storagePath,
        contentKind: "video",
        playbackStoragePath: null,
        playbackUrl: null,
        thumbnailUrl: null,
        thumbnailStoragePath: null,
        mimeType,
        sizeBytes,
        durationMs: null,
        status: "ready",
        visibility,
        likeCount: 0,
        commentCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await videoRef.set(videoDoc);
      console.log(`    Firestore  ✅ doc ID: ${videoId}\n`);

      fs.writeFileSync(donePath, JSON.stringify({ videoId, storagePath, uploadedAt: new Date().toISOString() }, null, 2));
    } catch (err: any) {
      console.error(`    ❌ Failed: ${err.message}\n`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
