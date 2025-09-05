import { FastifyRequest, FastifyReply } from "fastify";
import { createCourseMeta, getFeaturedCoursesFromFirebase, getLessonsWithProgressFromFirebase, getUsersSavedCoursesFromFirebase, updateCourseContent, getCourseUploadedFiles, updateCourseEmbeddingsStatus } from "../services/courseService";
import { generateLessons } from "../services/lessonService";
import { extractTextFromImage } from "../services/visionService";
import { generateMarkdownSummaryFromTerms, openAiCourseContent } from "../services/openAICourseContentService";
import { assignCourseToClass, createSavedCourse } from "../services/savedCourseService";
import { parseOfficeAsync } from "officeparser";
import { embedAndStoreWithMetadata } from "../services/enhancedEmbedAndChunk";
import { uploadFileToFirebaseStorage, UploadedFile } from "../services/firebaseStorageService";
import { db, admin } from "../config/firebaseConfig";
import { processConcurrently, processInBatches } from "../utils/concurrency";


const OFFICE_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",   // docx
  "application/msword",                                                        // legacy .doc
  "application/vnd.ms-powerpoint",                                             // legacy .ppt
]);

// Configuration for optimized processing
const OPTIMIZATION_CONFIG = {
  // Maximum concurrent Firebase uploads
  FIREBASE_UPLOAD_CONCURRENCY: 3,
  // Maximum concurrent OpenAI API calls
  OPENAI_CONCURRENCY: 5,
  // Batch size for OpenAI processing
  OPENAI_BATCH_SIZE: 8,
  // Timeout for individual operations (30 seconds)
  OPERATION_TIMEOUT: 30000,
} as const;

/**
 * Helper function to upload files to Firebase Storage in parallel
 */
async function uploadFilesInParallel(
  files: Array<{ buffer: Buffer; filename: string; mimeType: string }>
): Promise<UploadedFile[]> {
  console.log(`🔥 Starting parallel upload of ${files.length} files to Firebase Storage`);
  
  const uploadPromises = files.map(async (file, index) => {
    try {
      const uploadedFile = await uploadFileToFirebaseStorage(
        file.buffer,
        file.filename || `file_${index}`,
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
    let title = "Untitled Course";
    let description = "No description provided";
    let classId: string | undefined;
    let dueDate: string | undefined;

    // 1️⃣ Process all parts and collect files (optimized for parallel processing)
    const filesToUpload: Array<{ buffer: Buffer; filename: string; mimeType: string }> = [];
    
    for await (const part of request.parts()) {
      if ("file" in part) {
        console.log("Processing file:", part.filename, part.mimetype);
        const fileBuffer = await part.toBuffer();

        // Collect files for parallel upload later
        filesToUpload.push({
          buffer: fileBuffer,
          filename: part.filename || "unknown",
          mimeType: part.mimetype
        });

        // Add file for enhanced embedding processing
        filesForEmbedding.push({
          buffer: fileBuffer,
          fileName: `file_${filesToUpload.length - 1}`, // Will be updated after upload
          originalName: part.filename || "unknown",
          mimeType: part.mimetype
        });

      } else {
        const { fieldname, value } = part as any;
        switch (fieldname) {
          case "title":
            if (value.trim()) title = value;
            break;
          case "description":
            if (value.trim()) description = value;
            break;
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

      // 2️⃣ Create course metadata first
      const courseId = await createCourseMeta({ 
        title, 
        description, 
        createdBy: user.uid,
        hasEmbeddings: false 
      });
      
      // 3️⃣ Start parallel operations: Firebase upload AND document processing
      const parallelStartTime = Date.now();
      console.log("🔄 Starting parallel operations: Firebase upload and document embedding");
      const [uploadResults, { coarseChunks: chunkTexts, processedFiles }] = await Promise.all([
        // Parallel Firebase uploads
        filesToUpload.length > 0 ? uploadFilesInParallel(filesToUpload) : Promise.resolve([]),
        // Document processing and embedding
        embedAndStoreWithMetadata(courseId, filesForEmbedding)
      ]);
      
      const parallelDuration = Date.now() - parallelStartTime;
      console.log(`✅ Parallel operations completed in ${parallelDuration}ms`);
      
      // Assign upload results to uploadedFiles
      uploadedFiles = uploadResults;
      
      // Update file names in filesForEmbedding with actual uploaded file names
      uploadedFiles.forEach((uploadedFile, index) => {
        if (index < filesForEmbedding.length) {
          filesForEmbedding[index].fileName = uploadedFile.fileName;
        }
      });
      
      // 4️⃣ Store uploaded files metadata (async, don't block)
      if (uploadedFiles.length > 0) {
        const storeMetadata = async () => {
          try {
            const courseRef = db.collection("courses").doc(courseId);
            await courseRef.update({
              uploadedFiles: uploadedFiles,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`✅ Stored ${uploadedFiles.length} uploaded files metadata`);
          } catch (error) {
            console.error("❌ Failed to store uploaded files metadata:", error);
          }
        };
        storeMetadata(); // Don't await - let it run in background
      }
      
      // 5️⃣ Mark embeddings as complete
      await updateCourseEmbeddingsStatus(courseId, true);
    
      // 6️⃣ Process OpenAI content generation with controlled concurrency
      const chunkedResponses = await processOpenAIContentConcurrently(chunkTexts);    

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
    const [summary] = await Promise.all([
      // Generate summary
      generateMarkdownSummaryFromTerms(title, mergedFlashcards.map((f: any) => f.term)).catch(error => {
        console.error("❌ Failed to generate summary:", error);
        return '';
      }),
      // Prepare processed files metadata for storage (async operation)
      (async () => {
        if (processedFiles.length > 0) {
          try {
            const courseRef = db.collection("courses").doc(courseId);
            await courseRef.update({
              processedFiles: processedFiles.map(file => ({
                fileName: file.fileName,
                originalName: file.originalName,
                mimeType: file.mimeType,
                fileIndex: file.fileIndex,
                totalChunks: file.chunks.length
              })),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`✅ Stored processed files metadata for course ${courseId}`);
          } catch (error) {
            console.error("❌ Failed to store processed files metadata:", error);
          }
        }
      })()
    ]);

    // 🔟 Update course content
    await updateCourseContent(courseId, { lessons, mergedFlashcards, summary: summary || '' });

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
      createSavedCourse(user.uid, { courseId, lessonCount }).catch(error => {
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
      message: "Course created successfully with optimized parallel processing",
      courseId,
      lessonCount,
      summary: summary || '',
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




