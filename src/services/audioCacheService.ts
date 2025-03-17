// A simple in-memory store for TTS audio buffers.
// In production, consider using Redis or another cache with TTL support.
const audioCache: { [key: string]: Buffer } = {};

// Store an audio buffer under a sessionId.
export function storeAudio(sessionId: string, audioBuffer: Buffer) {
  audioCache[sessionId] = audioBuffer;
}

// Retrieve an audio buffer by sessionId.
export function retrieveAudio(sessionId: string): Buffer | undefined {
  return audioCache[sessionId];
}

// Delete an audio buffer from the cache.
export function deleteAudio(sessionId: string) {
  delete audioCache[sessionId];
}
