import { FastifyRequest, FastifyReply } from "fastify";
import { createCourseMeta, getFeaturedCoursesFromFirebase, getLessonsWithProgressFromFirebase, getUsersSavedCoursesFromFirebase, updateCourseContent, getCourseUploadedFiles, updateCourseEmbeddingsStatus } from "../services/courseService";
import { generateLessons } from "../services/lessonService";
import { extractTextFromImage } from "../services/visionService";
import { generateMarkdownSummaryFromTerms, openAiCourseContent } from "../services/openAICourseContentService";
import { assignCourseToClass, createSavedCourse, createSavedCourseOptimized } from "../services/savedCourseService";
import { parseOfficeAsync } from "officeparser";
import { embedAndStoreWithMetadata, embedAndStoreWithMetadataStreaming } from "../services/enhancedEmbedAndChunk";
import { uploadFileToFirebaseStorage, UploadedFile } from "../services/firebaseStorageService";
import { db, admin } from "../config/firebaseConfig";
import { processConcurrently, processInBatches } from "../utils/concurrency";
import { nanoid } from "nanoid";

/**
 * 🚀 LEVEL 1 OPTIMIZATION: Batched database writes for maximum performance
 * Combines multiple Firestore operations into a single batch
 */
async function batchedCourseUpdate(courseId: string, data: {
  lessons: Record<string, any>;
  mergedFlashcards: any[];
  summary: string;
  title: string;
  subject: string;
  description: string;
  processedFiles?: any[];
  uploadedFiles?: any[];
}) {
  const batchStartTime = Date.now();
  console.log("🚀 Starting BATCHED database update");

  try {
    const courseRef = db.collection("courses").doc(courseId);
    const lessonsRef = courseRef.collection("lessons");
    const batch = db.batch();

    // 1️⃣ Update main course document with all metadata and content
    const courseUpdateData: any = {
      title: data.title,
      description: data.description,
      subject: data.subject,
      mergedFlashcards: data.mergedFlashcards,
      summary: data.summary,
      hasEmbeddings: true, // Mark as complete
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add optional data if present
    if (data.uploadedFiles && data.uploadedFiles.length > 0) {
      courseUpdateData.uploadedFiles = data.uploadedFiles;
    }
    if (data.processedFiles && data.processedFiles.length > 0) {
      courseUpdateData.processedFiles = data.processedFiles.map(file => ({
        fileName: file.fileName,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileIndex: file.fileIndex,
        totalChunks: file.chunks.length
      }));
    }

    batch.update(courseRef, courseUpdateData);

    // 2️⃣ Batch write all lessons
    for (const [lessonId, lessonData] of Object.entries(data.lessons)) {
      const lessonDoc = lessonsRef.doc(lessonId);
      batch.set(lessonDoc, lessonData);
    }

    // 3️⃣ Execute single batch commit
    await batch.commit();
    
    const batchDuration = Date.now() - batchStartTime;
    console.log(`✅ BATCHED database update completed in ${batchDuration}ms`);
    console.log(`✅ Updated course "${data.title}" with ${Object.keys(data.lessons).length} lessons and ${data.mergedFlashcards.length} flashcards`);

  } catch (error) {
    console.error("❌ Batched database update failed:", error);
    throw new Error("Failed to update course content in batch");
  }
}


const OFFICE_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",   // docx
  "application/msword",                                                        // legacy .doc
  "application/vnd.ms-powerpoint",                                             // legacy .ppt
]);

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg", 
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff"
]);

// Configuration for optimized processing
const OPTIMIZATION_CONFIG = {
  // Maximum concurrent Firebase uploads
  FIREBASE_UPLOAD_CONCURRENCY: 3,
  // 🚀 LEVEL 1 OPTIMIZATION: Increased OpenAI concurrency from 5 to 15 for 3x faster content generation
  OPENAI_CONCURRENCY: 15,
  // Batch size for OpenAI processing
  OPENAI_BATCH_SIZE: 8,
  // Timeout for individual operations (30 seconds)
  OPERATION_TIMEOUT: 30000,
} as const;

/**
 * Helper function to upload files to Firebase Storage in parallel
 */
