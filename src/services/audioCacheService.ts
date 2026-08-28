import { storage } from "../config/firebaseConfig";

const reviewAudioFolder = "review-audio";

function getReviewAudioFile(sessionId: string) {
  // Session IDs are generated server-side. Keep this guard in place so a
  // malformed query value can never create an arbitrary storage path.
  const safeSessionId = sessionId.replace(/[^\w.-]/g, "_");
  return storage.bucket().file(`${reviewAudioFolder}/${safeSessionId}.mp3`);
}

// Store review audio in shared, private storage so any API instance can serve
// the subsequent polling request. The client deletes it after first download.
export async function storeAudio(sessionId: string, audioBuffer: Buffer) {
  await getReviewAudioFile(sessionId).save(audioBuffer, {
    metadata: { contentType: "audio/mpeg" },
    resumable: false,
  });
}

export async function retrieveAudio(
  sessionId: string
): Promise<Buffer | undefined> {
  const file = getReviewAudioFile(sessionId);
  const [exists] = await file.exists();
  if (!exists) return undefined;

  const [audioBuffer] = await file.download();
  return audioBuffer;
}

export async function deleteAudio(sessionId: string) {
  const file = getReviewAudioFile(sessionId);
  const [exists] = await file.exists();
  if (exists) await file.delete();
}
