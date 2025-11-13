import { db } from "../config/firebaseConfig";
import { FastifyRequest, FastifyReply } from "fastify";
import { createFullPodcast, handleEphemeralPodcastInterrupt } from "../services/podcastService";
import fs from "fs";
import os from "os";
import path from "path";
import { nanoid } from "nanoid";
import { pipeline } from "stream";
import { promisify } from "util";
import { transcribeUserAudioQuestion } from "../services/podcast_transcribe";

const pump = promisify(pipeline);

/* --------------------------------------------------------
   Helper: Build fallback text content from Firestore
-------------------------------------------------------- */
async function buildCourseTextFromFirestore(courseId: string): Promise<string | null> {
  const courseDoc = await db.collection("courses").doc(courseId).get();
  if (!courseDoc.exists) return null;

  const course = courseDoc.data() || {};
  const summary = course.summary || "";
  const flashcards = Array.isArray(course.mergedFlashcards) ? course.mergedFlashcards : [];
  const lessonsSnap = await db
    .collection("courses")
    .doc(courseId)
    .collection("lessons")
    .limit(50)
    .get();

  const lessonBits: string[] = [];
  lessonsSnap.forEach((doc) => {
    const d = doc.data();
    if (d?.title) lessonBits.push(`# ${d.title}`);
    if (Array.isArray(d?.content)) {
      for (const c of d.content) {
        if (typeof c === "string") lessonBits.push(c);
        if (c?.text) lessonBits.push(String(c.text));
      }
    }
  });

  const flashBits = flashcards.map((f: any) => `Term: ${f.term}\nDefinition: ${f.definition}`);
  const combined = [
    `Summary:\n${summary}`,
    `\nFlashcards:\n${flashBits.join("\n\n")}`,
    `\nLessons:\n${lessonBits.join("\n\n")}`,
  ].join("\n\n");

  return combined.trim() || null;
}

/* --------------------------------------------------------
   1️⃣ Create Podcast (ENHANCED)
   Now generates topic-based segments with real-world examples
-------------------------------------------------------- */
export const createPodcastController = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (request as any).user;
    if (!user?.uid) return reply.status(401).send({ error: "Unauthorized" });

    const { courseId, content, title } = request.body as {
      courseId: string;
      content?: string;
      title?: string;
    };

    if (!courseId) return reply.status(400).send({ error: "Missing courseId" });

    console.log(`\n🎧 Creating podcast for course: ${courseId}`);

    // Fallback content from Firestore if not provided
    let courseText = (content || "").trim();
    if (!courseText) {
      console.log("📚 No content provided, building from Firestore...");
      const fallback = await buildCourseTextFromFirestore(courseId);
      if (!fallback) {
        return reply.status(400).send({
          error: "No course content available to build podcast.",
        });
      }
      courseText = fallback;
      console.log(`✅ Built ${courseText.length} characters of content from course data`);
    }

    const safeTitle = (title && title.trim()) || "Course Podcast";

    // 🎙️ Generate enhanced podcast with topic-based segments
    const podcast = await createFullPodcast(courseText, courseId, safeTitle);

    console.log(`\n✅ Podcast created successfully!`);
    console.log(`   📊 Total segments: ${podcast.segments.length}`);
    console.log(`   📚 Topics covered: ${podcast.topics?.join(", ")}`);

    return reply.status(201).send({ 
      message: "Podcast created successfully", 
      podcast 
    });
  } catch (err) {
    console.error("❌ Podcast generation failed:", err);
    return reply.status(500).send({ error: (err as Error).message });
  }
};

