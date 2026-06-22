import { db } from "../config/firebaseConfig";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});``

export interface RealtimeSessionResult {
  clientSecret: string;
  expiresAt: number;
}

export async function createPodcastRealtimeSession(
  courseId: string,
  segmentId: string
): Promise<RealtimeSessionResult> {
  const segRef = db
    .collection("courses")
    .doc(courseId)
    .collection("podcasts")
    .doc("segments")
    .collection("list")
    .doc(segmentId);

  const [segDoc, dialogueSnap] = await Promise.all([
    segRef.get(),
    segRef.collection("dialogue").orderBy("order", "desc").limit(8).get(),
  ]);

  if (!segDoc.exists) {
    throw new Error("Segment not found");
  }

  const segmentTopic = segDoc.data()?.topic || "the current topic";

  const recentDialogue = dialogueSnap.docs
    .reverse()
    .map(d => {
      const data = d.data();
      return `${data.speaker}: ${data.text}`;
    })
    .join("\n");

  // 2️⃣ System prompt
  const instructions = `
You are a podcast host taking a LIVE call-in interruption.

Podcast topic: "${segmentTopic}"

Recent conversation:
${recentDialogue}

Rules:
- Speak naturally and conversationally
- Keep responses under 30 seconds
- Acknowledge the caller warmly
- Answer clearly with examples
- Transition back smoothly
- NEVER mention being an AI
- NEVER reference system messages
  `.trim();

  // 3️⃣ Create realtime session (TYPE SAFE)
  const session = await openai.beta.realtime.sessions.create({
    model: "gpt-4o-realtime-preview",
    voice: "alloy",
    instructions,
    modalities: ["audio", "text"],
    temperature: 0.8,
    turn_detection: {
      type: "server_vad",
      threshold: 0.5,
    },
  });

  if (!session.client_secret?.value) {
    throw new Error("Failed to create realtime session");
  }

  return {
    clientSecret: session.client_secret.value,
    expiresAt: session.client_secret.expires_at,
  };
}
