import OpenAI from "openai";
import { qdrant } from "./qdrant";
import { v4 as uuid } from "uuid";
import { parseOfficeAsync } from "officeparser";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import pdfParse from 'pdf-parse';


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

export interface FileChunk {
  text: string;
  fileIndex: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  slideNumber?: number;
  pageNumber?: number;
  chunkIndex?: number;
}

export interface ProcessedFile {
  fileName: string;
  originalName: string;
  mimeType: string;
  fileIndex: number;
  chunks: FileChunk[];
}

/**
 * Reliable per-page PDF text using pdf-parse's pagerender hook.
 * No ESM/CJS issues; works in Node/ts-node out of the box.
 */
async function extractPDFWithPages(
  fileBuffer: Buffer
): Promise<Array<{ text: string; pageNumber: number }>> {
  const pageBuckets: Array<{ text: string; pageNumber: number } | undefined> = [];

  await pdfParse(fileBuffer, {
    max: 0, // no page limit
    // Synchronous pagerender
    pagerender: (pageData: any) => {
      // pdf-parse calls this with a PageProxy from pdf.js
      return pageData.getTextContent().then((content: any) => {
        const text = (content.items as any[])
          .map((it: any) => (typeof it?.str === "string" ? it.str : ""))
          .join(" ")
          .replace(/\s{2,}/g, " ")
          .trim();

        const pageNumber = (pageData.pageIndex ?? 0) + 1;
        pageBuckets[pageData.pageIndex ?? 0] = { text, pageNumber };

        return text;
      });
    },
  });

  return pageBuckets.filter(Boolean) as Array<{ text: string; pageNumber: number }>;
}




type SlideOut = { text: string; slideNumber: number };

// ---- Parser (UPDATED: easier attribute handling) ----
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: "",                    // attrs like "Id", "Target", "r:id"
  transformAttributeName: (n) => n.replace(/^@_/, ""), // drop "@_"
});

// ---- Helpers (NEW/UPDATED) ----
function getArray<T>(x: T | T[] | undefined): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function getAttr(o: any, ...keys: string[]) {
  for (const k of keys) {
    if (o && o[k] != null) return o[k];
  }
  return undefined;
}

async function mustRead(zip: JSZip, path: string): Promise<string> {
  const f = zip.file(path);
  if (!f) throw new Error(`Missing ${path} in PPTX`);
  return f.async("string");
}

function normalizeTargetPath(target: string): string {
  // handles "slides/slide1.xml", "./slides/slide1.xml", "../slides/slide1.xml", "/ppt/slides/slide1.xml"
  let t = (target || "").replace(/^[.\/]+/, ""); // strip leading ./, ../, /
  if (!t.startsWith("ppt/")) t = `ppt/${t}`;
  return t;
}

function collectSlideText(node: any, out: string[]) {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const n of node) collectSlideText(n, out);
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "t") {
        if (typeof v === "string") out.push(v);
        else if (v && typeof (v as any)["#text"] === "string") out.push((v as any)["#text"]);
        continue;
      }
      if (k === "br") {
        out.push("\n");
        continue;
      }
      if (k === "p") out.push("\n"); // paragraph boundary
      collectSlideText(v, out);
    }
  }
}

// ---- MAIN (UPDATED) ----
export async function extractPPTXWithSlides(fileBuffer: Buffer): Promise<SlideOut[]> {
  const zip = await JSZip.loadAsync(fileBuffer);

  // presentation.xml -> slide ids
  const presXml = await mustRead(zip, "ppt/presentation.xml");
  const pres = xmlParser.parse(presXml);
  const sldIdNodes = getArray(pres?.presentation?.sldIdLst?.sldId);

  // presentation.xml.rels -> rId -> Target
  const relsXml = await mustRead(zip, "ppt/_rels/presentation.xml.rels");
  const rels = xmlParser.parse(relsXml);
  const relList = getArray(rels?.Relationships?.Relationship);

  const relMap = new Map<string, string>();
  for (const r of relList) {
    const id = getAttr(r, "Id", "ID", "id");                    // flexible casing
    const target = getAttr(r, "Target", "target", "TARGET");
    if (id && target) relMap.set(id, target);
  }

  const results: SlideOut[] = [];

  // Prefer declared order via r:id mapping; fallback if missing
  if (sldIdNodes.length) {
    let slideIndex = 0;
    for (const sld of sldIdNodes) {
      // different decks expose r:id as "r:id", or sometimes just "Id"/"id"
      const rid = getAttr(sld, "r:id", "rId", "Id", "id") as string | undefined;
      if (!rid) continue;

      const target = relMap.get(rid);
      if (!target) continue;

      const slidePath = normalizeTargetPath(target);
      const slideXml = await mustRead(zip, slidePath);
      const slideDoc = xmlParser.parse(slideXml);

      const chunks: string[] = [];
      collectSlideText(slideDoc, chunks);

      const text = chunks.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      slideIndex += 1;
      results.push({ text, slideNumber: slideIndex });
    }
  }

  // Fallback: enumerate slide files directly if mapping failed
  if (results.length === 0) {
    const slideFiles = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p));
    slideFiles.sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
      return na - nb;
    });

    let slideIndex = 0;
    for (const slidePath of slideFiles) {
      const slideXml = await mustRead(zip, slidePath);
      const slideDoc = xmlParser.parse(slideXml);
      const chunks: string[] = [];
      collectSlideText(slideDoc, chunks);
      const text = chunks.join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      slideIndex += 1;
      results.push({ text, slideNumber: slideIndex });
    }
  }

  return results;
}


/**
 * Process text chunks with metadata for regular text files
 */
