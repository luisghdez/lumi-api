import { db } from "../config/firebaseConfig";

export interface ThreadData {
  initialMessage: string;
  initialResponse: string;
  courseId?: string | null;
  lastMessageAt: Date;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageData {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: any[]; // Sources from RAG
}

// Helper function to clean sources data for Firestore
const cleanSourcesForFirestore = (sources: any[]): any[] => {
  return sources.map(source => {
    const cleanedSource: any = {};
    Object.entries(source).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        cleanedSource[key] = value;
      }
    });
    return cleanedSource;
  });
};

export const createThread = async (
  uid: string, 
  initialMessage: string,
  initialResponse: string,
  courseId?: string,
  sources?: any[]
): Promise<{ threadId: string; thread: ThreadData }> => {
  const threadData = {
    initialMessage: initialMessage.trim(),
    initialResponse,
    courseId: courseId || null,
    lastMessageAt: new Date(),
    messageCount: 2, // User message + AI response
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Create the thread document
  const threadRef = await db
    .collection("users")
    .doc(uid)
    .collection("threads")
    .add(threadData);

  // Save the user's initial message
  await threadRef.collection("messages").add({
    role: "user",
    content: initialMessage.trim(),
    timestamp: new Date(),
  });

  // Save the AI's response (with cleaned sources if available)
  const messageData: any = {
    role: "assistant",
    content: initialResponse,
    timestamp: new Date(),
  };

  if (sources && sources.length > 0) {
    messageData.sources = cleanSourcesForFirestore(sources);
  }

  await threadRef.collection("messages").add(messageData);

  return {
    threadId: threadRef.id,
    thread: threadData,
  };
};
