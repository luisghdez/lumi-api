import OpenAI from "openai";

const openai = new OpenAI();

/**
 * OpenAI TTS voice types
 */
type OpenAIVoice =
  | "alloy"
  | "ash"
  | "coral"
  | "echo"
  | "fable"
  | "onyx"
  | "nova"
  | "sage"
  | "shimmer";

/**
 * Podcast speaker types
 */
export type PodcastSpeaker = "Host A" | "Host B";

/**
 * Voice mapping for podcast hosts
 * Host A (Male): echo - analytical but witty
 * Host B (Female): shimmer - curious, light-hearted
 */
const PODCAST_VOICES: Record<PodcastSpeaker, OpenAIVoice> = {
  "Host A": "echo",      // Male voice
  "Host B": "shimmer",   // Female voice - try this instead of ash
};

/**
 * Instructions for podcast-style delivery
 */
const PODCAST_INSTRUCTIONS = {
  "Host A": `Delivery: Educational yet engaging, like a knowledgeable friend explaining something fascinating. Pacing is clear and measured with natural pauses for emphasis. Occasionally analytical but keeps it conversational and witty.

Voice: Confident, warm, and articulate — like a professor who actually makes learning fun. Smart without being condescending.

Tone: Informative with subtle humor. Professional but approachable, like someone who genuinely enjoys teaching and sharing knowledge.

Pronunciation: Clear and well-enunciated, with natural emphasis on key concepts. Pauses thoughtfully to let important points land.`,

  "Host B": `Delivery: Naturally curious and conversational, like an enthusiastic student asking great questions. Pacing is lively and engaged, with genuine-sounding reactions and moments of discovery.

Voice: Bright, friendly, and light-hearted — like someone who gets excited about learning new things and isn't afraid to ask "but why?"

Tone: Curious and playful with an authentic "that's so cool!" vibe. Warm and relatable, making complex topics feel accessible.

Pronunciation: Clear and expressive, with natural inflections showing genuine interest. Emphasis on surprising facts or "aha!" moments.`,
};

/**
 * Generate TTS audio for a podcast host
 * Returns a Buffer that can be uploaded to storage
 */
export async function generatePodcastTtsAudio(
  text: string,
  speaker: PodcastSpeaker
): Promise<Buffer> {
  const startTime = Date.now();
  const voice = PODCAST_VOICES[speaker];
  const instructions = PODCAST_INSTRUCTIONS[speaker];

  try {
    console.log(`🎙️ Generating TTS for ${speaker} (voice: ${voice})...`);

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      instructions,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const duration = Date.now() - startTime;
    
    console.log(`✅ Generated ${speaker} audio in ${duration}ms (${buffer.length} bytes)`);
    return buffer;
  } catch (err) {
    console.error(`❌ TTS generation failed for ${speaker}:`, err);
    throw new Error(`Failed to generate audio for ${speaker}: ${err}`);
  }
}

/**
 * Helper: Get the voice ID for a speaker (for debugging/logging)
 */
export function getVoiceForSpeaker(speaker: PodcastSpeaker): OpenAIVoice {
  return PODCAST_VOICES[speaker];
}

/**
 * Helper: Test both voices with sample text
 * Useful for debugging which voices work best
 */
export async function testPodcastVoices(): Promise<{
  hostA: Buffer;
  hostB: Buffer;
}> {
  const sampleText = "Hello! Welcome to our educational podcast. Today we're exploring fascinating topics together.";

  console.log("🧪 Testing podcast voices...");

  const [hostA, hostB] = await Promise.all([
    generatePodcastTtsAudio(sampleText, "Host A"),
    generatePodcastTtsAudio(sampleText, "Host B"),
  ]);

  console.log("✅ Voice test complete!");

  return { hostA, hostB };
}

/**
 * Alternative voice options if shimmer doesn't work well
 * Uncomment and modify PODCAST_VOICES above to try different combinations
 */
export const ALTERNATIVE_VOICES = {
  // Female options:
  // "nova" - warm, friendly female
  // "shimmer" - expressive, engaging female
  // "coral" - clear, professional female
  
  // Male options:
  // "echo" - confident, articulate male
  // "onyx" - deep, authoritative male
  // "fable" - warm, storytelling male
};