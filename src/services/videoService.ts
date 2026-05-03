import { admin, db } from "../config/firebaseConfig";
import { areUsersFriends } from "./friendService";
import {
  buildSlideStoragePath,
  buildVideoThumbnailStoragePath,
  buildVideoStoragePath,
  createSignedStorageReadUrl,
  createSignedVideoPlaybackUrl,
  createSignedVideoThumbnailUploadUrl,
  createSignedVideoUploadUrl,
  deleteStoredVideo,
  findExistingAdaptivePlaybackPath,
  getStoredVideoMetadata,
  isSlidePathForVideo,
  SignedUploadTarget,
} from "./videoStorageService";

export type VideoVisibility = "public" | "friends" | "private";
export type VideoStatus = "uploading" | "processing" | "ready" | "failed" | "deleted";
export type ContentKind = "video" | "slideshow";

export interface CreateVideoInput {
  caption?: string;
  mimeType: string;
  subject?: string;
  thumbnailMimeType?: string;
  visibility?: VideoVisibility;
  contentKind?: ContentKind;
  slideCount?: number;
  slideMimeTypes?: string[];
  defaultSlideDurationMs?: number;
}

export interface CompleteSlideInput {
  storagePath: string;
  order: number;
  durationMs?: number;
}

export interface CompleteVideoUploadInput {
  durationMs?: number;
  thumbnailUrl?: string;
  slides?: CompleteSlideInput[];
}

export interface VideoSlideResponse {
  url: string;
  order: number;
  durationMs: number | null;
}

export interface SlideUploadTarget extends SignedUploadTarget {
  order: number;
}

export type CreateVideoUploadResult = {
  video: VideoResponse;
  upload: SignedUploadTarget | null;
  thumbnailUpload: SignedUploadTarget | null;
  slideUploads?: SlideUploadTarget[];
};

export interface VideoComment {
  id: string;
  authorId: string;
  authorName: string;
  /** URL or avatar id / `"default"` — same convention as video owner. */
  authorProfilePicture: string;
  text: string;
  likeCount: number;
  likedByMe: boolean;
  /** `null` for top-level; parent comment id for replies. */
  parentCommentId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type PlaybackFormat = "hls" | "dash" | "progressive";

export interface VideoResponse {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerProfilePicture: string;
  caption: string;
  subject: string;
  storagePath: string;
  contentKind: ContentKind;
  isSlideshow: boolean;
  slides: VideoSlideResponse[];
  /** GCS object used for playback (HLS/DASH master when present, else progressive `storagePath`). */
  playbackStoragePath: string;
  playbackUrl: string | null;
  /** Hint for VideoFormat / demuxer: derived from `playbackStoragePath` extension. */
  playbackFormat: PlaybackFormat;
  thumbnailUrl: string | null;
  thumbnailStoragePath: string | null;
  mimeType: string;
  sizeBytes: number | null;
  durationMs: number | null;
  status: VideoStatus;
  visibility: VideoVisibility;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface VideoSlidePersisted {
  storagePath: string;
  order: number;
  durationMs: number;
}

interface VideoDocument {
  ownerId: string;
  ownerName: string;
  ownerProfilePicture: string;
  caption: string;
  subject: string;
  /** Empty for slideshow drafts (no single progressive file). */
  storagePath: string;
  contentKind?: ContentKind;
  slideCount?: number;
  defaultSlideDurationMs?: number;
  slides?: VideoSlidePersisted[];
  /** When set, signed `playbackUrl` targets this object (e.g. HLS master .m3u8) instead of progressive `storagePath`. */
  playbackStoragePath?: string | null;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
  thumbnailStoragePath: string | null;
  mimeType: string;
  sizeBytes: number | null;
  durationMs: number | null;
  status: VideoStatus;
  visibility: VideoVisibility;
  likeCount: number;
  commentCount: number;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  deletedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
}

class ServiceError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const VIDEOS_COLLECTION = "videos";
const MAX_CAPTION_LENGTH = 2200;
const MAX_SUBJECT_LENGTH = 120;
const MAX_COMMENT_LENGTH = 500;
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;
const MIN_SLIDESHOW_SLIDES = 2;
const MAX_SLIDESHOW_SLIDES = 20;

function assertVideoMimeType(mimeType: string): void {
  if (!mimeType || !mimeType.toLowerCase().startsWith("video/")) {
    throw new ServiceError(400, "mimeType must be a video MIME type");
  }
}

function assertSlideshowDraftMimeType(mimeType: string): void {
  const lower = (mimeType || "").toLowerCase();
  if (!lower.startsWith("image/")) {
    throw new ServiceError(400, "mimeType must be an image type for slideshow (e.g. image/slideshow)");
  }
}

function assertSlideImageMimeType(mimeType: string): void {
  const lower = (mimeType || "").toLowerCase();
  if (!lower.startsWith("image/")) {
    throw new ServiceError(400, "Each slideMimeTypes entry must be an image MIME type");
  }
}

function assertThumbnailMimeType(mimeType?: string): void {
  if (!mimeType) return;
  if (!mimeType.toLowerCase().startsWith("image/")) {
    throw new ServiceError(400, "thumbnailMimeType must be an image MIME type");
  }
}

function isSlideshowDoc(data: VideoDocument): boolean {
  return (data.contentKind || "video") === "slideshow";
}

function normalizeVisibility(visibility?: VideoVisibility): VideoVisibility {
  if (!visibility) return "public";
  if (!["public", "friends", "private"].includes(visibility)) {
    throw new ServiceError(400, "visibility must be public, friends, or private");
  }
  return visibility;
}

function normalizeCaption(caption?: string): string {
  const normalized = (caption || "").trim();
  if (normalized.length > MAX_CAPTION_LENGTH) {
    throw new ServiceError(400, `caption must be ${MAX_CAPTION_LENGTH} characters or fewer`);
  }
  return normalized;
}

function normalizeSubject(subject?: string): string {
  const normalized = (subject || "").trim();
  if (normalized.length > MAX_SUBJECT_LENGTH) {
    throw new ServiceError(400, `subject must be ${MAX_SUBJECT_LENGTH} characters or fewer`);
  }
  return normalized;
}

function normalizeComment(text: string): string {
  const normalized = (text || "").trim();
  if (!normalized) {
    throw new ServiceError(400, "Comment text is required");
  }
  if (normalized.length > MAX_COMMENT_LENGTH) {
    throw new ServiceError(400, `Comment text must be ${MAX_COMMENT_LENGTH} characters or fewer`);
  }
  return normalized;
}

function normalizeLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) return DEFAULT_PAGE_LIMIT;
  return Math.min(Math.max(Math.floor(limit), 1), MAX_PAGE_LIMIT);
}

