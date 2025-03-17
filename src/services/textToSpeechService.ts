import OpenAI from "openai";
import { ElevenLabsClient } from "elevenlabs";

// Instantiate your OpenAI client
const openai = new OpenAI();

// Instantiate your ElevenLabs client.
// Replace "YOUR_API_KEY" with your actual API key or load it from an environment variable.
const elevenLabsClient = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY || "YOUR_API_KEY" });

/**
 * Generate a TTS mp3 buffer from OpenAI.
 * This function returns a raw Buffer so we can embed it in Base64.
 */
export async function generateTtsAudioBuffer(text: string): Promise<Buffer> {
  // Call the OpenAI TTS endpoint
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: "echo",
    input: text,
    // Optional: speed: 1.2,
  });
  // Convert result to a Node.js Buffer
  const audioBuffer = Buffer.from(await mp3.arrayBuffer());
  return audioBuffer;
}

/**
 * Generate a TTS mp3 buffer using the ElevenLabs API.
 * This function returns a raw Buffer for embedding in Base64.
 */
export async function generateElevenLabsTtsAudioBuffer(text: string): Promise<Buffer> {
  // Define the voice and model you want to use. These IDs are examples.
  const voiceIdMarkNormal = "UgBBYS2sOqTuMpoF3BR0";
  const voiceIdStuartAus = "HDA9tsk27wYi3uq0fPcK";

  const voiceId = voiceIdMarkNormal;
  const modelId = "eleven_flash_v2_5";

  // Call the ElevenLabs TTS endpoint
  const response = await elevenLabsClient.textToSpeech.convert(voiceId, {
    output_format: "mp3_44100_128",
    text: text,
    model_id: modelId
  });

  // Convert the response stream to a Buffer
  const chunks: Buffer[] = [];
  for await (const chunk of response) {
    chunks.push(chunk);
  }
  const audioBuffer = Buffer.concat(chunks);
  return audioBuffer;
}
