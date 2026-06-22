import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI();

/**
 * Transcribe user audio question - ONLY transcription, no AI response yet
 */
export async function transcribeUserAudioQuestion(
  file: any,
  filename: string
): Promise<string> {
  console.log("🎧 Transcribing audio question...");

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1", // or "gpt-4o-mini-transcribe" if that's your model
  });

  const text = transcription.text.trim();
  console.log(`📝 Transcript: ${text}`);

  return text;
}