import { admin, db } from "../config/firebaseConfig";
import {
  buildVideoStoragePath,
  createSignedVideoPlaybackUrl,
  createSignedVideoUploadUrl,
  deleteStoredVideo,
  getStoredVideoMetadata,
  SignedUploadTarget,
} from "./videoStorageService";

export type VideoVisibility = "public" | "friends" | "private";
export type VideoStatus = "uploading" | "processing" | "ready" | "failed" | "deleted";

export interface CreateVideoInput {
  caption?: string;
  mimeType: string;
  visibility?: VideoVisibility;
}

export interface CompleteVideoUploadInput {
  durationMs?: number;
  thumbnailUrl?: string;
}

export interface VideoComment {
  id: string;
  authorId: string;
  authorName: string;
  authorProfilePicture: string;
  text: string;
  likeCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface VideoResponse {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerProfilePicture: string;
  caption: string;
  storagePath: string;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
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

interface VideoDocument {
  ownerId: string;
  ownerName: string;
  ownerProfilePicture: string;
  caption: string;
  storagePath: string;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
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
const MAX_COMMENT_LENGTH = 500;
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;

function assertVideoMimeType(mimeType: string): void {
  if (!mimeType || !mimeType.toLowerCase().startsWith("video/")) {
    throw new ServiceError(400, "mimeType must be a video MIME type");
  }
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

function canReadVideo(video: VideoDocument, viewerId: string): boolean {
  if (video.status === "deleted") return false;
  if (video.ownerId === viewerId) return true;
  return video.status === "ready" && video.visibility === "public";
}

function canInteractWithVideo(video: VideoDocument, viewerId: string): boolean {
  return video.status === "ready" && canReadVideo(video, viewerId);
}

async function serializeVideo(
  doc: FirebaseFirestore.DocumentSnapshot,
  viewerId: string
): Promise<VideoResponse> {
  const data = doc.data() as VideoDocument;
  const likedByMe = (
    await doc.ref.collection("likes").doc(viewerId).get()
  ).exists;

  const playbackUrl =
    data.status === "ready" && data.storagePath
      ? await createSignedVideoPlaybackUrl(data.storagePath)
      : null;

  return {
    id: doc.id,
    ownerId: data.ownerId,
    ownerName: data.ownerName,
    ownerProfilePicture: data.ownerProfilePicture,
    caption: data.caption,
    storagePath: data.storagePath,
    playbackUrl,
    thumbnailUrl: data.thumbnailUrl || null,
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

export async function createVideoUpload(
  ownerId: string,
  input: CreateVideoInput
): Promise<{ video: VideoResponse; upload: SignedUploadTarget }> {
  assertVideoMimeType(input.mimeType);

  const userDoc = await getUserSnapshot(ownerId);
  const userData = userDoc.data() || {};
  const videoRef = db.collection(VIDEOS_COLLECTION).doc();
  const storagePath = buildVideoStoragePath(ownerId, videoRef.id, input.mimeType);
  const upload = await createSignedVideoUploadUrl(storagePath, input.mimeType);

  const video: VideoDocument = {
    ownerId,
    ownerName: userData.name || "Unknown User",
    ownerProfilePicture: userData.profilePicture || "default",
    caption: normalizeCaption(input.caption),
    storagePath,
    playbackUrl: null,
    thumbnailUrl: null,
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
  };
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

  const storedMetadata = await getStoredVideoMetadata(video.storagePath);
  if (!storedMetadata) {
    throw new ServiceError(400, "Uploaded video file was not found in storage");
  }

  await videoRef.update({
    status: "ready",
    sizeBytes: storedMetadata.sizeBytes ?? video.sizeBytes ?? null,
    mimeType: storedMetadata.contentType || video.mimeType,
    durationMs: typeof input.durationMs === "number" ? input.durationMs : video.durationMs ?? null,
    thumbnailUrl: input.thumbnailUrl || video.thumbnailUrl || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return getVideoById(videoId, ownerId);
}

export async function getVideoById(videoId: string, viewerId: string): Promise<VideoResponse> {
  const videoDoc = await db.collection(VIDEOS_COLLECTION).doc(videoId).get();

  if (!videoDoc.exists) {
    throw new ServiceError(404, "Video not found");
  }

  const video = videoDoc.data() as VideoDocument;
  if (video.status === "deleted") {
    throw new ServiceError(404, "Video not found");
  }
  if (!canReadVideo(video, viewerId)) {
    throw new ServiceError(403, "You do not have access to this video");
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

  await deleteStoredVideo(video.storagePath);
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
    if (!canInteractWithVideo(video, userId)) {
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
    if (!canInteractWithVideo(video, userId)) {
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
  text: string
): Promise<VideoComment> {
  const normalizedText = normalizeComment(text);
  const userDoc = await getUserSnapshot(authorId);
  const userData = userDoc.data() || {};
  const videoRef = db.collection(VIDEOS_COLLECTION).doc(videoId);
  const commentRef = videoRef.collection("comments").doc();

  await db.runTransaction(async (transaction) => {
    const videoDoc = await transaction.get(videoRef);

    if (!videoDoc.exists) {
      throw new ServiceError(404, "Video not found");
    }

    const video = videoDoc.data() as VideoDocument;
    if (!canInteractWithVideo(video, authorId)) {
      throw new ServiceError(403, "You do not have access to this video");
    }

    transaction.set(commentRef, {
      authorId,
      authorName: userData.name || "Unknown User",
      authorProfilePicture: userData.profilePicture || "default",
      text: normalizedText,
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
  return serializeComment(createdComment);
}

function serializeComment(doc: FirebaseFirestore.DocumentSnapshot): VideoComment {
  const data = doc.data() || {};
  return {
    id: doc.id,
    authorId: data.authorId,
    authorName: data.authorName,
    authorProfilePicture: data.authorProfilePicture,
    text: data.text,
    likeCount: data.likeCount || 0,
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
  const docs = snapshot.docs.slice(0, limit);
  const comments = docs.map(serializeComment);
  const hasNextPage = snapshot.docs.length > limit;
  const lastDoc = docs[docs.length - 1];

  return {
    comments,
    nextCursor: hasNextPage && lastDoc ? encodeCursor(lastDoc.get("createdAt"), lastDoc.id) : null,
  };
}

export async function deleteVideoComment(
  videoId: string,
  commentId: string,
  userId: string
): Promise<void> {
  const videoRef = db.collection(VIDEOS_COLLECTION).doc(videoId);
  const commentRef = videoRef.collection("comments").doc(commentId);

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
    const comment = commentDoc.data() || {};
    if (comment.authorId !== userId && video.ownerId !== userId) {
      throw new ServiceError(403, "Only the comment author or video owner can delete this comment");
    }

    transaction.delete(commentRef);
    transaction.update(videoRef, {
      commentCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}