function processTextChunks(text: string, fileIndex: number, fileName: string, originalName: string, mimeType: string): FileChunk[] {
  const chunks = createSemanticChunks(text);
  
  return chunks.map((chunk, chunkIndex) => ({
    text: chunk,
    fileIndex,
    fileName,
    originalName,
    mimeType,
    chunkIndex: chunkIndex + 1
  }));
}

/**
 * Create semantic chunks from text (existing logic)
 */
function createSemanticChunks(rawText: string): string[] {
  const paragraphs = rawText
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

  return chunks;
}

/**
 * Process PDF files by page
 */
async function processPDFFile(fileBuffer: Buffer, fileIndex: number, fileName: string, originalName: string): Promise<FileChunk[]> {
  const pages = await extractPDFWithPages(fileBuffer);
  const chunks: FileChunk[] = [];
  
  for (const page of pages) {
    const pageChunks = createSemanticChunks(page.text);
    
    pageChunks.forEach((chunk, chunkIndex) => {
      chunks.push({
        text: chunk,
        fileIndex,
        fileName,
        originalName,
        mimeType: "application/pdf",
        pageNumber: page.pageNumber,
        chunkIndex: chunkIndex + 1
      });
    });
  }
  
  return chunks;
}

/**
 * Process PPTX files by slide
 */
async function processPPTXFile(fileBuffer: Buffer, fileIndex: number, fileName: string, originalName: string): Promise<FileChunk[]> {
  const slides = await extractPPTXWithSlides(fileBuffer);
  const chunks: FileChunk[] = [];
  
  for (const slide of slides) {
    const slideChunks = createSemanticChunks(slide.text);
    
    slideChunks.forEach((chunk, chunkIndex) => {
      chunks.push({
        text: chunk,
        fileIndex,
        fileName,
        originalName,
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        slideNumber: slide.slideNumber,
        chunkIndex: chunkIndex + 1
      });
    });
  }
  
  return chunks;
}

/**
 * Enhanced embed and store function that handles different file types with metadata
 */
export async function embedAndStoreWithMetadata(
  courseId: string,
  files: Array<{
    buffer: Buffer;
    fileName: string;
    originalName: string;
    mimeType: string;
  }>
): Promise<{ coarseChunks: string[]; processedFiles: ProcessedFile[] }> {
  
  const allChunks: FileChunk[] = [];
  const processedFiles: ProcessedFile[] = [];
  
  // Process each file based on its type
  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex];
    let fileChunks: FileChunk[] = [];
    
    try {
      if (file.mimeType === "application/pdf") {
        console.log(`Processing PDF file: ${file.originalName}`);
        fileChunks = await processPDFFile(file.buffer, fileIndex, file.fileName, file.originalName);
      } else if (file.mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        console.log(`Processing PPTX file: ${file.originalName}`);
        fileChunks = await processPPTXFile(file.buffer, fileIndex, file.fileName, file.originalName);
      } else {
        // For other file types (DOCX, plain text, etc.), extract text and chunk normally
        console.log(`Processing ${file.mimeType} file: ${file.originalName}`);
        let extractedText = "";
        
        if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            file.mimeType === "application/msword") {
          extractedText = await parseOfficeAsync(file.buffer);
        } else {
          extractedText = file.buffer.toString("utf8");
        }
        
        fileChunks = processTextChunks(extractedText, fileIndex, file.fileName, file.originalName, file.mimeType);
      }
      
      allChunks.push(...fileChunks);
      
      processedFiles.push({
        fileName: file.fileName,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileIndex,
        chunks: fileChunks
      });
      
      console.log(`✅ Processed ${file.originalName}: ${fileChunks.length} chunks`);
      
    } catch (error) {
      console.error(`❌ Error processing file ${file.originalName}:`, error);
      // Continue with other files
    }
  }
  
  if (allChunks.length === 0) {
    return { coarseChunks: [], processedFiles };
  }
  
  // Embed all chunks
  const allVectors: number[][] = [];
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const batchTexts = batch.map(chunk => chunk.text);
    
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batchTexts,
    });
    allVectors.push(...res.data.map(d => d.embedding as number[]));
  }
  
  // Store in Qdrant with enhanced metadata
  const collection = `course_${courseId}`;
  
  try {
    await qdrant.getCollection(collection);
  } catch {
    await qdrant.createCollection(collection, {
      vectors: { size: EMBED_DIM, distance: "Cosine" },
    });
  }
  
  await qdrant.upsert(collection, {
    points: allChunks.map((chunk, idx) => ({
      id: uuid(),
      vector: allVectors[idx],
      payload: { 
        text: chunk.text, 
        idx,
        fileIndex: chunk.fileIndex,
        fileName: chunk.fileName,
        originalName: chunk.originalName,
        mimeType: chunk.mimeType,
        slideNumber: chunk.slideNumber,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex
      },
    })),
  });
  
  // Build coarse chunks for LLM
  const coarseChunks: string[] = [];
  let bufText = "";
  
  for (const chunk of allChunks) {
    if (tokenCount(bufText) + tokenCount(chunk.text) > COARSE_LLM_MAX) {
      coarseChunks.push(bufText.trim());
      bufText = chunk.text;
    } else {
      bufText += "\n" + chunk.text;
    }
  }
  if (bufText.trim()) coarseChunks.push(bufText.trim());
  
  return { coarseChunks, processedFiles };
}

// Backward compatibility function
export async function embedAndStore(
  courseId: string,
  rawText: string[],
) {
  // Convert raw text to file-like structure for backward compatibility
  const files = rawText.map((text, index) => ({
    buffer: Buffer.from(text, 'utf8'),
    fileName: `text_${index}`,
    originalName: `text_content_${index}`,
    mimeType: "text/plain"
  }));
  
  const result = await embedAndStoreWithMetadata(courseId, files);
  return result.coarseChunks;
}