function serializeTimestamp(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  return null;
}

function timestampToMillis(value: any): number {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return new Date(value).getTime();
  return 0;
}

function encodeCursor(createdAt: any, id: string): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: timestampToMillis(createdAt),
      id,
    })
  ).toString("base64url");
}

function decodeCursor(cursor?: string): { createdAt: FirebaseFirestore.Timestamp; id: string } | null {
  if (!cursor) return null;

  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      createdAt?: number;
      id?: string;
    };

    if (!decoded.createdAt || !decoded.id) {
      throw new Error("Invalid cursor payload");
    }

    return {
      createdAt: admin.firestore.Timestamp.fromMillis(decoded.createdAt),
      id: decoded.id,
    };
  } catch {
    throw new ServiceError(400, "Invalid cursor");
  }
}

async function getUserSnapshot(userId: string): Promise<FirebaseFirestore.DocumentSnapshot> {
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new ServiceError(404, "User not found");
  }
  return userDoc;
}

async function canReadVideo(video: VideoDocument, viewerId: string): Promise<boolean> {
  if (video.status === "deleted") return false;
  if (video.ownerId === viewerId) return true;
  if (video.status !== "ready") return false;

  const visibility = video.visibility || "public";
  if (visibility === "public") return true;
  if (visibility === "private") return false;
  if (visibility === "friends") {
    return areUsersFriends(viewerId, video.ownerId);
  }
  return false;
}

async function canInteractWithVideo(video: VideoDocument, viewerId: string): Promise<boolean> {
  return video.status === "ready" && (await canReadVideo(video, viewerId));
}

function playbackFormatFromStoragePath(path: string): PlaybackFormat {
  const lower = path.toLowerCase();
  if (lower.endsWith(".m3u8")) return "hls";
  if (lower.endsWith(".mpd")) return "dash";
  return "progressive";
}

