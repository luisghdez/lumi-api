import OpenAI from "openai";
import { qdrant } from "./qdrant";
import { v4 as uuid } from "uuid";
import pdfParse from 'pdf-parse';
import { parseOfficeAsync } from "officeparser";

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
 * Extract text from PDF with page information
 */
async function extractPDFWithPages(fileBuffer: Buffer): Promise<{ text: string; pageNumber: number }[]> {
  try {
    const data = await pdfParse(fileBuffer, {
      // Enable page extraction
      max: 0, // No page limit
    });
    
    // If pdf-parse doesn't provide page-by-page text, we'll split by page breaks
    // This is a fallback approach
    const pages: { text: string; pageNumber: number }[] = [];
    
    if (data.text) {
      // Split by potential page breaks (multiple newlines)
      const pageTexts = data.text.split(/\n{3,}/);
      pageTexts.forEach((pageText, index) => {
        if (pageText.trim()) {
          pages.push({
            text: pageText.trim(),
            pageNumber: index + 1
          });
        }
      });
    }
    
    return pages;
  } catch (error) {
    console.error("Error extracting PDF with pages:", error);
    throw new Error(`Failed to extract PDF text: ${error}`);
  }
}

/**
 * Extract text from PPTX with slide information
 */
async function extractPPTXWithSlides(fileBuffer: Buffer): Promise<{ text: string; slideNumber: number }[]> {
  try {
    const extractedText = await parseOfficeAsync(fileBuffer);
    const slides: { text: string; slideNumber: number }[] = [];
    
    // Split by slide breaks (common patterns in PPTX extraction)
    // Look for patterns that indicate slide breaks
    const slidePatterns = [
      /\n\s*Slide\s+\d+\s*\n/gi,
      /\n\s*Page\s+\d+\s*\n/gi,
      /\n{3,}/g, // Multiple newlines often indicate slide breaks
    ];
    
    let slideTexts = [extractedText];
    
    // Try different patterns to split slides
    for (const pattern of slidePatterns) {
      if (slideTexts.length === 1) {
        slideTexts = extractedText.split(pattern);
      }
    }
    
    // If we still have only one slide, try to split by common slide indicators
    if (slideTexts.length === 1) {
      const lines = extractedText.split('\n');
      const newSlides: string[] = [];
      let currentSlide = '';
      
      for (const line of lines) {
        // Check if line indicates a new slide
        if (line.match(/^(Slide|Page)\s+\d+/i) || 
            line.match(/^[A-Z][A-Z\s]{10,}$/) || // All caps titles often indicate slide titles
            line.trim().length === 0) {
          if (currentSlide.trim()) {
            newSlides.push(currentSlide.trim());
            currentSlide = '';
          }
        }
        currentSlide += line + '\n';
      }
      
      if (currentSlide.trim()) {
        newSlides.push(currentSlide.trim());
      }
      
      if (newSlides.length > 1) {
        slideTexts = newSlides;
      }
    }
    
    slideTexts.forEach((slideText, index) => {
      if (slideText.trim()) {
        slides.push({
          text: slideText.trim(),
          slideNumber: index + 1
        });
      }
    });
    
    return slides;
  } catch (error) {
    console.error("Error extracting PPTX with slides:", error);
    throw new Error(`Failed to extract PPTX text: ${error}`);
  }
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
