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

export interface ThreadSummary {
  threadId: string;
  initialMessage: string;
  lastMessageAt: Date;
  messageCount: number;
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

export const getUserThreads = async (
  uid: string,
  limit: number = 10,
  lastDoc?: any
): Promise<{ threads: ThreadSummary[]; hasMore: boolean; lastDoc?: any }> => {
  let query = db
    .collection("users")
    .doc(uid)
    .collection("threads")
    .orderBy("lastMessageAt", "desc")
    .limit(limit);

  // Add pagination cursor if provided
  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }

  const snapshot = await query.get();
  const threads: ThreadSummary[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    threads.push({
      threadId: doc.id,
      initialMessage: data.initialMessage.substring(0, 20) + (data.initialMessage.length > 20 ? "..." : ""),
      lastMessageAt: data.lastMessageAt.toDate(),
      messageCount: data.messageCount,
    });
  });

  const hasMore = snapshot.docs.length === limit;
  const lastVisibleDoc = hasMore ? snapshot.docs[snapshot.docs.length - 1] : null;

  return {
    threads,
    hasMore,
    lastDoc: lastVisibleDoc,
  };
};