async function uploadFilesInParallel(
  files: Array<{ buffer: Buffer; filename: string; mimeType: string; fileId: string }>
): Promise<UploadedFile[]> {
  console.log(`🔥 Starting parallel upload of ${files.length} files to Firebase Storage`);
  
  const uploadPromises = files.map(async (file, index) => {
    try {
      // Use the provided fileId instead of generating a new one
      const uploadedFile = await uploadFileToFirebaseStorage(
        file.buffer,
        file.fileId,
        file.filename || "unknown", // Keep original name for metadata
        file.mimeType,
        "courses"
      );
      console.log(`✅ File ${index + 1}/${files.length} uploaded: ${uploadedFile.fileName}`);
      return uploadedFile;
    } catch (error) {
      console.error(`❌ Failed to upload file ${file.filename}:`, error);
      // Return a placeholder for failed uploads, but continue processing
      return null;
    }
  });

  const results = await Promise.all(uploadPromises);
  return results.filter((result): result is UploadedFile => result !== null);
}

/**
 * Helper function to process OpenAI content generation with controlled concurrency
 */
async function processOpenAIContentConcurrently(chunkTexts: string[]): Promise<any[]> {
  const startTime = Date.now();
  console.log(`🤖 Processing ${chunkTexts.length} chunks with OpenAI (concurrency: ${OPTIMIZATION_CONFIG.OPENAI_CONCURRENCY})`);
  
  const results = await processConcurrently(
    chunkTexts,
    async (chunk: string, index: number) => {
      try {
        console.log(`  • Processing chunk ${index + 1}/${chunkTexts.length}`);
        return await openAiCourseContent(chunk);
      } catch (error) {
        console.error(`❌ Failed to process chunk ${index + 1}:`, error);
        // Return empty structure to continue processing
        return { flashcards: [], fillInTheBlankQuestions: [], multipleChoiceQuestions: [] };
      }
    },
    OPTIMIZATION_CONFIG.OPENAI_CONCURRENCY
  );
  
  const duration = Date.now() - startTime;
  console.log(`✅ All OpenAI processing completed in ${duration}ms (avg: ${Math.round(duration / chunkTexts.length)}ms per chunk)`);
  
  return results;
}

