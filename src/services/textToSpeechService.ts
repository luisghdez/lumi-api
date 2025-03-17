// services/textToSpeechService.ts

import OpenAI from "openai";

// Instantiate your OpenAI client
const openai = new OpenAI();

/**
 * Generate a TTS mp3 buffer from OpenAI. 
 * This function returns a raw Buffer so we can embed it in Base64.
 */
export async function generateTtsAudioBuffer(text: string): Promise<Buffer> {
  // 1) Call the TTS endpoint
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: "echo",
    input: text,
    // speed: 1.2,
  });

  // 2) Convert result to a Node.js Buffer
  const audioBuffer = Buffer.from(await mp3.arrayBuffer());
  return audioBuffer;
}
