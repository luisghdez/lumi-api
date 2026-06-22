import { storage } from "../config/firebaseConfig";

const DEFAULT_UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
/** Long enough for typical HLS playback sessions before refresh (client re-fetches video). */
const DEFAULT_PLAYBACK_URL_TTL_MS = 4 * 60 * 60 * 1000;

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

export function buildVideoThumbnailStoragePath(userId: string, videoId: string, mimeType: string): string {
  const extension = getExtensionFromMimeType(mimeType);
  return `videos/${userId}/${videoId}/thumbnail.${extension}`;
}

/** Slideshow slide object key: `videos/{userId}/{videoId}/slides/slide_{order}.{ext}` */
export function buildSlideStoragePath(
  userId: string,
  videoId: string,
  order: number,
  mimeType: string
): string {
  const extension = getExtensionFromMimeType(mimeType);
  return `videos/${userId}/${videoId}/slides/slide_${order}.${extension}`;
}

const slideshowSlidesPrefix = (userId: string, videoId: string) => `videos/${userId}/${videoId}/slides/`;

export function isSlidePathForVideo(userId: string, videoId: string, storagePath: string): boolean {
  return storagePath.startsWith(slideshowSlidesPrefix(userId, videoId)) && storagePath.length < 512;
}

export async function createSignedStorageUploadUrl(
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

export async function createSignedVideoUploadUrl(
  storagePath: string,
  mimeType: string,
  ttlMs: number = DEFAULT_UPLOAD_URL_TTL_MS
): Promise<SignedUploadTarget> {
  return createSignedStorageUploadUrl(storagePath, mimeType, ttlMs);
}

export async function createSignedVideoThumbnailUploadUrl(
  storagePath: string,
  mimeType: string,
  ttlMs: number = DEFAULT_UPLOAD_URL_TTL_MS
): Promise<SignedUploadTarget> {
  return createSignedStorageUploadUrl(storagePath, mimeType, ttlMs);
}

export async function createSignedStorageReadUrl(
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

export async function createSignedVideoPlaybackUrl(
  storagePath: string,
  ttlMs: number = DEFAULT_PLAYBACK_URL_TTL_MS
): Promise<string> {
  return createSignedStorageReadUrl(storagePath, ttlMs);
}

export async function getStoredVideoMetadata(storagePath: string): Promise<StoredVideoMetadata | null> {
  if (!storagePath || !String(storagePath).trim()) {
    return null;
  }
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
  if (!storagePath || !String(storagePath).trim()) {
    return;
  }
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  await file.delete({ ignoreNotFound: true });
}

/** Common locations for packaged adaptive streams (transcoder uploads next to `original.*`). */
function adaptiveMasterCandidates(userId: string, videoId: string): string[] {
  const base = `videos/${userId}/${videoId}`;
  return [
    `${base}/master.m3u8`,
    `${base}/hls/master.m3u8`,
    `${base}/index.m3u8`,
    `${base}/manifest.mpd`,
    `${base}/dash/manifest.mpd`,
  ];
}

/**
 * Returns the first existing adaptive manifest path (HLS before DASH), or null.
 * Use after upload/transcode so playback can prefer multi-bitrate streams.
 */
export async function findExistingAdaptivePlaybackPath(
  userId: string,
  videoId: string
): Promise<string | null> {
  const bucket = storage.bucket();
  for (const path of adaptiveMasterCandidates(userId, videoId)) {
    const [exists] = await bucket.file(path).exists();
    if (exists) return path;
  }
  return null;
}