export const createCourseController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const overallStartTime = Date.now();
    const user = (request as any).user;
    if (!user?.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    console.log("🚀 Course creation started");

    let uploadedFiles: UploadedFile[] = [];
    const filesForEmbedding: Array<{
      buffer: Buffer;
      fileName: string;
      originalName: string;
      mimeType: string;
    }> = [];
    let classId: string | undefined;
    let dueDate: string | undefined;

    // 1️⃣ Process all parts and collect files (optimized for parallel processing)
    const filesToUpload: Array<{ buffer: Buffer; filename: string; mimeType: string; fileId: string }> = [];
    
    for await (const part of request.parts()) {
      if ("file" in part) {
        console.log("Processing file:", part.filename, part.mimetype);
        
        // Check if file type is supported (PDF, images, or text)
        const isSupported = part.mimetype === "application/pdf" || 
                           part.mimetype.startsWith("image/") || 
                           part.mimetype === "text/plain";
        
        if (!isSupported) {
          console.log(`⚠️ Unsupported file type: ${part.mimetype}. Skipping ${part.filename}`);
          continue;
        }
        
        const fileBuffer = await part.toBuffer();

        // Generate the nanoid that will be used for upload
        const fileId = nanoid();
        const fileExtension = (part.filename || "unknown").split('.').pop() || '';
        const expectedFileName = `courses/${fileId}.${fileExtension}`;
        
        // Collect files for parallel upload later with the fileId
        filesToUpload.push({
          buffer: fileBuffer,
          filename: part.filename || "unknown",
          mimeType: part.mimetype,
          fileId: fileId  // Pass the fileId to use in upload
        });

        // Add file for enhanced embedding processing with correct filename
        filesForEmbedding.push({
          buffer: fileBuffer,
          fileName: expectedFileName, // Use the actual Firebase filename
          originalName: part.filename || "unknown",
          mimeType: part.mimetype
        });

      } else {
        const { fieldname, value } = part as any;
        switch (fieldname) {
          case "content":
            // Handle plain text content as a file
            if (value.trim()) {
              filesForEmbedding.push({
                buffer: Buffer.from(value, 'utf8'),
                fileName: `text_content_${filesForEmbedding.length}`,
                originalName: `text_content_${filesForEmbedding.length}`,
                mimeType: "text/plain"
              });
            }
            break;
          case "classId":
            if (value.trim()) classId = value;
            break;
          case "dueDate":
            // parse & normalize into ISO
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) {
              dueDate = parsed.toISOString();
            }
            break;
        }
      }
    }

      if (filesForEmbedding.length === 0) {
        return reply.status(400).send({ error: "No valid files or content provided" });
      }

      console.log(
        `🚀 Processing ${filesForEmbedding.length} file(s) with optimized parallel processing...`
      );

      // 2️⃣ Create course metadata first with temporary values
      const courseId = await createCourseMeta({ 
        title: "Generating Course...", 
        description: "Course content is being generated...", 
        createdBy: user.uid,
        hasEmbeddings: false,
        visibility: "Private"
      });
      
      // 3️⃣ Start parallel operations: Firebase upload AND document processing
      const parallelStartTime = Date.now();
      console.log("🔄 Starting parallel operations: Firebase upload and document streaming processing");
      const [uploadResults, { coarseChunks: chunkTexts, processedFiles, embeddingPromise }] = await Promise.all([
        // Parallel Firebase uploads
        filesToUpload.length > 0 ? uploadFilesInParallel(filesToUpload) : Promise.resolve([]),
        // 🚀 LEVEL 1 OPTIMIZATION: Document processing with streaming for immediate content generation
        embedAndStoreWithMetadataStreaming(courseId, filesForEmbedding)
      ]);
      
      const parallelDuration = Date.now() - parallelStartTime;
      console.log(`✅ Parallel operations completed in ${parallelDuration}ms`);
      
      // Assign upload results to uploadedFiles
      uploadedFiles = uploadResults;
      
      // 4️⃣ File metadata will be stored in batched update (no separate operation needed)
      
      // 🚀 LEVEL 1 OPTIMIZATION: Start content generation immediately while embeddings continue
      console.log("🚀 PARALLEL PROCESSING: Starting content generation while embeddings run in background");
      const [chunkedResponses] = await Promise.all([
        // 5️⃣ Process OpenAI content generation with controlled concurrency (immediate start)
        processOpenAIContentConcurrently(chunkTexts),
        // 6️⃣ Wait for embeddings to complete and mark as complete (background)
        embeddingPromise.then(() => updateCourseEmbeddingsStatus(courseId, true)).catch(error => {
          console.error("❌ Failed to complete embeddings:", error);
        })
      ]);    

    // 7️⃣ Merge all question arrays
    const mergedFlashcards = chunkedResponses.flatMap((r: any) => r?.flashcards || []);
    const mergedFillInTheBlanks = chunkedResponses.flatMap(
      (r: any) => r?.fillInTheBlankQuestions || []
    );
    const mergedMultipleChoice = chunkedResponses.flatMap(
      (r: any) => r?.multipleChoiceQuestions || []
    );

    console.log(
      `🎯 Totals → Flashcards: ${mergedFlashcards.length}, MCQs: ${mergedMultipleChoice.length}, FITBs: ${mergedFillInTheBlanks.length}`
    );

    // 8️⃣ Generate lessons (fast, local operation)
    const { lessons, lessonCount } = generateLessons(
      mergedFlashcards,
      mergedMultipleChoice,
      mergedFillInTheBlanks
    );

    // 9️⃣ Parallel operations: Summary generation and course content update prep
    console.log("🔄 Starting parallel final operations");
    const [summaryData] = await Promise.all([
      // Generate summary with title and subject
      generateMarkdownSummaryFromTerms(mergedFlashcards.map((f: any) => f.term)).catch(error => {
        console.error("❌ Failed to generate summary:", error);
        return { title: "Course", subject: "Other", summary: "" };
      }),
      // Processed files metadata will be stored in batched update (no separate operation needed)
      Promise.resolve()
    ]);

    // Extract generated data
    const { title, subject, summary } = summaryData || { title: "Course", subject: "Other", summary: "" };

    // 🔟 🚀 LEVEL 1 OPTIMIZATION: Batched database writes for better performance
    await batchedCourseUpdate(courseId, {
      lessons,
      mergedFlashcards,
      summary,
      title,
      subject,
      description: `A ${subject} course covering key concepts and skills.`,
      processedFiles,
      uploadedFiles
    });

    // 1️⃣1️⃣ Final parallel operations: class assignment and saved course creation
    const finalOperations = [];
    
    if (classId) {
      finalOperations.push(
        assignCourseToClass(classId, courseId, title, dueDate).catch(error => {
          console.error("❌ Failed to assign course to class:", error);
        })
      );
    }
    
    finalOperations.push(
      // 🚀 LEVEL 1 OPTIMIZATION: Create saved course with data we already have (no redundant DB reads)
      createSavedCourseOptimized(user.uid, {
        courseId,
        lessonCount,
        title,
        description: `A ${subject} course covering key concepts and skills.`,
        subject,
        hasEmbeddings: true
      }).catch(error => {
        console.error("❌ Failed to create saved course:", error);
      })
    );

    // Execute final operations in parallel
    if (finalOperations.length > 0) {
      await Promise.all(finalOperations);
    }

    // 1️⃣2️⃣ Success response with performance info
    const totalDuration = Date.now() - overallStartTime;
    console.log(`🎉 Course creation completed successfully! CourseID: ${courseId}`);
    console.log(`📊 Performance Summary:
      - Total Duration: ${totalDuration}ms (${Math.round(totalDuration/1000)}s)
      - Files processed: ${filesForEmbedding.length}
      - Files uploaded: ${uploadedFiles.length}
      - Text chunks generated: ${chunkTexts.length}
      - Flashcards created: ${mergedFlashcards.length}
      - Lessons generated: ${lessonCount}
    `);

    return reply.status(201).send({
      message: "Course created successfully with AI-generated title and content",
      courseId,
      title,
      subject,
      lessonCount,
      summary,
      uploadedFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      stats: {
        filesProcessed: filesForEmbedding.length,
        filesUploaded: uploadedFiles.length,
        chunksGenerated: chunkTexts.length,
        flashcardsCreated: mergedFlashcards.length,
        lessonsGenerated: lessonCount
      }
    });

  } catch (error) {
    console.error("❌ Error creating course:", error);
    return reply.status(500).send({ 
      error: "Internal Server Error",
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

export const getCoursesController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    console.log(`📚 Fetching courses for User: ${user.uid}`);

    // Call Firebase service to fetch user's courses
    const userCourses = await getUsersSavedCoursesFromFirebase(user.uid);

    return reply.status(200).send({
      message: "Courses retrieved successfully",
      courses: userCourses,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

export const getFeaturedCoursesController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    console.log(`📚 Fetching featured courses`);

    // Call Firebase service to fetch user's courses
    const featuredCourses = await getFeaturedCoursesFromFirebase();

    return reply.status(200).send({
      message: "Courses retrieved successfully",
      courses: featuredCourses,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

export const getLessonsController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { courseId } = request.params as { courseId: string };

    if (!courseId) {
      return reply.status(400).send({ error: "Missing courseId parameter" });
    }

    console.log(`📚 Fetching lessons for Course: ${courseId} (User: ${user.uid})`);

    // Fetch lessons along with the user's progress from Firebase
    const courseData = await getLessonsWithProgressFromFirebase(user.uid, courseId);
    const { lessons, mergedFlashcards, summary } = courseData;


    if (!lessons.length) {
      return reply.status(404).send({ error: "No lessons found for this course" });
    }

    return reply.status(200).send({
      message: "Lessons retrieved successfully",
      lessons,
      mergedFlashcards,
      summary,
    });
  } catch (error) {
    console.error("Error fetching lessons:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};

export const getCourseFilesController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { courseId } = request.params as { courseId: string };

    if (!courseId) {
      return reply.status(400).send({ error: "Missing courseId parameter" });
    }

    console.log(`📁 Fetching uploaded files for Course: ${courseId} (User: ${user.uid})`);

    const uploadedFiles = await getCourseUploadedFiles(courseId);

    return reply.status(200).send({
      message: "Uploaded files retrieved successfully",
      uploadedFiles,
    });
  } catch (error) {
    console.error("Error fetching uploaded files:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};




