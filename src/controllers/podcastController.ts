import { db } from "../config/firebaseConfig";
import { FastifyRequest, FastifyReply } from "fastify";
import { createFullPodcast, handlePodcastInterrupt, handleEphemeralPodcastInterrupt } from "../services/podcastService";
import fs from "fs";
import os from "os";
import path from "path";
import { nanoid } from "nanoid";
import { pipeline } from "stream";
import { promisify } from "util";
import { transcribeUserAudioQuestion } from "../services/podcast_transcribe";


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
   1️⃣ Create Podcast
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

    // Fallback content
    let courseText = (content || "").trim();
    if (!courseText) {
      const fallback = await buildCourseTextFromFirestore(courseId);
      if (!fallback) {
        return reply.status(400).send({
          error: "No course content available to build podcast.",
        });
      }
      courseText = fallback;
    }

    const safeTitle = (title && title.trim()) || "Course Podcast";
    const podcast = await createFullPodcast(courseText, courseId, safeTitle);

    return reply.status(201).send({ message: "Podcast created successfully", podcast });
  } catch (err) {
    console.error("❌ Podcast generation failed:", err);
    return reply.status(500).send({ error: (err as Error).message });
  }
};

/* --------------------------------------------------------
   2️⃣ Handle Interrupts
-------------------------------------------------------- */
export const podcastInterruptController = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const user = (request as any).user;
    if (!user?.uid) return reply.status(401).send({ error: "Unauthorized" });

    const body = request.body as {
      courseId: string;
      segmentId: string;
      question?: string;
      userQuestion?: string;
    };

    const { courseId, segmentId } = body;
    const question = (body.question || body.userQuestion || "").trim();

    if (!courseId || !segmentId || !question)
      return reply.status(400).send({ error: "Missing courseId, segmentId, or question" });

    const result = await handlePodcastInterrupt(courseId, segmentId, question);
    return reply.status(200).send({ message: "Interrupt merged successfully", result });
  } catch (err) {
    console.error("❌ Podcast interrupt failed:", err);
    return reply.status(500).send({ error: (err as Error).message });
  }
};

/* --------------------------------------------------------
   3️⃣ Check Podcast Exists
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
   4️⃣ Get Metadata
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
   5️⃣ Get Segments + Dialogue
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
        return { id: seg.id, ...seg.data(), dialogue };
      })
    );

    return reply.send({ segments });
  } catch (err) {
    console.error("Error getting podcast segments:", err);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

/* --------------------------------------------------------
   6️⃣ Get Single Segment
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
    return reply.send({ id: segDoc.id, ...segDoc.data(), dialogue });
  } catch (err) {
    console.error("Error getting single segment:", err);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

/* --------------------------------------------------------
   7️⃣ Get Interruptions
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

const pump = promisify(pipeline);


export const transcribeAudioQuestionController = async (request: any, reply: any) => {
  try {
    const mp = await request.file();
    if (!mp) return reply.status(400).send({ error: "No audio file uploaded" });

    const fields = mp.fields || {};
    const courseId = (fields?.courseId?.value as string) || "unknown";
    const segmentId = (fields?.segmentId?.value as string) || "1";

    // Save temp copy
    const tmpPath = path.join(os.tmpdir(), `${nanoid()}_${mp.filename}`);
    await pump(mp.file, fs.createWriteStream(tmpPath));

    // Transcribe
    console.log("🎧 Transcribing audio question...");
    const userQuestion = await transcribeUserAudioQuestion(
      fs.createReadStream(tmpPath),
      mp.filename
    );
    console.log(`📝 Transcript: ${userQuestion}`);

    // Clean up
    fs.unlink(tmpPath, () => {});

    // Generate ephemeral response (nothing saved to Firestore)
    console.log("🤖 Generating ephemeral response...");
    const result = await handleEphemeralPodcastInterrupt(
      courseId,
      segmentId,
      userQuestion
    );

    return reply.status(200).send({
      message: "Ephemeral call-in processed",
      text: userQuestion,
      hostResponse: result.aiResponse,
      hostAudioUrl: result.audioUrl,
      reaction: result.reaction,
      answer: result.answer,
      transition: result.transition,
      speaker: result.speaker,
    });
  } catch (err: any) {
    console.error("❌ Ephemeral call-in failed:", err);
    return reply.status(500).send({ error: err.message || "Call-in failed" });
  }
};