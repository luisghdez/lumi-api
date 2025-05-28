// src/services/embedAndChunk.ts
import OpenAI from "openai";
import { qdrant } from "./qdrant";
import { v4 as uuid } from "uuid";

const openai = new OpenAI();

export const EMBED_DIM = 1536;                      // text-embedding-3-small

export async function embedAndStore(
  courseId: string,
  rawText: string[],
) {

    // bump sim threshold down and allow larger chunks
    const SIM_THRESHOLD = 0.6;
    const MAX_TOKENS    = 1500;
    const SENTENCES_PER_CHUNK = 3; // Group N sentences for each initial chunk

  // A – Split text into individual sentences first
  const individualSentences = rawText
    .join("\n")
    .replace(/\s+/g, ' ') // Normalize whitespace
    .match(/[^.!?]+[.!?]+/g) ?? [];

  // A.1 - Group individual sentences into desired chunk size
  const sentences: string[] = []; // This will now hold chunks of ~SENTENCES_PER_CHUNK sentences
  if (individualSentences.length > 0) {
    for (let i = 0; i < individualSentences.length; i += SENTENCES_PER_CHUNK) {
      const chunk = individualSentences.slice(i, i + SENTENCES_PER_CHUNK).join(" ").trim();
      if (chunk) { // Ensure chunk is not empty
        sentences.push(chunk);
      }
    }
  }

  // Helper function for token counting - defined in an outer scope
  const tokenCount = (s: string) => Math.ceil(s.length / 4); // rough

  // B – embed in batches of 100 chunks (previously sentences)
  const allVectors: number[][] = [];
  if (sentences.length > 0) {
    for (let i = 0; i < sentences.length; i += 100) {
      const batch = sentences.slice(i, i + 100);
      const res = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: batch,
      });
      allVectors.push(...res.data.map((d) => d.embedding as number[]));
    }
  }

  // C – merge adjacent sentences if cosine sim > SIM_THRESHOLD or len < MAX_TOKENS
  const topicChunks: { text: string; embedding: number[] }[] = [];
  
  // Ensure we have sentences and vectors to process, and they are of the same length
  if (sentences.length > 0 && allVectors.length > 0 && sentences.length === allVectors.length) {
    let buf = sentences[0]; // sentences[0] is now a multi-sentence chunk
    let bufVec = allVectors[0]; // embedding of that multi-sentence chunk

    const cosine = (a: number[], b: number[]) =>
      a.reduce((s, v, idx) => s + v * b[idx], 0) /
      (Math.hypot(...a) * Math.hypot(...b));

    for (let i = 1; i < sentences.length; i++) {
      const sim = cosine(bufVec, allVectors[i]);
      const merged = `${buf} ${sentences[i]}`; // Merging two multi-sentence chunks
      if (sim > SIM_THRESHOLD && tokenCount(merged) < MAX_TOKENS) {
        buf = merged;
        bufVec = bufVec.map(
          (v, idx) => (v + allVectors[i][idx]) / 2,
        );
      } else {
        topicChunks.push({ text: buf, embedding: bufVec });
        buf = sentences[i];
        bufVec = allVectors[i];
      }
    }
    // Push the last buffered chunk if it exists
    if (buf && bufVec) {
        topicChunks.push({ text: buf, embedding: bufVec });
    }
  }

  // D – ensure collection exists once per course
  const collection = `course_${courseId}`;
  try {
    await qdrant.getCollection(collection);
  } catch {
    await qdrant.createCollection(collection, {
      vectors: { size: EMBED_DIM, distance: "Cosine" },
    });
  }

  // E – upsert points only if there are topicChunks to upsert
  if (topicChunks.length > 0) {
    await qdrant.upsert(collection, {
        points: topicChunks.map(({ text, embedding }, idx) => ({
        id: uuid(),
        vector: embedding,
        payload: { text, idx },
        })),
    });
  }           

    const LLM_MAX = 1500;               
    const coarseChunks: string[] = [];

    let bufText = '';
    // Ensure topicChunks is not empty before processing for coarseChunks
    if (topicChunks.length > 0) {
        for (const { text } of topicChunks) {
        if (tokenCount(bufText) + tokenCount(text) > LLM_MAX) {
            coarseChunks.push(bufText.trim());
            bufText = text;
        } else {
            bufText += '\n' + text;
        }
        }
        if (bufText.trim()) coarseChunks.push(bufText.trim());
    }
    return coarseChunks;
}
