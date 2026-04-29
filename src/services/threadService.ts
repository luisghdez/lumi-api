import { db } from "../config/firebaseConfig";
import { extractTextFromImage } from "./visionService";
import { processGeneralMessage } from "./generalChatService";
import { uploadFileToFirebaseStorage } from "./firebaseStorageService";
import { v4 as uuidv4 } from "uuid";

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
): Promise<{ threadId: string; thread: ThreadData; assistantMessage: ThreadMessage }> => {
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

  const aiMessageRef = await threadRef.collection("messages").add(messageData);

  return {
    threadId: threadRef.id,
    thread: threadData,
    assistantMessage: {
      messageId: aiMessageRef.id,
      role: "assistant",
      content: initialResponse,
      timestamp: new Date(),
      ...(sources && { sources: cleanSourcesForFirestore(sources) }),
    },
  };
};

export const getUserThreads = async (
  uid: string,
  limit: number = 10,
  lastDoc?: any
): Promise<{ threads: ThreadSummary[]; hasMore: boolean; lastDoc?: any; nextCursor?: string }> => {
  let query = db
    .collection("users")
    .doc(uid)
    .collection("threads")
    .orderBy("lastMessageAt", "desc")
    .limit(limit);

  // Add pagination cursor if provided
  if (lastDoc) {
    // Support passing a DocumentSnapshot or a document ID (string)
    if (typeof lastDoc === "string") {
      const cursorSnap = await db
        .collection("users")
        .doc(uid)
        .collection("threads")
        .doc(lastDoc)
        .get();
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap);
      }
    } else {
      query = query.startAfter(lastDoc);
    }
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
  const nextCursor = lastVisibleDoc ? lastVisibleDoc.id : undefined;

  return {
    threads,
    hasMore,
    lastDoc: lastVisibleDoc,
    ...(nextCursor && { nextCursor }),
  };
};

export const getThreadMessages = async (
  uid: string,
  threadId: string,
  limit: number = 10, // Reduced default for lazy loading
  lastDoc?: any
): Promise<{ messages: ThreadMessage[]; hasMore: boolean; lastDoc?: any; nextCursor?: string; totalCount?: number }> => {
  let query = db
    .collection("users")
    .doc(uid)
    .collection("threads")
    .doc(threadId)
    .collection("messages")
    .orderBy("timestamp", "desc")
    .limit(limit);

  if (lastDoc) {
    // Support passing a DocumentSnapshot or a document ID (string)
    if (typeof lastDoc === "string") {
      const cursorSnap = await db
        .collection("users")
        .doc(uid)
        .collection("threads")
        .doc(threadId)
        .collection("messages")
        .doc(lastDoc)
        .get();
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap);
      }
    } else {
      query = query.startAfter(lastDoc);
    }
  }

  const snapshot = await query.get();
  const messages: ThreadMessage[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    messages.push({
      messageId: doc.id,
      role: data.role,
      content: data.content,
      ...(data.imageFile && { imageUrl: data.imageFile.fileUrl }),
      timestamp: data.timestamp.toDate(),
      ...(data.sources && { sources: data.sources }),
    });
  });

  // Reverse the messages to maintain chronological order (oldest to newest)
  messages.reverse();

  const hasMore = snapshot.docs.length === limit;
  const lastVisibleDoc = hasMore ? snapshot.docs[snapshot.docs.length - 1] : null;
  const nextCursor = lastVisibleDoc ? lastVisibleDoc.id : undefined;

  // Get total count for the first request (when no cursor is provided)
  let totalCount: number | undefined;
  if (!lastDoc) {
    const countSnapshot = await db
      .collection("users")
      .doc(uid)
      .collection("threads")
      .doc(threadId)
      .collection("messages")
      .count()
      .get();
    totalCount = countSnapshot.data().count;
  }

  return {
    messages,
    hasMore,
    lastDoc: lastVisibleDoc,
    ...(nextCursor && { nextCursor }),
    ...(totalCount !== undefined && { totalCount }),
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

export const createImageThread = async (
  uid: string,
  imageBuffer: Buffer,
  imageMimeType: string,
  originalFileName?: string
): Promise<{ threadId: string; thread: ThreadData; extractedText: string; uploadedFile: any }> => {
  try {
    // Generate a unique file ID for the image
    const fileId = uuidv4();
    const fileName = originalFileName || `image_${Date.now()}.${imageMimeType.split('/')[1]}`;
    
    // Upload image to Firebase Storage
    const uploadedFile = await uploadFileToFirebaseStorage(
      imageBuffer,
      fileId,
      fileName,
      imageMimeType,
      "files" // Save to files/ folder as requested
    );

    // Extract text from the image using vision service
    const extractedText = await extractTextFromImage(imageBuffer);
    
    // Create a descriptive initial message for the image
    const initialMessage = `${extractedText}`;

    const threadData = {
      initialMessage: initialMessage.trim(),
      initialResponse: "", // Will be filled after streaming
      courseId: null, // No course ID for image threads
      courseTitle: null,
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

    // Save the user's initial message (with image context and file info)
    await threadRef.collection("messages").add({
      role: "user",
      content: initialMessage.trim(),
      timestamp: new Date(),
      imageMimeType, // Store the image type for reference
      imageFile: {
        fileId: uploadedFile.fileName,
        fileUrl: uploadedFile.fileUrl,
        originalName: uploadedFile.originalName,
        mimeType: uploadedFile.mimeType,
        size: uploadedFile.size
      }
    });

    return {
      threadId: threadRef.id,
      thread: threadData,
      extractedText,
      uploadedFile
    };
  } catch (error) {
    console.error("Error creating image thread:", error);
    throw error;
  }
};

export const saveImageThreadResponse = async (
  uid: string,
  threadId: string,
  fullResponse: string
): Promise<{ messageId: string; message: ThreadMessage }> => {
  try {
    // Save the AI's response
    const aiMessageRef = await db
      .collection("users")
      .doc(uid)
      .collection("threads")
      .doc(threadId)
      .collection("messages")
      .add({
        role: "assistant",
        content: fullResponse,
        timestamp: new Date(),
      });

    // Update thread with the final response
    await db
      .collection("users")
      .doc(uid)
      .collection("threads")
      .doc(threadId)
      .update({
        initialResponse: fullResponse,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      });

    return {
      messageId: aiMessageRef.id,
      message: {
        messageId: aiMessageRef.id,
        role: "assistant",
        content: fullResponse,
        timestamp: new Date(),
      },
    };
  } catch (error) {
    console.error("Error saving image thread response:", error);
    throw error;
  }
};
