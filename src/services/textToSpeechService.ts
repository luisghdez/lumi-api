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
export async function generateTtsAudioBuffer(text: string): Promise<any> {
  const startTime = Date.now(); // Record start time

  const instructions = "Delivery: Fast-paced and conversational, like a friend cracking up while telling you a hilarious story. Includes quick pauses for effect and occasional bursts of laughter or mock seriousness.\n\nVoice: Upbeat, clever, and a little cheeky — like someone who’s always in on the joke and loves making you laugh without trying too hard.\n\nTone: Playful and informal, with a hint of 'can you believe this?' attitude. Think of a stand-up comic riffing off something wild.\n\nPronunciation: Clear and expressive, but casual — words may run together a bit when the excitement ramps up, with dramatic emphasis on the punchlines.\n";

  try {
    // Call the OpenAI TTS endpoint
    const mp3 = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts", 
      voice: "echo",
      input: text,
      instructions: instructions,
    });

    const endTime = Date.now(); // Record end time
    const duration = endTime - startTime; // Calculate duration in milliseconds

    console.log(`TTS generation with OpenAI took ${duration}ms`); // Log the time taken

    // You could return mp3 or stream it directly here
    return mp3;

  } catch (err) {
    console.error("Error generating TTS audio with OpenAI:", err);
    throw err; // Re-throw the error so it can be caught in the caller
  }
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
