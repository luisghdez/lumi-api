import OpenAI from "openai";
import { db, admin } from "../config/firebaseConfig";
import { generatePodcastTtsAudio } from "./podcast_tts";
import { uploadFileToFirebaseStorage } from "./firebaseStorageService";
import { nanoid } from "nanoid";

const openai = new OpenAI();

export interface PodcastLine {
  id: string;              // e.g. "line_1"
  speaker: "Host A" | "Host B";
  text: string;
  audioUrl?: string;
}

export interface PodcastSegment {
  id: string;              // e.g. "1"
  order: number;           // numeric ordering
  dialogue: PodcastLine[];
  duration?: number;       // seconds (rough estimate)
}

/**
 * Step 1. Generate structured 2-speaker podcast scripts.
 */
export async function generatePodcastSegmentsFromText(courseText: string): Promise<PodcastSegment[]> {
  const prompt = `
Convert this study material into an educational podcast with two hosts:
- Host A: Male, analytical but witty
- Host B: Female, curious, light-hearted

Split into 1–2 minute segments, each with alternating, natural dialogue lines.
No narration labels like "Segment 1" in the script, just dialogue lines.

Return valid JSON in this exact structure:
{
  "segments": [
    {
      "id": "1",
      "dialogue": [
        { "speaker": "Host A", "text": "..." },
        { "speaker": "Host B", "text": "..." }
      ]
    }
  ]
}

Content:
${courseText}
  `.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.9,
    messages: [
      { role: "system", content: "You generate friendly, realistic podcast dialogues between two hosts." },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  // Extract the first JSON object to be safe
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No valid JSON returned from OpenAI for segments");

  let parsed: any;
  try {
    parsed = JSON.parse(match[0]);
  } catch (e) {
    throw new Error("Failed to parse JSON for segments");
  }

  if (!parsed?.segments || !Array.isArray(parsed.segments)) {
    throw new Error("Segments JSON missing 'segments' array");
  }

  return parsed.segments.map((s: any, i: number) => {
    const id = s.id ?? `${i + 1}`;
    const dialogue = Array.isArray(s.dialogue) ? s.dialogue : [];
    const mappedDialogue: PodcastLine[] = dialogue.map((line: any, j: number) => ({
      id: `line_${j + 1}`,
      speaker: line.speaker === "Host A" ? "Host A" : "Host B",
      text: String(line.text ?? "").trim(),
    })).filter((l: PodcastLine) => l.text.length > 0);

    return {
      id,
      order: i + 1,
      dialogue: mappedDialogue,
    };
  }).filter((seg: PodcastSegment) => seg.dialogue.length > 0);
}

/**
 * Step 2. Synthesize each speaker's line separately with different voices.
 * Stores audio in Firebase Storage under:
 * podcasts/{courseId}/segments/{segment.id}/{line.id}-{nanoid()}.mp3
 */
export async function synthesizeSegmentDialogue(
  segment: PodcastSegment,
  courseId: string
): Promise<PodcastSegment> {
  const processed: PodcastLine[] = [];

  for (const line of segment.dialogue) {
    console.log(`🎙️ TTS for ${line.speaker} | segment ${segment.id} | ${line.id}`);

    // ✅ Use the new podcast TTS service with proper voice for each speaker
    const buffer = await generatePodcastTtsAudio(line.text, line.speaker);

    const folder = `podcasts/${courseId}/segments/${segment.id}`;
    const fileId = `${line.id}-${nanoid()}`;
    const originalName = `${line.id}.mp3`;

    const uploaded = await uploadFileToFirebaseStorage(
      buffer,
      fileId,
      originalName,
      "audio/mpeg",
      folder
    );

    processed.push({
      ...line,
      audioUrl: uploaded.publicUrl || uploaded.fileUrl,
    });
  }

  // Very rough duration estimate (you can replace with actual duration if available)
  const duration = Math.max(60, Math.min(120, Math.round(processed.length * 12)));
  return { ...segment, dialogue: processed, duration };
}

/**
 * Step 3. Save everything in Firestore, fully structured.
 * Firestore layout:
 * courses/{courseId}/podcasts/metadata
 * courses/{courseId}/podcasts/segments/list/{segmentId}
 * courses/{courseId}/podcasts/segments/list/{segmentId}/dialogue/{lineId}
 */
export async function saveFullPodcastToFirestore(
  courseId: string,
  title: string,
  segments: PodcastSegment[]
) {
  const podcastRef = db.collection("courses").doc(courseId).collection("podcasts");
  const batch = db.batch();

  const totalDuration = segments.reduce((acc, s) => acc + (s.duration ?? 0), 0);

  // metadata
  const metadataRef = podcastRef.doc("metadata");
  batch.set(metadataRef, {
    title,
    createdAt: new Date().toISOString(),
    totalSegments: segments.length,
    durationSeconds: totalDuration,
    tone: "Conversational & educational",
    hosts: ["Host A (male)", "Host B (female)"],
  });

  // segments + dialogue lines
  for (const seg of segments) {
    const segRef = podcastRef.doc("segments").collection("list").doc(seg.id);
    batch.set(segRef, {
      order: seg.order,
      duration: seg.duration ?? null,
    });

    for (const line of seg.dialogue) {
      const lineRef = segRef.collection("dialogue").doc(line.id);
      // Parse order from "line_X"
      const order = Number(line.id.split("_")[1]) || 1;

      batch.set(lineRef, {
        speaker: line.speaker,
        text: line.text,
        audioUrl: line.audioUrl ?? null,
        order,
      });
    }
  }

  await batch.commit();
  console.log(`✅ Podcast with ${segments.length} segments saved to Firestore.`);
}

/**
 * Step 4. Master function that runs the full generation pipeline.
 */
export async function createFullPodcast(courseText: string, courseId: string, title: string) {
  console.log("🎧 Generating full multi-voice podcast...");
  const rawSegments = await generatePodcastSegmentsFromText(courseText);

  // Synthesize each segment (sequential for stability; can be parallelized later)
  const processed: PodcastSegment[] = [];
  for (const seg of rawSegments) {
    const s = await synthesizeSegmentDialogue(seg, courseId);
    processed.push(s);
  }

  await saveFullPodcastToFirestore(courseId, title, processed);

  return {
    courseId,
    title,
    segments: processed,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Handle user "call-in" interruptions live.
 * - Translates student question → host reaction + answer + transition
 * - Generates one continuous host audio clip
 * - Inserts the response line in Firestore (dialogue subcollection)
 * - Logs the event in /interruptions
/**/

export async function handlePodcastInterrupt(
  courseId: string,
  segmentId: string,
  userQuestion: string
) {
  if (!courseId || !segmentId || !userQuestion)
    throw new Error("Missing courseId, segmentId, or userQuestion");

  const podcastRef = db.collection("courses").doc(courseId).collection("podcasts");
  const segRef = podcastRef.doc("segments").collection("list").doc(segmentId);

  // 1️⃣ Load the last speaker in this segment
  const dialogueSnap = await segRef.collection("dialogue").orderBy("order", "asc").get();
  if (dialogueSnap.empty) throw new Error("Segment has no dialogue to interrupt");

  type DialogueData = {
    id: string;
    speaker: string;
    text: string;
    audioUrl?: string;
    order: number;
    isInterrupt?: boolean;
  };

  const dialogue: DialogueData[] = dialogueSnap.docs.map((doc) => {
    const data = doc.data() as DialogueData;
    return {
      id: doc.id,
      speaker: data.speaker,
      text: data.text,
      audioUrl: data.audioUrl,
      order: data.order ?? 0,
      isInterrupt: data.isInterrupt,
    };
  });

  const last = dialogue[dialogue.length - 1];
  const responder = last.speaker === "Host A" ? "Host B" : "Host A";

  // 2️⃣ Gather recent conversation context
  const recentContext = dialogue
    .slice(-6)
    .map((l: any) => `${l.speaker}: ${l.text}`)
    .join("\n");

  // 3️⃣ Generate structured response - Use gpt-4o-mini for speed
  const prompt = `
You are ${responder}, one of two podcast hosts.
A listener just asked: "${userQuestion}"

You should respond like a live host:
1. Start with a short *reaction* line (e.g., "Oh, that's a great question!").
2. Follow with a concise 2–3 sentence *answer*.
3. End with a brief *transition* back to the topic.

Context:
${recentContext}

Return valid JSON:
{
  "reaction": "...",
  "answer": "...",
  "transition": "..."
}
`;

  console.log(`🤖 Generating AI response for ${responder}...`);
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Faster than gpt-4.1-mini
    temperature: 0.85,
    messages: [
      { role: "system", content: "You are a calm, engaging podcast co-host. Be concise." },
      { role: "user", content: prompt },
    ],
  });

  let reaction = "That's a good question!";
  let answer = "Let's discuss that briefly.";
  let transition = "Now, let's get back to where we were.";

  try {
    const json = JSON.parse(completion.choices[0]?.message?.content || "{}");
    reaction = json.reaction || reaction;
    answer = json.answer || answer;
    transition = json.transition || transition;
  } catch (err) {
    console.warn("⚠️ Failed to parse structured response:", err);
  }

  const fullResponse = `${reaction} ${answer} ${transition}`.trim();

  // 4️⃣ Generate TTS audio - This is the slowest part
  console.log(`🎙️ Generating TTS for ${responder} interrupt...`);
  const startTTS = Date.now();
  const buffer = await generatePodcastTtsAudio(fullResponse, responder);
  console.log(`✅ TTS generated in ${Date.now() - startTTS}ms`);

  const folder = `podcasts/${courseId}/segments/${segmentId}`;
  const fileId = `interrupt_${nanoid()}`;

  const uploaded = await uploadFileToFirebaseStorage(
    buffer,
    fileId,
    `${fileId}.mp3`,
    "audio/mpeg",
    folder
  );

  const audioUrl = uploaded.publicUrl || uploaded.fileUrl;

  // 5️⃣ Determine next dialogue order
  const lastOrder = dialogue[dialogue.length - 1]?.order || 0;
  const nextOrder = lastOrder + 1;

  // 6️⃣ Batch write: insert into dialogue + log interruption
  const batch = db.batch();

  // (a) Insert into dialogue
  const newLineRef = segRef.collection("dialogue").doc(`line_${nextOrder}`);
  batch.set(newLineRef, {
    speaker: responder,
    text: fullResponse,
    audioUrl,
    order: nextOrder,
    isInterrupt: true,
    createdAt: new Date().toISOString(),
  });

  // (b) Log interruption
  const interruptRef = podcastRef.doc("interruptions").collection("list").doc(nanoid());
  batch.set(interruptRef, {
    courseId,
    segmentId,
    userQuestion: userQuestion || "",
    reaction: reaction || "",
    answer: answer || "",
    transition: transition || "",
    aiResponse: fullResponse || "",
    audioUrl: audioUrl || "",
    createdAt: new Date().toISOString(),
  });

  // (c) Increment duration
  const incrementValue = admin.firestore.FieldValue.increment(10);
  batch.update(segRef, { duration: incrementValue });

  await batch.commit();

  console.log(`✅ Host response by ${responder} added to Firestore for ${segmentId}`);

  return {
    reaction,
    answer,
    transition,
    aiResponse: fullResponse,
    audioUrl,
  };
}

/**
 * Handle EPHEMERAL user "call-in" interruptions.
 * - Does NOT save anything to Firestore
 * - Only generates and returns the audio response
 * - Response plays once and disappears
 */
export async function handleEphemeralPodcastInterrupt(
  courseId: string,
  segmentId: string,
  userQuestion: string
) {
  if (!courseId || !segmentId || !userQuestion)
    throw new Error("Missing courseId, segmentId, or userQuestion");

  const podcastRef = db.collection("courses").doc(courseId).collection("podcasts");
  const segRef = podcastRef.doc("segments").collection("list").doc(segmentId);

  // 1️⃣ Load recent dialogue for context only
  const dialogueSnap = await segRef
    .collection("dialogue")
    .orderBy("order", "desc")
    .limit(6)
    .get();

  if (dialogueSnap.empty) throw new Error("Segment has no dialogue");

  const recentDialogue = dialogueSnap.docs.reverse().map((doc) => {
    const data = doc.data();
    return {
      speaker: data.speaker || "Host A",
      text: data.text || "",
    };
  });

  const lastSpeaker = recentDialogue[recentDialogue.length - 1]?.speaker || "Host A";
  const responder = lastSpeaker === "Host A" ? "Host B" : "Host A";

  const recentContext = recentDialogue
    .map((l) => `${l.speaker}: ${l.text}`)
    .join("\n");

  // 2️⃣ Generate response
  const prompt = `
You are ${responder}, one of two podcast hosts.
A listener just asked: "${userQuestion}"

Respond naturally as a live host:
1. Quick reaction (1 sentence)
2. Concise answer (2-3 sentences)
3. Brief transition back (1 sentence)

Context:
${recentContext}

Return valid JSON:
{
  "reaction": "...",
  "answer": "...",
  "transition": "..."
}
`;

  console.log(`🤖 Generating ephemeral response for ${responder}...`);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.85,
    messages: [
      {
        role: "system",
        content: "You are a calm, engaging podcast co-host. Be concise.",
      },
      { role: "user", content: prompt },
    ],
  });

  let reaction = "That's a good question!";
  let answer = "Let's discuss that briefly.";
  let transition = "Now, let's get back to where we were.";

  try {
    const json = JSON.parse(completion.choices[0]?.message?.content || "{}");
    reaction = json.reaction || reaction;
    answer = json.answer || answer;
    transition = json.transition || transition;
  } catch (err) {
    console.warn("⚠️ Failed to parse response:", err);
  }

  const fullResponse = `${reaction} ${answer} ${transition}`.trim();

  // 3️⃣ Generate TTS audio (no upload to permanent storage)
  console.log(`🎙️ Generating ephemeral TTS for ${responder}...`);
  const startTTS = Date.now();
  const buffer = await generatePodcastTtsAudio(fullResponse, responder);
  console.log(`✅ TTS generated in ${Date.now() - startTTS}ms`);

  // 4️⃣ Upload to a TEMPORARY location (or return base64)
  // Option A: Upload to temporary folder that gets cleaned up
  const folder = `podcasts/temp/${courseId}`;
  const fileId = `temp_${Date.now()}_${nanoid()}`;

  const uploaded = await uploadFileToFirebaseStorage(
    buffer,
    fileId,
    `${fileId}.mp3`,
    "audio/mpeg",
    folder
  );

  const audioUrl = uploaded.publicUrl || uploaded.fileUrl;

  console.log(`✅ Ephemeral response generated (not saved to Firestore)`);

  return {
    reaction,
    answer,
    transition,
    aiResponse: fullResponse,
    audioUrl,
    speaker: responder,
  };
}