async function serializeVideo(
  doc: FirebaseFirestore.DocumentSnapshot,
  viewerId: string
): Promise<VideoResponse> {
  const data = doc.data() as VideoDocument;
  const likedByMe = (
    await doc.ref.collection("likes").doc(viewerId).get()
  ).exists;

  const slideshow = isSlideshowDoc(data);
  const contentKind: ContentKind = data.contentKind || "video";

  const pathForPlayback =
    !slideshow &&
    data.status === "ready" &&
    (data.playbackStoragePath || data.storagePath)
      ? data.playbackStoragePath || data.storagePath
      : null;

  const playbackUrl =
    pathForPlayback ? await createSignedVideoPlaybackUrl(pathForPlayback) : null;

  const playbackFormat: PlaybackFormat = pathForPlayback
    ? playbackFormatFromStoragePath(pathForPlayback)
    : "progressive";

  let thumbnailUrl: string | null =
    data.status === "ready" && data.thumbnailStoragePath
      ? await createSignedStorageReadUrl(data.thumbnailStoragePath)
      : data.thumbnailUrl || null;

  const persistedSlides = [...(data.slides || [])].sort((a, b) => a.order - b.order);
  let slidesOut: VideoSlideResponse[] = [];
  if (slideshow && data.status === "ready" && persistedSlides.length > 0) {
    slidesOut = await Promise.all(
      persistedSlides.map(async (s) => ({
        url: await createSignedStorageReadUrl(s.storagePath),
        order: s.order,
        durationMs: typeof s.durationMs === "number" ? s.durationMs : null,
      }))
    );
    if (!thumbnailUrl && persistedSlides[0]?.storagePath) {
      thumbnailUrl = await createSignedStorageReadUrl(persistedSlides[0].storagePath);
    }
  }

  const playbackStoragePathOut =
    pathForPlayback || (slideshow ? "" : data.storagePath || "");

  return {
    id: doc.id,
    ownerId: data.ownerId,
    ownerName: data.ownerName,
    ownerProfilePicture: data.ownerProfilePicture,
    caption: data.caption,
    subject: data.subject || "",
    storagePath: data.storagePath || "",
    contentKind,
    isSlideshow: slideshow,
    slides: slidesOut,
    playbackStoragePath: playbackStoragePathOut,
    playbackUrl,
    playbackFormat,
    thumbnailUrl,
    thumbnailStoragePath: data.thumbnailStoragePath || null,
    mimeType: data.mimeType,
    sizeBytes: data.sizeBytes ?? null,
    durationMs: data.durationMs ?? null,
    status: data.status,
    visibility: data.visibility,
    likeCount: data.likeCount || 0,
    commentCount: data.commentCount || 0,
    likedByMe,
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

export async function createVideoUpload(ownerId: string, input: CreateVideoInput): Promise<CreateVideoUploadResult> {
  assertThumbnailMimeType(input.thumbnailMimeType);

  const userDoc = await getUserSnapshot(ownerId);
  const userData = userDoc.data() || {};
  const videoRef = db.collection(VIDEOS_COLLECTION).doc();
  const videoId = videoRef.id;

  const isSlideshow = input.contentKind === "slideshow";

  if (isSlideshow) {
    assertSlideshowDraftMimeType(input.mimeType);
    const slideCount = input.slideCount;
    if (
      typeof slideCount !== "number" ||
      !Number.isInteger(slideCount) ||
      slideCount < MIN_SLIDESHOW_SLIDES ||
      slideCount > MAX_SLIDESHOW_SLIDES
    ) {
      throw new ServiceError(
        400,
        `slideCount is required for slideshow and must be between ${MIN_SLIDESHOW_SLIDES} and ${MAX_SLIDESHOW_SLIDES}`
      );
    }
    if (input.slideMimeTypes && input.slideMimeTypes.length !== slideCount) {
      throw new ServiceError(400, "slideMimeTypes length must match slideCount");
    }
    if (input.slideMimeTypes) {
      for (const m of input.slideMimeTypes) {
        assertSlideImageMimeType(m);
      }
    }
    const defaultSlideDurationMs =
      typeof input.defaultSlideDurationMs === "number" && input.defaultSlideDurationMs > 0
        ? Math.floor(input.defaultSlideDurationMs)
        : 3500;

    const slideUploads: SlideUploadTarget[] = [];
    for (let order = 0; order < slideCount; order += 1) {
      const slideMime = input.slideMimeTypes?.[order] ?? "image/jpeg";
      const slidePath = buildSlideStoragePath(ownerId, videoId, order, slideMime);
      const signed = await createSignedVideoUploadUrl(slidePath, slideMime);
      slideUploads.push({ ...signed, order });
    }
    slideUploads.sort((a, b) => a.order - b.order);

    const thumbnailStoragePath = input.thumbnailMimeType
      ? buildVideoThumbnailStoragePath(ownerId, videoId, input.thumbnailMimeType)
      : null;
    const thumbnailUpload =
      input.thumbnailMimeType && thumbnailStoragePath
        ? await createSignedVideoThumbnailUploadUrl(thumbnailStoragePath, input.thumbnailMimeType)
        : null;

    const video: VideoDocument = {
      ownerId,
      ownerName: userData.name || "Unknown User",
      ownerProfilePicture: userData.profilePicture || "default",
      caption: normalizeCaption(input.caption),
      subject: normalizeSubject(input.subject),
      storagePath: "",
      contentKind: "slideshow",
      slideCount,
      defaultSlideDurationMs,
      slides: [],
      playbackStoragePath: null,
      playbackUrl: null,
      thumbnailUrl: null,
      thumbnailStoragePath,
      mimeType: input.mimeType,
      sizeBytes: null,
      durationMs: null,
      status: "uploading",
      visibility: normalizeVisibility(input.visibility),
      likeCount: 0,
      commentCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await videoRef.set(video);
    const createdDoc = await videoRef.get();

    return {
      video: await serializeVideo(createdDoc, ownerId),
      upload: null,
      thumbnailUpload,
      slideUploads,
    };
  }

  assertVideoMimeType(input.mimeType);

  const storagePath = buildVideoStoragePath(ownerId, videoId, input.mimeType);
  const upload = await createSignedVideoUploadUrl(storagePath, input.mimeType);
  const thumbnailStoragePath = input.thumbnailMimeType
    ? buildVideoThumbnailStoragePath(ownerId, videoId, input.thumbnailMimeType)
    : null;
  const thumbnailUpload =
    input.thumbnailMimeType && thumbnailStoragePath
      ? await createSignedVideoThumbnailUploadUrl(thumbnailStoragePath, input.thumbnailMimeType)
      : null;

  const video: VideoDocument = {
    ownerId,
    ownerName: userData.name || "Unknown User",
    ownerProfilePicture: userData.profilePicture || "default",
    caption: normalizeCaption(input.caption),
    subject: normalizeSubject(input.subject),
    storagePath,
    contentKind: "video",
    playbackStoragePath: null,
    playbackUrl: null,
    thumbnailUrl: null,
    thumbnailStoragePath,
    mimeType: input.mimeType,
    sizeBytes: null,
    durationMs: null,
    status: "uploading",
    visibility: normalizeVisibility(input.visibility),
    likeCount: 0,
    commentCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await videoRef.set(video);
  const createdDoc = await videoRef.get();

  return {
    video: await serializeVideo(createdDoc, ownerId),
    upload,
    thumbnailUpload,
  };
}

async function verifySlideshowSlidesAndBuildPersisted(
  video: VideoDocument,
  ownerId: string,
  videoId: string,
  input: CompleteVideoUploadInput
): Promise<{ slides: VideoSlidePersisted[]; totalDurationMs: number; sizeBytes: number }> {
  const slideCount = video.slideCount;
  if (typeof slideCount !== "number" || slideCount < MIN_SLIDESHOW_SLIDES) {
    throw new ServiceError(400, "Invalid slideshow draft: missing slideCount");
  }
  const rawSlides = input.slides;
  if (!rawSlides || !Array.isArray(rawSlides) || rawSlides.length !== slideCount) {
    throw new ServiceError(400, `slides must be an array of length ${slideCount}`);
  }

  const defaultDur =
    typeof video.defaultSlideDurationMs === "number" && video.defaultSlideDurationMs > 0
      ? video.defaultSlideDurationMs
      : 3500;

  const sorted = [...rawSlides].sort((a, b) => a.order - b.order);
  for (let i = 0; i < slideCount; i += 1) {
    if (sorted[i]?.order !== i) {
      throw new ServiceError(400, "slides must include order 0 through slideCount-1 exactly once");
    }
  }

  let sizeBytes = 0;
  const slides: VideoSlidePersisted[] = [];

  for (const s of sorted) {
    const storagePath = (s.storagePath || "").trim();
    const expectedPrefix = `videos/${ownerId}/${videoId}/slides/slide_${s.order}`;
    if (
      !storagePath ||
      !isSlidePathForVideo(ownerId, videoId, storagePath) ||
      !storagePath.startsWith(expectedPrefix)
    ) {
      throw new ServiceError(400, "Invalid slide storagePath for this video");
    }
    const meta = await getStoredVideoMetadata(storagePath);
    if (!meta) {
      throw new ServiceError(400, `Slide file not found in storage (order ${s.order})`);
    }
    if (typeof meta.sizeBytes === "number") {
      sizeBytes += meta.sizeBytes;
    }
    const dur =
      typeof s.durationMs === "number" && s.durationMs > 0 ? Math.floor(s.durationMs) : defaultDur;
    slides.push({ storagePath, order: s.order, durationMs: dur });
  }

  const totalDurationMs = slides.reduce((acc, n) => acc + n.durationMs, 0);

  return { slides, totalDurationMs, sizeBytes };
}

export async function completeVideoUpload(
  videoId: string,
  ownerId: string,
  input: CompleteVideoUploadInput
): Promise<VideoResponse> {
  const videoRef = db.collection(VIDEOS_COLLECTION).doc(videoId);
  const videoDoc = await videoRef.get();

  if (!videoDoc.exists) {
    throw new ServiceError(404, "Video not found");
  }

  const video = videoDoc.data() as VideoDocument;
  if (video.ownerId !== ownerId) {
    throw new ServiceError(403, "Only the owner can complete this upload");
  }
  if (video.status === "deleted") {
    throw new ServiceError(404, "Video not found");
  }

  if (isSlideshowDoc(video)) {
    const { slides, totalDurationMs, sizeBytes } = await verifySlideshowSlidesAndBuildPersisted(
      video,
      ownerId,
      videoId,
      input
    );

    if (video.thumbnailStoragePath) {
      const storedThumbnailMetadata = await getStoredVideoMetadata(video.thumbnailStoragePath);
      if (!storedThumbnailMetadata) {
        throw new ServiceError(400, "Uploaded thumbnail file was not found in storage");
      }
    }

    await videoRef.update({
      status: "ready",
      slides,
      sizeBytes: sizeBytes || video.sizeBytes || null,
      durationMs: totalDurationMs,
      mimeType: "image/slideshow",
      thumbnailUrl: video.thumbnailStoragePath ? null : input.thumbnailUrl || video.thumbnailUrl || null,
      playbackStoragePath: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return getVideoById(videoId, ownerId);
  }

  const storedMetadata = await getStoredVideoMetadata(video.storagePath);
  if (!storedMetadata) {
    throw new ServiceError(400, "Uploaded video file was not found in storage");
  }

  if (video.thumbnailStoragePath) {
    const storedThumbnailMetadata = await getStoredVideoMetadata(video.thumbnailStoragePath);
    if (!storedThumbnailMetadata) {
      throw new ServiceError(400, "Uploaded thumbnail file was not found in storage");
    }
  }

  const adaptivePath = await findExistingAdaptivePlaybackPath(video.ownerId, videoId);

  await videoRef.update({
    status: "ready",
    sizeBytes: storedMetadata.sizeBytes ?? video.sizeBytes ?? null,
    mimeType: storedMetadata.contentType || video.mimeType,
    durationMs: typeof input.durationMs === "number" ? input.durationMs : video.durationMs ?? null,
    thumbnailUrl: video.thumbnailStoragePath ? null : input.thumbnailUrl || video.thumbnailUrl || null,
    ...(adaptivePath
      ? { playbackStoragePath: adaptivePath }
      : { playbackStoragePath: admin.firestore.FieldValue.delete() }),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return getVideoById(videoId, ownerId);
}

export async function getVideoById(videoId: string, viewerId: string): Promise<VideoResponse> {
  let videoDoc = await db.collection(VIDEOS_COLLECTION).doc(videoId).get();

  if (!videoDoc.exists) {
    throw new ServiceError(404, "Video not found");
  }

  let video = videoDoc.data() as VideoDocument;
  if (video.status === "deleted") {
    throw new ServiceError(404, "Video not found");
  }
  if (!(await canReadVideo(video, viewerId))) {
    throw new ServiceError(403, "You do not have access to this video");
  }

  if (video.status === "ready" && !video.playbackStoragePath && !isSlideshowDoc(video)) {
    const adaptivePath = await findExistingAdaptivePlaybackPath(video.ownerId, videoId);
    if (adaptivePath) {
      await videoDoc.ref.update({
        playbackStoragePath: adaptivePath,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      videoDoc = await videoDoc.ref.get();
      video = videoDoc.data() as VideoDocument;
    }
  }

  return serializeVideo(videoDoc, viewerId);
}

export async function getVideoFeed(
  viewerId: string,
  options: { cursor?: string; limit?: number }
): Promise<{ videos: VideoResponse[]; nextCursor: string | null }> {
  const limit = normalizeLimit(options.limit);
  const cursor = decodeCursor(options.cursor);
  const documentId = admin.firestore.FieldPath.documentId();

  let query: FirebaseFirestore.Query = db
    .collection(VIDEOS_COLLECTION)
    .where("status", "==", "ready")
    .where("visibility", "==", "public")
    .orderBy("createdAt", "desc")
    .orderBy(documentId, "desc")
    .limit(limit + 1);

  if (cursor) {
    query = query.startAfter(cursor.createdAt, cursor.id);
  }

  const snapshot = await query.get();
  const docs = snapshot.docs.slice(0, limit);
  const videos = await Promise.all(docs.map((doc) => serializeVideo(doc, viewerId)));
  const hasNextPage = snapshot.docs.length > limit;
  const lastDoc = docs[docs.length - 1];

  return {
    videos,
    nextCursor: hasNextPage && lastDoc ? encodeCursor(lastDoc.get("createdAt"), lastDoc.id) : null,
  };
}

export async function getUserVideos(
  profileUserId: string,
  viewerId: string,
  options: { cursor?: string; limit?: number }
): Promise<{ videos: VideoResponse[]; nextCursor: string | null }> {
  const limit = normalizeLimit(options.limit);
  const cursor = decodeCursor(options.cursor);
  const documentId = admin.firestore.FieldPath.documentId();
  const isOwner = profileUserId === viewerId;

  let query: FirebaseFirestore.Query = db
    .collection(VIDEOS_COLLECTION)
    .where("ownerId", "==", profileUserId)
    .where("status", "==", "ready");

  if (!isOwner) {
    query = query.where("visibility", "==", "public");
  }

  query = query
    .orderBy("createdAt", "desc")
    .orderBy(documentId, "desc")
    .limit(limit + 1);

  if (cursor) {
    query = query.startAfter(cursor.createdAt, cursor.id);
  }

  const snapshot = await query.get();
  const docs = snapshot.docs.slice(0, limit);
  const videos = await Promise.all(docs.map((doc) => serializeVideo(doc, viewerId)));
  const hasNextPage = snapshot.docs.length > limit;
  const lastDoc = docs[docs.length - 1];

  return {
    videos,
    nextCursor: hasNextPage && lastDoc ? encodeCursor(lastDoc.get("createdAt"), lastDoc.id) : null,
  };
}

export async function deleteVideo(videoId: string, ownerId: string): Promise<void> {
  const videoRef = db.collection(VIDEOS_COLLECTION).doc(videoId);
  const videoDoc = await videoRef.get();

  if (!videoDoc.exists) {
    throw new ServiceError(404, "Video not found");
  }

  const video = videoDoc.data() as VideoDocument;
  if (video.ownerId !== ownerId) {
    throw new ServiceError(403, "Only the owner can delete this video");
  }

  await videoRef.update({
    status: "deleted",
    visibility: "private",
    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (isSlideshowDoc(video) && video.slides?.length) {
    for (const s of video.slides) {
      if (s.storagePath) {
        await deleteStoredVideo(s.storagePath);
      }
    }
  }

  await deleteStoredVideo(video.storagePath);
  if (video.thumbnailStoragePath) {
    await deleteStoredVideo(video.thumbnailStoragePath);
  }
  if (
    video.playbackStoragePath &&
    video.playbackStoragePath !== video.storagePath &&
    video.playbackStoragePath !== video.thumbnailStoragePath
  ) {
    await deleteStoredVideo(video.playbackStoragePath);
  }
}

export async function likeVideo(videoId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
  const videoRef = db.collection(VIDEOS_COLLECTION).doc(videoId);
  const likeRef = videoRef.collection("likes").doc(userId);

  return db.runTransaction(async (transaction) => {
    const videoDoc = await transaction.get(videoRef);
    const likeDoc = await transaction.get(likeRef);

    if (!videoDoc.exists) {
      throw new ServiceError(404, "Video not found");
    }

    const video = videoDoc.data() as VideoDocument;
    if (!(await canInteractWithVideo(video, userId))) {
      throw new ServiceError(403, "You do not have access to this video");
    }

    const currentLikeCount = video.likeCount || 0;
    if (likeDoc.exists) {
      return { liked: true, likeCount: currentLikeCount };
    }

    transaction.set(likeRef, {
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.update(videoRef, {
      likeCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { liked: true, likeCount: currentLikeCount + 1 };
  });
}

export async function unlikeVideo(videoId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
  const videoRef = db.collection(VIDEOS_COLLECTION).doc(videoId);
  const likeRef = videoRef.collection("likes").doc(userId);

  return db.runTransaction(async (transaction) => {
    const videoDoc = await transaction.get(videoRef);
    const likeDoc = await transaction.get(likeRef);

    if (!videoDoc.exists) {
      throw new ServiceError(404, "Video not found");
    }

    const video = videoDoc.data() as VideoDocument;
    if (!(await canInteractWithVideo(video, userId))) {
      throw new ServiceError(403, "You do not have access to this video");
    }

    const currentLikeCount = video.likeCount || 0;
    if (!likeDoc.exists) {
      return { liked: false, likeCount: currentLikeCount };
    }

    transaction.delete(likeRef);
    transaction.update(videoRef, {
      likeCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { liked: false, likeCount: Math.max(currentLikeCount - 1, 0) };
  });
}

export async function createVideoComment(
  videoId: string,
  authorId: string,
  text: string,
  parentCommentId?: string | null
): Promise<VideoComment> {
  const normalizedText = normalizeComment(text);
  const userDoc = await getUserSnapshot(authorId);
  const userData = userDoc.data() || {};
  const videoRef = db.collection(VIDEOS_COLLECTION).doc(videoId);
  const commentRef = videoRef.collection("comments").doc();

  const parentId =
    typeof parentCommentId === "string" && parentCommentId.trim().length > 0
      ? parentCommentId.trim()
      : null;

  await db.runTransaction(async (transaction) => {
    const videoDoc = await transaction.get(videoRef);

    if (!videoDoc.exists) {
      throw new ServiceError(404, "Video not found");
    }

    const video = videoDoc.data() as VideoDocument;
    if (!(await canInteractWithVideo(video, authorId))) {
      throw new ServiceError(403, "You do not have access to this video");
    }

    if (parentId) {
      const parentRef = videoRef.collection("comments").doc(parentId);
      const parentSnap = await transaction.get(parentRef);
      if (!parentSnap.exists) {
        throw new ServiceError(404, "Parent comment not found");
      }
    }

    transaction.set(commentRef, {
      authorId,
      authorName: userData.name || "Unknown User",
      authorProfilePicture: userData.profilePicture || "default",
      text: normalizedText,
      parentCommentId: parentId,
      likeCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.update(videoRef, {
      commentCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  const createdComment = await commentRef.get();
  return serializeComment(createdComment, authorId);
}

async function serializeComment(
  doc: FirebaseFirestore.DocumentSnapshot,
  viewerId: string
): Promise<VideoComment> {
  const data = doc.data() || {};
  const likeSnap = await doc.ref.collection("likes").doc(viewerId).get();
  const parentRaw = data.parentCommentId;
  const parentCommentId =
    typeof parentRaw === "string" && parentRaw.length > 0 ? parentRaw : null;

  return {
    id: doc.id,
    authorId: data.authorId,
    authorName: data.authorName,
    authorProfilePicture: data.authorProfilePicture || "default",
    text: data.text,
    likeCount: Math.max(0, data.likeCount || 0),
    likedByMe: likeSnap.exists,
    parentCommentId,
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

export async function getVideoComments(
  videoId: string,
  viewerId: string,
  options: { cursor?: string; limit?: number }
): Promise<{ comments: VideoComment[]; nextCursor: string | null }> {
  await getVideoById(videoId, viewerId);

  const limit = normalizeLimit(options.limit);
  const cursor = decodeCursor(options.cursor);
  const documentId = admin.firestore.FieldPath.documentId();

  let query: FirebaseFirestore.Query = db
    .collection(VIDEOS_COLLECTION)
    .doc(videoId)
    .collection("comments")
    .orderBy("createdAt", "desc")
    .orderBy(documentId, "desc")
    .limit(limit + 1);

  if (cursor) {
    query = query.startAfter(cursor.createdAt, cursor.id);
  }

  const snapshot = await query.get();
  const pageDocs = snapshot.docs.slice(0, limit);
  const comments = await Promise.all(pageDocs.map((d) => serializeComment(d, viewerId)));
  const hasNextPage = snapshot.docs.length > limit;
  const lastSnapshotDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

  return {
    comments,
    nextCursor:
      hasNextPage && lastSnapshotDoc
        ? encodeCursor(lastSnapshotDoc.get("createdAt"), lastSnapshotDoc.id)
        : null,
  };
}

async function deleteCommentLikes(commentRef: FirebaseFirestore.DocumentReference): Promise<void> {
  const likesSnap = await commentRef.collection("likes").get();
  if (likesSnap.empty) return;
  const batch = db.batch();
  likesSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

async function deleteCommentCascade(
  videoRef: FirebaseFirestore.DocumentReference,
  commentId: string
): Promise<number> {
  const children = await videoRef.collection("comments").where("parentCommentId", "==", commentId).get();
  let removed = 0;
  for (const child of children.docs) {
    removed += await deleteCommentCascade(videoRef, child.id);
  }
  const commentRef = videoRef.collection("comments").doc(commentId);
  await deleteCommentLikes(commentRef);
  await commentRef.delete();
  return removed + 1;
}

export async function deleteVideoComment(
  videoId: string,
  commentId: string,
  userId: string
): Promise<void> {
  const videoRef = db.collection(VIDEOS_COLLECTION).doc(videoId);
  const commentRef = videoRef.collection("comments").doc(commentId);

  const commentSnap = await commentRef.get();
  if (!commentSnap.exists) {
    throw new ServiceError(404, "Comment not found");
  }

  const videoSnap = await videoRef.get();
  if (!videoSnap.exists) {
    throw new ServiceError(404, "Video not found");
  }

  const video = videoSnap.data() as VideoDocument;
  const comment = commentSnap.data() || {};
  if (comment.authorId !== userId && video.ownerId !== userId) {
    throw new ServiceError(403, "Only the comment author or video owner can delete this comment");
  }

  const removed = await deleteCommentCascade(videoRef, commentId);
  await videoRef.update({
    commentCount: admin.firestore.FieldValue.increment(-removed),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function likeVideoComment(
  videoId: string,
  commentId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number; comment: VideoComment }> {
  const videoRef = db.collection(VIDEOS_COLLECTION).doc(videoId);
  const commentRef = videoRef.collection("comments").doc(commentId);
  const likeRef = commentRef.collection("likes").doc(userId);

  await db.runTransaction(async (transaction) => {
    const videoDoc = await transaction.get(videoRef);
    const commentDoc = await transaction.get(commentRef);

    if (!videoDoc.exists) {
      throw new ServiceError(404, "Video not found");
    }
    if (!commentDoc.exists) {
      throw new ServiceError(404, "Comment not found");
    }

    const video = videoDoc.data() as VideoDocument;
    if (!(await canInteractWithVideo(video, userId))) {
      throw new ServiceError(403, "You do not have access to this video");
    }

    const likeDoc = await transaction.get(likeRef);
    if (likeDoc.exists) {
      return;
    }

    transaction.set(likeRef, {
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.update(commentRef, {
      likeCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  const fresh = await commentRef.get();
  const comment = await serializeComment(fresh, userId);
  return { liked: true, likeCount: comment.likeCount, comment };
}

export async function unlikeVideoComment(
  videoId: string,
  commentId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number; comment: VideoComment }> {
  const videoRef = db.collection(VIDEOS_COLLECTION).doc(videoId);
  const commentRef = videoRef.collection("comments").doc(commentId);
  const likeRef = commentRef.collection("likes").doc(userId);

  await db.runTransaction(async (transaction) => {
    const videoDoc = await transaction.get(videoRef);
    const commentDoc = await transaction.get(commentRef);

    if (!videoDoc.exists) {
      throw new ServiceError(404, "Video not found");
    }
    if (!commentDoc.exists) {
      throw new ServiceError(404, "Comment not found");
    }

    const video = videoDoc.data() as VideoDocument;
    if (!(await canInteractWithVideo(video, userId))) {
      throw new ServiceError(403, "You do not have access to this video");
    }

    const likeDoc = await transaction.get(likeRef);
    if (!likeDoc.exists) {
      return;
    }

    transaction.delete(likeRef);
    transaction.update(commentRef, {
      likeCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  const fresh = await commentRef.get();
  const comment = await serializeComment(fresh, userId);
  return { liked: false, likeCount: comment.likeCount, comment };
}

/** Safe fields for link previews / public JSON (public + ready videos only). No playback URLs. */
export interface PublicVideoShareMeta {
  id: string;
  ownerName: string;
  caption: string;
  subject: string;
  thumbnailUrl: string | null;
  durationMs: number | null;
  likeCount: number;
  commentCount: number;
  createdAt: string | null;
}

/**
 * Returns metadata for a **public** and **ready** video (for OG / unfurl).
 * Private, friends-only, uploading, or deleted → null (treat as 404 for callers).
 */
export async function getPublicVideoShareMeta(videoId: string): Promise<PublicVideoShareMeta | null> {
  const doc = await db.collection(VIDEOS_COLLECTION).doc(videoId).get();
  if (!doc.exists) return null;

  const data = doc.data() as VideoDocument;
  if (data.status === "deleted" || data.status !== "ready" || data.visibility !== "public") {
    return null;
  }

  let thumbnailUrl =
    data.thumbnailStoragePath
      ? await createSignedStorageReadUrl(data.thumbnailStoragePath)
      : data.thumbnailUrl || null;

  if (!thumbnailUrl && isSlideshowDoc(data) && data.slides?.length) {
    const first = [...data.slides].sort((a, b) => a.order - b.order)[0];
    if (first?.storagePath) {
      thumbnailUrl = await createSignedStorageReadUrl(first.storagePath);
    }
  }

  return {
    id: doc.id,
    ownerName: data.ownerName,
    caption: data.caption,
    subject: data.subject || "",
    thumbnailUrl,
    durationMs: data.durationMs ?? null,
    likeCount: data.likeCount || 0,
    commentCount: data.commentCount || 0,
    createdAt: serializeTimestamp(data.createdAt),
  };
}
