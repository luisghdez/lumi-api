import { db } from "../config/firebaseConfig";

export interface ThreadData {
  initialMessage: string;
  initialResponse: string;
  courseId?: string | null;
  courseTitle?: string | null;
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
  courseId?: string | null;
  courseTitle?: string | null;
}

export interface ThreadMessage {
  messageId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: any[];
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
  courseTitle?: string,
  sources?: any[]
): Promise<{ threadId: string; thread: ThreadData }> => {
  const threadData = {
    initialMessage: initialMessage.trim(),
    initialResponse,
    courseId: courseId || null,
    courseTitle: courseTitle || null,
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
      courseId: data.courseId ?? null,
      courseTitle: data.courseTitle ?? null,
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

export const getThreadMessages = async (
  uid: string,
  threadId: string,
  limit: number = 20,
  lastDoc?: any
): Promise<{ messages: ThreadMessage[]; hasMore: boolean; lastDoc?: any }> => {
  let query = db
    .collection("users")
    .doc(uid)
    .collection("threads")
    .doc(threadId)
    .collection("messages")
    .orderBy("timestamp", "asc")
    .limit(limit);

  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }

  const snapshot = await query.get();
  const messages: ThreadMessage[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    messages.push({
      messageId: doc.id,
      role: data.role,
      content: data.content,
      timestamp: data.timestamp.toDate(),
      ...(data.sources && { sources: data.sources }),
    });
  });

  const hasMore = snapshot.docs.length === limit;
  const lastVisibleDoc = hasMore ? snapshot.docs[snapshot.docs.length - 1] : null;

  return {
    messages,
    hasMore,
    lastDoc: lastVisibleDoc,
  };
};

export const getThreadByCourseId = async (
  uid: string,
  courseId: string
): Promise<string | null> => {
  const snapshot = await db
    .collection("users")
    .doc(uid)
    .collection("threads")
    .where("courseId", "==", courseId)
    .orderBy("lastMessageAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].id;
};

export const createMessageInThread = async (
  uid: string,
  threadId: string,
  userMessage: string,
  aiResponse: string,
  sources?: any[]
): Promise<{ messageId: string; message: ThreadMessage }> => {
  // Save the user's message
  const userMessageRef = await db
    .collection("users")
    .doc(uid)
    .collection("threads")
    .doc(threadId)
    .collection("messages")
    .add({
      role: "user",
      content: userMessage.trim(),
      timestamp: new Date(),
    });

  // Save the AI's response (with cleaned sources if available)
  const messageData: any = {
    role: "assistant",
    content: aiResponse,
    timestamp: new Date(),
  };

  if (sources && sources.length > 0) {
    messageData.sources = cleanSourcesForFirestore(sources);
  }

  const aiMessageRef = await db
    .collection("users")
    .doc(uid)
    .collection("threads")
    .doc(threadId)
    .collection("messages")
    .add(messageData);

  // Update thread metadata
  const threadRef = db
    .collection("users")
    .doc(uid)
    .collection("threads")
    .doc(threadId);

  const threadDoc = await threadRef.get();
  const currentData = threadDoc.data();
  
  await threadRef.update({
    lastMessageAt: new Date(),
    messageCount: (currentData?.messageCount || 0) + 2, // User message + AI response
    updatedAt: new Date(),
  });

  return {
    messageId: aiMessageRef.id,
    message: {
      messageId: aiMessageRef.id,
      role: "assistant",
      content: aiResponse,
      timestamp: new Date(),
      ...(sources && { sources: cleanSourcesForFirestore(sources) }),
    },
  };
};
