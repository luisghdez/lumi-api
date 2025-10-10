// src/services/embedAndChunk.ts
import OpenAI from "openai";
import { qdrant } from "./qdrant";
import { v4 as uuid } from "uuid";

const openai = new OpenAI();

export const EMBED_DIM = 1536;           // text-embedding-3-small

// ==== tunables =============================================================
const MAX_CHARS_PER_BLOCK = 2_000;       // if a paragraph is bigger, split by sentence
const MIN_CHARS_PER_CHUNK = 500;         // ~125 tokens  (lower bound)
const MAX_CHARS_PER_CHUNK = 1_200;       // ~300 tokens  (upper bound)
const OVERLAP_SENTENCES   = 1;           // sentence overlap between chunks
const BATCH_SIZE          = 100;         // embedding batch size
const COARSE_LLM_MAX      = 1_500;       // merge chunks for LLM prompts (< ~375 tokens)
// ===========================================================================

const sentenceRegex = /[^.!?]+[.!?]+/g;
const tokenCount = (s: string) => Math.ceil(s.length / 4);  // rough heuristic

export async function embedAndStore(
  courseId: string,
  rawText: string[],
) {
  /* --------------------------------------------------------------------- */
  /* 1 ── Build SEMANTIC chunks (paragraph → sentence → sliding window)     */
  /* --------------------------------------------------------------------- */
  const paragraphs = rawText
    .join("\n")
    .split(/\n{2,}/g)          // break on blank lines / slide breaks
    .map(p => p.trim())
    .filter(Boolean);

  // Step 1b – explode over-long paragraphs into sentences
  const smallBlocks: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= MAX_CHARS_PER_BLOCK) {
      smallBlocks.push(p);
    } else {
      const sents = p.match(sentenceRegex) ?? [p];
      smallBlocks.push(...sents.map(s => s.trim()));
    }
  }

  // Step 1c – sliding window accumulation with overlap
  const chunks: string[] = [];
  let buf = "";
  let bufSents: string[] = [];

  for (let i = 0; i < smallBlocks.length; i++) {
    const block = smallBlocks[i];

    // If the block alone is gigantic (rare), hard-split by sentences
    if (block.length > MAX_CHARS_PER_CHUNK) {
      const sents = block.match(sentenceRegex) ?? [block];
      smallBlocks.splice(i, 1, ...sents);       // replace in-place
      i--;                                      // re-evaluate
      continue;
    }

    // Try to add the block to the current buffer
    if ((buf + " " + block).length <= MAX_CHARS_PER_CHUNK) {
      buf += (buf ? "\n" : "") + block;
      bufSents.push(...(block.match(sentenceRegex) ?? [block]));
    } else {
      // Flush buffer if it meets the min size
      if (buf.length >= MIN_CHARS_PER_CHUNK) {
        chunks.push(buf.trim());
        // keep overlap
        const overlap = bufSents.slice(-OVERLAP_SENTENCES).join(" ");
        buf = overlap;
        bufSents = overlap ? [overlap] : [];
      } else {
        // buffer too small – force-add current block
        buf += (buf ? "\n" : "") + block;
      }
    }
  }
  if (buf.trim().length) chunks.push(buf.trim());

  if (chunks.length === 0) return [];

  /* --------------------------------------------------------------------- */
  /* 2 ── Embed in batches and build topicChunks for Qdrant                */
  /* --------------------------------------------------------------------- */
  const allVectors: number[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    allVectors.push(...res.data.map(d => d.embedding as number[]));
  }

  const topicChunks = chunks.map((text, idx) => ({
    text,
    embedding: allVectors[idx],
  }));

  /* --------------------------------------------------------------------- */
  /* 3 ── Upsert into (or create) the per-course Qdrant collection         */
  /* --------------------------------------------------------------------- */
  const collection = `course_${courseId}`;

  try {
    await qdrant.getCollection(collection);
  } catch {
    await qdrant.createCollection(collection, {
      vectors: { size: EMBED_DIM, distance: "Cosine" },
    });
  }

  await qdrant.upsert(collection, {
    points: topicChunks.map(({ text, embedding }, idx) => ({
      id: uuid(),
      vector: embedding,
      payload: { text, idx },
    })),
  });

  /* --------------------------------------------------------------------- */
  /* 4 ── Build “coarse” chunks for the LLM question-generation step       */
  /* --------------------------------------------------------------------- */
  const coarseChunks: string[] = [];
  let bufText = "";

  for (const { text } of topicChunks) {
    if (tokenCount(bufText) + tokenCount(text) > COARSE_LLM_MAX) {
      coarseChunks.push(bufText.trim());
      bufText = text;
    } else {
      bufText += "\n" + text;
    }
  }
  if (bufText.trim()) coarseChunks.push(bufText.trim());

  return coarseChunks;
}
