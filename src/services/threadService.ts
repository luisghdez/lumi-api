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
}

export const createThread = async (
  uid: string, 
  initialMessage: string,
  initialResponse: string,
  courseId?: string
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

  // Save the AI's response
  await threadRef.collection("messages").add({
    role: "assistant",
    content: initialResponse,
    timestamp: new Date(),
  });

  return {
    threadId: threadRef.id,
    thread: threadData,
  };
};
