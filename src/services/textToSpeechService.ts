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

  const instructions = "Delivery: Naturally conversational and relaxed, like a cool friend sharing a funny story that just happened. Pacing is lively but not rushed, with smooth pauses for effect and the occasional amused chuckle or subtle sarcasm to keep it engaging.\n\nVoice: Witty, warm, and laid-back — like someone who’s quick with a clever line but never tries too hard. The kind of person you’d love to grab coffee with because they always have something funny or surprising to say.\n\nTone: Casual and playful with a “you won’t believe this” vibe. More smirking than shouting — it feels like they’re letting you in on something funny rather than performing for a crowd.\n\nPronunciation: Clear and expressive, with natural flow. Words might run together slightly when they get excited, but it’s never sloppy — just part of the charm. Emphasis lands where it matters most, especially for jokes or punchlines, but always feels chill and effortless.";

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
