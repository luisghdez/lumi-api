import { storage } from "../config/firebaseConfig";

const DEFAULT_UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
const DEFAULT_PLAYBACK_URL_TTL_MS = 60 * 60 * 1000;

export interface SignedUploadTarget {
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
}

export interface StoredVideoMetadata {
  sizeBytes?: number;
  contentType?: string;
}

function getExtensionFromMimeType(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split(";")[0]?.trim().toLowerCase();
  if (!subtype) return "mp4";

  const normalized = subtype === "quicktime" ? "mov" : subtype;
  return normalized.replace(/[^a-z0-9]/g, "") || "mp4";
}

export function buildVideoStoragePath(userId: string, videoId: string, mimeType: string): string {
  const extension = getExtensionFromMimeType(mimeType);
  return `videos/${userId}/${videoId}/original.${extension}`;
}

export async function createSignedVideoUploadUrl(
  storagePath: string,
  mimeType: string,
  ttlMs: number = DEFAULT_UPLOAD_URL_TTL_MS
): Promise<SignedUploadTarget> {
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  const expiresAtMs = Date.now() + ttlMs;

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: expiresAtMs,
    contentType: mimeType,
  });

  return {
    uploadUrl,
    storagePath,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export async function createSignedVideoPlaybackUrl(
  storagePath: string,
  ttlMs: number = DEFAULT_PLAYBACK_URL_TTL_MS
): Promise<string> {
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  const [playbackUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + ttlMs,
  });

  return playbackUrl;
}

export async function getStoredVideoMetadata(storagePath: string): Promise<StoredVideoMetadata | null> {
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    return null;
  }

  const [metadata] = await file.getMetadata();
  const sizeBytes = metadata.size ? Number(metadata.size) : undefined;

  return {
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
    contentType: metadata.contentType,
  };
}

export async function deleteStoredVideo(storagePath: string): Promise<void> {
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  await file.delete({ ignoreNotFound: true });
}