/* --------------------------------------------------------
   2️⃣ Check Podcast Exists
-------------------------------------------------------- */
export const checkPodcastExistsController = async (
  request: FastifyRequest<{ Params: { courseId: string } }>,
  reply: FastifyReply
) => {
  try {
    const { courseId } = request.params;
    const metaRef = db.collection("courses").doc(courseId).collection("podcasts").doc("metadata");
    const doc = await metaRef.get();
    return reply.send({ exists: doc.exists });
  } catch (err) {
    console.error("Error checking podcast existence:", err);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

/* --------------------------------------------------------
   3️⃣ Get Metadata
-------------------------------------------------------- */
export const getPodcastMetadataController = async (
  request: FastifyRequest<{ Params: { courseId: string } }>,
  reply: FastifyReply
) => {
  try {
    const { courseId } = request.params;
    const doc = await db
      .collection("courses")
      .doc(courseId)
      .collection("podcasts")
      .doc("metadata")
      .get();

    if (!doc.exists) return reply.status(404).send({ error: "Metadata not found" });
    return reply.send(doc.data());
  } catch (err) {
    console.error("Error getting podcast metadata:", err);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

/* --------------------------------------------------------
   4️⃣ Get Segments + Dialogue
-------------------------------------------------------- */
export const getPodcastSegmentsController = async (
  request: FastifyRequest<{ Params: { courseId: string } }>,
  reply: FastifyReply
) => {
  try {
    const { courseId } = request.params;
    const segSnap = await db
      .collection("courses")
      .doc(courseId)
      .collection("podcasts")
      .doc("segments")
      .collection("list")
      .orderBy("order")
      .get();

    const segments = await Promise.all(
      segSnap.docs.map(async (seg) => {
        const dialogueSnap = await seg.ref.collection("dialogue").orderBy("order").get();
        const dialogue = dialogueSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return { 
          id: seg.id, 
          ...seg.data(), 
          dialogue 
        };
      })
    );

    return reply.send({ segments });
  } catch (err) {
    console.error("Error getting podcast segments:", err);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

/* --------------------------------------------------------
   5️⃣ Get Single Segment
-------------------------------------------------------- */
export const getPodcastSegmentController = async (
  request: FastifyRequest<{ Params: { courseId: string; segmentId: string } }>,
  reply: FastifyReply
) => {
  try {
    const { courseId, segmentId } = request.params;
    const segRef = db
      .collection("courses")
      .doc(courseId)
      .collection("podcasts")
      .doc("segments")
      .collection("list")
      .doc(segmentId);

    const segDoc = await segRef.get();
    if (!segDoc.exists) return reply.status(404).send({ error: "Segment not found" });

    const dialogueSnap = await segRef.collection("dialogue").orderBy("order").get();
    const dialogue = dialogueSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    return reply.send({ 
      id: segDoc.id, 
      ...segDoc.data(), 
      dialogue 
    });
  } catch (err) {
    console.error("Error getting single segment:", err);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

/* --------------------------------------------------------
   6️⃣ Get Interruptions (if any were saved)
-------------------------------------------------------- */
export const getPodcastInterruptionsController = async (
  request: FastifyRequest<{ Params: { courseId: string } }>,
  reply: FastifyReply
) => {
  try {
    const { courseId } = request.params;
    const snap = await db
      .collection("courses")
      .doc(courseId)
      .collection("podcasts")
      .doc("interruptions")
      .collection("list")
      .orderBy("createdAt", "desc")
      .get();

    const interruptions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return reply.send({ interruptions });
  } catch (err) {
    console.error("Error getting interruptions:", err);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

/* --------------------------------------------------------
   7️⃣ Transcribe Audio Question (ENHANCED & EPHEMERAL)
   
   ✅ User questions are NOT saved to Firestore
   ✅ Responses are temporary and play once
   ✅ Enhanced with realistic call-in handling
   ✅ Backward compatible API response
-------------------------------------------------------- */
export const transcribeAudioQuestionController = async (request: any, reply: any) => {
  try {
    // 1️⃣ Get uploaded audio file
    const mp = await request.file();
    if (!mp) {
      return reply.status(400).send({ error: "No audio file uploaded" });
    }

    // 2️⃣ Extract form fields
    const fields = mp.fields || {};
    const courseId = (fields?.courseId?.value as string) || "unknown";
    const segmentId = (fields?.segmentId?.value as string) || "1";

    console.log(`\n📞 Processing ephemeral call-in...`);
    console.log(`   📚 Course: ${courseId}`);
    console.log(`   📑 Segment: ${segmentId}`);

    // 3️⃣ Save audio to temp file for transcription
    const tmpPath = path.join(os.tmpdir(), `${nanoid()}_${mp.filename}`);
    await pump(mp.file, fs.createWriteStream(tmpPath));

    // 4️⃣ Transcribe user's audio question
    console.log("🎧 Transcribing audio...");
    const startTranscribe = Date.now();
    
    const userQuestion = await transcribeUserAudioQuestion(
      fs.createReadStream(tmpPath),
      mp.filename
    );
    
    console.log(`✅ Transcribed in ${Date.now() - startTranscribe}ms`);
    console.log(`📝 User asked: "${userQuestion}"`);

    // 5️⃣ Clean up temp file immediately (don't wait)
    fs.unlink(tmpPath, (err) => {
      if (err) console.warn("⚠️ Failed to delete temp file:", err);
    });

    // 6️⃣ Generate EPHEMERAL response (NOT SAVED to Firestore)
    // This now uses the enhanced realistic call-in handling
    console.log("🤖 Generating realistic host response...");
    const startResponse = Date.now();

    const result = await handleEphemeralPodcastInterrupt(
      courseId,
      segmentId,
      userQuestion
    );

    console.log(`✅ Response generated in ${Date.now() - startResponse}ms`);
    console.log(`🎤 ${result.speaker} responding:`);
    console.log(`   💬 "${result.acknowledgment}"`);

    // 7️⃣ Return BACKWARD COMPATIBLE response
    // Frontend will work exactly as before, but with enhanced responses
    return reply.status(200).send({
      message: "Ephemeral call-in processed",
      text: userQuestion,
      
      // ✅ EXISTING FIELDS (backward compatible)
      hostResponse: result.fullResponse,  // Full combined response
      hostAudioUrl: result.audioUrl,      // Audio URL to play
      speaker: result.speaker,            // Which host responded
      
      // ✅ DEPRECATED but kept for compatibility
      reaction: result.acknowledgment,    // Maps to acknowledgment
      answer: result.answer,              // Just the answer part
      transition: result.transition,      // Just the transition part
      
      // 🆕 NEW ENHANCED FIELDS (optional for frontend to use)
      acknowledgment: result.acknowledgment,         // "Oh! We've got a caller!"
      questionProcessing: result.questionProcessing, // "So you're asking about..."
      segmentTopic: result.segmentTopic,             // Current topic being discussed
    });

  } catch (err: any) {
    console.error("❌ Ephemeral call-in failed:", err);
    console.error(err.stack);
    
    return reply.status(500).send({ 
      error: err.message || "Call-in failed",
      details: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
};