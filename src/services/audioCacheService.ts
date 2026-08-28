import { storage } from "../config/firebaseConfig";

const reviewAudioFolder = "review-audio";

function getReviewAudioFile(sessionId: string) {
  // Session IDs are generated server-side. Keep this guard in place so a
  // malformed query value can never create an arbitrary storage path.
  const safeSessionId = sessionId.replace(/[^\w.-]/g, "_");
  return storage.bucket().file(`${reviewAudioFolder}/${safeSessionId}.mp3`);
}

// Store review audio in shared, private storage so any API instance can serve
// the subsequent polling request. Bind it to the authenticated owner; the
// session ID alone must never authorize access.
export async function storeAudio(
  sessionId: string,
  ownerUid: string,
  audioBuffer: Buffer,
) {
  await getReviewAudioFile(sessionId).save(audioBuffer, {
    metadata: {
      contentType: "audio/mpeg",
      metadata: { ownerUid },
    },
    resumable: false,
  });
}

export async function retrieveAudio(
  sessionId: string,
  ownerUid: string,
): Promise<Buffer | undefined> {
  const file = getReviewAudioFile(sessionId);
  const [exists] = await file.exists();
  if (!exists) return undefined;

  const [metadata] = await file.getMetadata();
  // Treat legacy objects without an owner and mismatched owners as missing so
  // callers cannot use existence or timing to probe another user's audio.
  if (metadata.metadata?.ownerUid !== ownerUid) return undefined;

  const [audioBuffer] = await file.download();
  return audioBuffer;
}

export async function deleteAudio(sessionId: string) {
  const file = getReviewAudioFile(sessionId);
  const [exists] = await file.exists();
  if (exists) await file.delete();
}
