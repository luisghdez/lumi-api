import OpenAI from "openai";
import { qdrant } from "./qdrant";
import { EMBED_DIM } from "./embedAndChunk";

interface RetrievedChunk {
  text: string;
  idx?: number;
  score: number;
  fileIndex?: number;
  fileName?: string;
  originalName?: string;
  mimeType?: string;
  slideNumber?: number;
  pageNumber?: number;
  chunkIndex?: number;
}

interface RetrievalResult {
  context: string;
  chunks: RetrievedChunk[];
}

const openai = new OpenAI();

export async function searchCourseContext(
  courseId: string,
  query: string,
  topK: number = 8
): Promise<RetrievalResult> {
  const collection = `course_${courseId}`;

  // Ensure collection exists (will throw if not)
  await qdrant.getCollection(collection);

  // Embed the query
  const embed = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });

  const queryVector = embed.data[0].embedding as number[];

  // Guard: confirm vector size if collection was created elsewhere
  if (typeof EMBED_DIM === "number" && queryVector.length !== EMBED_DIM) {
    throw new Error(
      `Query embedding dim ${queryVector.length} does not match expected ${EMBED_DIM}`
    );
  }

  // Search topK most similar chunks
  const results = await qdrant.search(collection, {
    vector: queryVector,
    limit: topK,
    with_payload: true,
    with_vector: false,
  } as any);

  const chunks: RetrievedChunk[] = (results || []).map((r: any) => ({
    text: r?.payload?.text ?? "",
    idx: r?.payload?.idx,
    score: typeof r?.score === "number" ? r.score : 0,
    fileIndex: r?.payload?.fileIndex,
    fileName: r?.payload?.fileName,
    originalName: r?.payload?.originalName,
    mimeType: r?.payload?.mimeType,
    slideNumber: r?.payload?.slideNumber,
    pageNumber: r?.payload?.pageNumber,
    chunkIndex: r?.payload?.chunkIndex,
  })).filter(c => c.text);

  const context = chunks
    .map((c, i) => {
      let sourceInfo = `Source ${i + 1}`;
      
      if (c.originalName) {
        sourceInfo += ` (${c.originalName})`;
        
        if (c.slideNumber) {
          sourceInfo += ` - Slide ${c.slideNumber}`;
        } else if (c.pageNumber) {
          sourceInfo += ` - Page ${c.pageNumber}`;
        } else if (c.chunkIndex) {
          sourceInfo += ` - Chunk ${c.chunkIndex}`;
        }
      } else if (typeof c.idx === "number") {
        sourceInfo += ` (#${c.idx})`;
      }
      
      return `${sourceInfo}:\n${c.text}`;
    })
    .join("\n\n---\n\n");

  return { context, chunks };
}

export async function answerCourseQuestion(
  courseId: string,
  question: string,
  options?: { topK?: number; conversationHistory?: Array<{ role: "user" | "assistant"; content: string }> }
): Promise<{ answer: string; sources: RetrievedChunk[] }> {
  const topK = options?.topK ?? 5;
  const retrieval = await searchCourseContext(courseId, question, topK);

  const systemPrompt = `You are a helpful tutor for this specific course. Answer the user's question using ONLY the provided sources.\n\nIf the answer isn't in the sources, say you don't find it in the course materials and offer a brief next step. Keep answers concise and cite where relevant as [Source N].`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "system", content: `Sources (most relevant first):\n\n${retrieval.context}` },
  ];

  if (options?.conversationHistory) {
    for (const m of options.conversationHistory) {
      messages.push({ role: m.role, content: m.content });
    }
  }

  messages.push({ role: "user", content: question });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.2,
  });

  const answer = completion.choices?.[0]?.message?.content || "";
  return { answer, sources: retrieval.chunks };
}


