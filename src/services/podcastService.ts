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
  topic: string;           // The specific topic/lesson name
  dialogue: PodcastLine[];
  duration?: number;       // seconds (rough estimate)
  examples?: string[];     // Real-world examples included
}

/**
 * Step 1. Generate structured 2-speaker podcast scripts with TOPIC-BASED segments.
 * Each segment is a complete, standalone lesson with clear beginning and end.
 */
export async function generatePodcastSegmentsFromText(courseText: string): Promise<PodcastSegment[]> {
  const prompt = `
Convert this study material into an educational podcast with two dynamic hosts:
- Host A: Male, analytical but witty, enjoys real-world analogies and stories
- Host B: Female, curious, light-hearted, asks great clarifying questions

CRITICAL INSTRUCTIONS:
1. Identify 3-5 distinct TOPICS or LESSONS from the material
2. Each segment is a COMPLETE, STANDALONE lesson about ONE specific topic
3. Each segment should be 2-3 minutes of dialogue (roughly 15-25 exchanges)
4. NO continuity between segments - treat each as an independent episode

MANDATORY SEGMENT STRUCTURE:

**Opening (3-4 exchanges):**
- Start with HIGH ENERGY and enthusiasm
- Greet listeners warmly: "Hey everyone! Welcome back!" or "What's up, learners!"
- Introduce the specific topic with excitement
- Example: "Today we're tackling something really cool - [topic name]!"
- Build intrigue: "This is one of those concepts that once you get it, you'll see it everywhere!"

**Core Teaching (8-12 exchanges):**
- Break down the concept step-by-step
- Use conversational language, not textbook-speak
- Hosts naturally interrupt each other with insights
- Host B asks questions students would ask: "Wait, so does that mean...?"
- Host A provides clear, engaging answers

**Real-World Examples (4-6 exchanges):**
- Include 2-3 CONCRETE, RELATABLE examples
- Make connections to everyday life
- Examples for different topics:
  - Recursion → Russian nesting dolls, mirrors facing each other, or movie Inception
  - Networking → Post office mail routing, phone number system
  - Algorithms → Following a recipe, GPS navigation
  - Photosynthesis → Solar panels, charging your phone
  - Market economics → Lemonade stand, concert ticket pricing

**Interactive Moments:**
- "Oh, that's a great way to think about it!"
- "Wait, let me make sure I understand..."
- "Exactly! And here's another way to see it..."
- Natural back-and-forth that feels like real conversation

**Strong Conclusion (3-4 exchanges):**
- Summarize the ONE key takeaway
- End on an enthusiastic note
- Make it feel complete - NOT a cliffhanger
- Example: "So that's the core idea of [topic]! Pretty awesome, right?"
- "Yep! And now you know exactly how [topic] works!"
- Close warmly: "Thanks for learning with us today!" or "Hope that clicked for you!"

TONE GUIDELINES:
- Conversational, like friends explaining something cool
- Natural interruptions (positive): "Oh! Oh! Let me add something..."
- Show genuine excitement: "This is SO cool!", "Mind-blowing, right?", "I love this!"
- Use analogies and metaphors freely
- Occasional humor, but keep it educational
- Vary sentence length - mix short punchy lines with longer explanations

CRITICAL: Each segment is INDEPENDENT. Don't reference other segments or say "in the next part."

Return valid JSON in this exact structure:
{
  "segments": [
    {
      "id": "1",
      "topic": "Clear, specific topic name (e.g., 'How Variables Store Data')",
      "examples": ["Real-world example 1", "Real-world example 2"],
      "dialogue": [
        { "speaker": "Host A", "text": "..." },
        { "speaker": "Host B", "text": "..." }
      ]
    }
  ]
}

Study Material:
${courseText}
  `.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.95, // Higher creativity for more natural, varied dialogue
    messages: [
      { 
        role: "system", 
        content: "You are an expert at creating engaging, educational podcast scripts. You specialize in breaking down complex topics into digestible, entertaining segments with perfect pacing and real-world connections." 
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  
  // Extract JSON - handle markdown code blocks
  let jsonStr = raw;
  const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  } else {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
  }

  if (!jsonStr) throw new Error("No valid JSON returned from OpenAI for segments");

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse JSON:", jsonStr);
    throw new Error("Failed to parse JSON for segments");
  }

  if (!parsed?.segments || !Array.isArray(parsed.segments)) {
    throw new Error("Segments JSON missing 'segments' array");
  }

  return parsed.segments.map((s: any, i: number) => {
    const id = s.id ?? `${i + 1}`;
    const topic = s.topic ?? `Topic ${i + 1}`;
    const examples = Array.isArray(s.examples) ? s.examples : [];
    const dialogue = Array.isArray(s.dialogue) ? s.dialogue : [];
    
    const mappedDialogue: PodcastLine[] = dialogue.map((line: any, j: number) => ({
      id: `line_${j + 1}`,
      speaker: line.speaker === "Host A" ? "Host A" : "Host B",
      text: String(line.text ?? "").trim(),
    })).filter((l: PodcastLine) => l.text.length > 0);

    return {
      id,
      order: i + 1,
      topic,
      examples,
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

  console.log(`\n🎙️ Processing segment: "${segment.topic}"`);

  for (const line of segment.dialogue) {
    console.log(`  → ${line.speaker}: ${line.text.substring(0, 60)}...`);

    // Use the podcast TTS service with proper voice for each speaker
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

  // Better duration estimate based on text length and dialogue count
  const totalTextLength = processed.reduce((acc, line) => acc + line.text.length, 0);
  const estimatedDuration = Math.round((totalTextLength / 12) + (processed.length * 2)); // ~12 chars/sec + 2sec/line for pauses
  
  return { 
    ...segment, 
    dialogue: processed, 
    duration: Math.max(60, Math.min(240, estimatedDuration)) // 1-4 minutes
  };
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
  const topics = segments.map(s => s.topic);

  // metadata
  const metadataRef = podcastRef.doc("metadata");
  batch.set(metadataRef, {
    title,
    createdAt: new Date().toISOString(),
    totalSegments: segments.length,
    durationSeconds: totalDuration,
    topics, // List of all topics covered
    tone: "Conversational, educational, and engaging",
    hosts: ["Host A (male, analytical & witty)", "Host B (female, curious & light-hearted)"],
    description: "Topic-based podcast where each segment is a complete, standalone lesson",
  });

  // segments + dialogue lines
  for (const seg of segments) {
    const segRef = podcastRef.doc("segments").collection("list").doc(seg.id);
    batch.set(segRef, {
      order: seg.order,
      topic: seg.topic,
      examples: seg.examples || [],
      duration: seg.duration ?? null,
      isStandalone: true, // Flag indicating this is a complete lesson
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
  console.log(`\n✅ Podcast with ${segments.length} topic-based segments saved to Firestore.`);
  console.log(`📚 Topics covered:`, topics.join(", "));
}

/**
 * Step 4. Master function that runs the full generation pipeline.
 */
export async function createFullPodcast(courseText: string, courseId: string, title: string) {
  console.log("\n🎧 Generating topic-based podcast with real-world examples...");
  const rawSegments = await generatePodcastSegmentsFromText(courseText);

  console.log(`\n📋 Generated ${rawSegments.length} segments:`);
  rawSegments.forEach(seg => console.log(`   ${seg.order}. ${seg.topic}`));

  // Synthesize each segment (sequential for stability)
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
    topics: processed.map(s => s.topic),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Handle REALISTIC user "call-in" interruptions.
 * - Hosts acknowledge: "Oh! We've got a caller!"
 * - They listen to the question naturally
 * - Give a thoughtful, contextual answer
 * - Transition back smoothly
 */
export async function handlePodcastInterrupt(
  courseId: string,
  segmentId: string,
  userQuestion: string
) {
  if (!courseId || !segmentId || !userQuestion)
    throw new Error("Missing courseId, segmentId, or userQuestion");

  const podcastRef = db.collection("courses").doc(courseId).collection("podcasts");
  const segRef = podcastRef.doc("segments").collection("list").doc(segmentId);

  // 1️⃣ Load segment info and recent dialogue
  const [segDoc, dialogueSnap] = await Promise.all([
    segRef.get(),
    segRef.collection("dialogue").orderBy("order", "asc").get()
  ]);

  if (!segDoc.exists) throw new Error("Segment not found");
  if (dialogueSnap.empty) throw new Error("Segment has no dialogue to interrupt");

  const segmentData = segDoc.data();
  const segmentTopic = segmentData?.topic || "this topic";

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

  // 2️⃣ Gather recent conversation context (last 8 lines for better context)
  const recentContext = dialogue
    .slice(-8)
    .map((l: any) => `${l.speaker}: ${l.text}`)
    .join("\n");

  // 3️⃣ Generate REALISTIC call-in response
  const prompt = `
You are ${responder}, a podcast host currently discussing "${segmentTopic}".

A LISTENER IS CALLING IN with this question: "${userQuestion}"

Respond naturally like a real podcast host taking a live call:

1. **Acknowledgment** (1 sentence): React enthusiastically to getting a caller
   Examples: 
   - "Oh! We've got a caller! Hey there!"
   - "Hold on, someone's calling in! Welcome to the show!"
   - "Ooh, a live question! This is exciting, go ahead!"

2. **Process the question** (1 sentence): Show you heard and understood
   Examples:
   - "So you're asking about [restate briefly]..."
   - "Great question about [topic]..."
   - "Ah, you want to know [paraphrase]..."

3. **Answer** (3-4 sentences): Give a clear, helpful answer with:
   - Direct response to their question
   - A real-world example or analogy if relevant
   - Connect it to what you were just discussing
   - Keep it conversational, not lecturing

4. **Transition** (1-2 sentences): Naturally wrap up the call
   Examples:
   - "Does that help clarify things? Thanks for calling!"
   - "Hope that answers your question! Great to hear from you!"
   - "Awesome question! Anyone else out there wondering the same thing?"

Recent conversation context:
${recentContext}

TONE: Warm, energetic, genuinely happy to take calls. Like a real NPR or podcast host.

Return valid JSON:
{
  "acknowledgment": "...",
  "questionProcessing": "...",
  "answer": "...",
  "transition": "..."
}
`;

  console.log(`\n📞 Processing live call for segment "${segmentTopic}"...`);
  console.log(`❓ Question: "${userQuestion}"`);
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.9, // Natural, varied responses
    messages: [
      { 
        role: "system", 
        content: "You are a warm, engaging podcast host who loves taking listener questions. You're knowledgeable but conversational, never robotic. You make callers feel heard and valued." 
      },
      { role: "user", content: prompt },
    ],
  });

  let acknowledgment = "Oh! We've got a caller!";
  let questionProcessing = "Great question!";
  let answer = "Let me help you with that.";
  let transition = "Thanks for calling in!";

  try {
    const raw = completion.choices[0]?.message?.content || "{}";
    // Handle markdown code blocks
    let jsonStr = raw;
    const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }
    
    const json = JSON.parse(jsonStr);
    acknowledgment = json.acknowledgment || acknowledgment;
    questionProcessing = json.questionProcessing || questionProcessing;
    answer = json.answer || answer;
    transition = json.transition || transition;
  } catch (err) {
    console.warn("⚠️ Failed to parse structured response, using fallback:", err);
  }

  const fullResponse = `${acknowledgment} ${questionProcessing} ${answer} ${transition}`.trim();

  console.log(`\n🎤 ${responder} responding:\n"${fullResponse.substring(0, 100)}..."`);

  // 4️⃣ Generate TTS audio
  console.log(`\n🎙️ Generating TTS audio...`);
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
  const newLineRef = segRef.collection("dialogue").doc(`interrupt_${nextOrder}`);
  batch.set(newLineRef, {
    speaker: responder,
    text: fullResponse,
    audioUrl,
    order: nextOrder,
    isInterrupt: true,
    isCallIn: true, // Flag this as a caller interaction
    userQuestion,
    createdAt: new Date().toISOString(),
  });

  // (b) Log interruption with structured data
  const interruptRef = podcastRef.doc("interruptions").collection("list").doc(nanoid());
  batch.set(interruptRef, {
    courseId,
    segmentId,
    segmentTopic,
    userQuestion: userQuestion || "",
    acknowledgment,
    questionProcessing,
    answer,
    transition,
    fullResponse,
    audioUrl: audioUrl || "",
    responder,
    createdAt: new Date().toISOString(),
  });

  // (c) Increment duration (rough estimate: 15-20 seconds for call-in)
  const estimatedCallDuration = Math.round(fullResponse.length / 12); // ~12 chars/sec
  const incrementValue = admin.firestore.FieldValue.increment(estimatedCallDuration);
  batch.update(segRef, { duration: incrementValue });

  await batch.commit();

  console.log(`✅ Call-in response added to Firestore`);

  return {
    acknowledgment,
    questionProcessing,
    answer,
    transition,
    fullResponse,
    audioUrl,
    speaker: responder,
  };
}

/**
 * Handle EPHEMERAL user "call-in" interruptions (plays once, not saved).
 * Same realistic call-in handling, but temporary.
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

  // 1️⃣ Load segment info and recent dialogue
  const [segDoc, dialogueSnap] = await Promise.all([
    segRef.get(),
    segRef.collection("dialogue").orderBy("order", "desc").limit(8).get()
  ]);

  const segmentTopic = segDoc.exists ? segDoc.data()?.topic || "this topic" : "this topic";

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

  // 2️⃣ Generate response (same realistic prompt as persistent version)
  const prompt = `
You are ${responder}, a podcast host currently discussing "${segmentTopic}".

A LISTENER IS CALLING IN with this question: "${userQuestion}"

Respond naturally like a real podcast host taking a live call:

1. **Acknowledgment** (1 sentence): React enthusiastically to getting a caller
2. **Process the question** (1 sentence): Show you heard and understood  
3. **Answer** (3-4 sentences): Clear, helpful answer with examples
4. **Transition** (1-2 sentences): Naturally wrap up the call

Recent conversation:
${recentContext}

TONE: Warm, energetic, genuinely happy to take calls.

Return valid JSON:
{
  "acknowledgment": "...",
  "questionProcessing": "...",
  "answer": "...",
  "transition": "..."
}
`;

  console.log(`\n📞 Generating ephemeral call-in response for "${segmentTopic}"...`);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.9,
    messages: [
      {
        role: "system",
        content: "You are a warm, engaging podcast host who loves taking listener questions.",
      },
      { role: "user", content: prompt },
    ],
  });

  let acknowledgment = "Oh! We've got a caller!";
  let questionProcessing = "Great question!";
  let answer = "Let me help you with that.";
  let transition = "Thanks for calling in!";

  try {
    const raw = completion.choices[0]?.message?.content || "{}";
    let jsonStr = raw;
    const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1];
    
    const json = JSON.parse(jsonStr);
    acknowledgment = json.acknowledgment || acknowledgment;
    questionProcessing = json.questionProcessing || questionProcessing;
    answer = json.answer || answer;
    transition = json.transition || transition;
  } catch (err) {
    console.warn("⚠️ Failed to parse response:", err);
  }

  const fullResponse = `${acknowledgment} ${questionProcessing} ${answer} ${transition}`.trim();

  // 3️⃣ Generate TTS audio
  console.log(`\n🎙️ Generating ephemeral TTS...`);
  const startTTS = Date.now();
  const buffer = await generatePodcastTtsAudio(fullResponse, responder);
  console.log(`✅ TTS generated in ${Date.now() - startTTS}ms`);

  // 4️⃣ Upload to temporary location
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

  console.log(`✅ Ephemeral call-in response generated (not saved to Firestore)`);

  return {
    acknowledgment,
    questionProcessing,
    answer,
    transition,
    fullResponse,
    audioUrl,
    speaker: responder,
    segmentTopic,
  };
}