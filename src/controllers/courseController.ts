import { FastifyRequest, FastifyReply } from "fastify";
import { createCourseMeta, getFeaturedCoursesFromFirebase, getLessonsWithProgressFromFirebase, getUsersSavedCoursesFromFirebase, updateCourseContent, getCourseUploadedFiles } from "../services/courseService";
import { generateLessons } from "../services/lessonService";
import { extractTextFromImage } from "../services/visionService";
import { generateMarkdownSummaryFromTerms, openAiCourseContent } from "../services/openAICourseContentService";
import { assignCourseToClass, createSavedCourse } from "../services/savedCourseService";
import { parseOfficeAsync } from "officeparser";
import { embedAndStoreWithMetadata } from "../services/enhancedEmbedAndChunk";
import { uploadFileToFirebaseStorage, UploadedFile } from "../services/firebaseStorageService";
import { db, admin } from "../config/firebaseConfig";


const OFFICE_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",   // docx
  "application/msword",                                                        // legacy .doc
  "application/vnd.ms-powerpoint",                                             // legacy .ppt
]);

export const createCourseController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;
    if (!user?.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    console.log("Controller triggered");

    const uploadedFiles: UploadedFile[] = [];
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

    // 1️⃣ Process all parts and collect files for embedding
    for await (const part of request.parts()) {
      if ("file" in part) {
        console.log("Processing file:", part.filename, part.mimetype);
        const fileBuffer = await part.toBuffer();

        // Upload file to Firebase Storage
        try {
          const uploadedFile = await uploadFileToFirebaseStorage(
            fileBuffer,
            part.filename || "unknown",
            part.mimetype,
            "courses"
          );
          uploadedFiles.push(uploadedFile);
          console.log(`✅ File uploaded to Firebase Storage: ${uploadedFile.fileName}`);
        } catch (uploadError) {
          console.error("❌ Failed to upload file to Firebase Storage:", uploadError);
          // Continue processing even if upload fails
        }

        // Add file for enhanced embedding processing
        filesForEmbedding.push({
          buffer: fileBuffer,
          fileName: uploadedFiles[uploadedFiles.length - 1]?.fileName || `file_${filesForEmbedding.length}`,
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
        `Processing ${filesForEmbedding.length} file(s) with enhanced embedding...`
      );

      const courseId = await createCourseMeta({ title, description, createdBy: user.uid });
      
      // Store uploaded files metadata in the course document
      if (uploadedFiles.length > 0) {
        try {
          const courseRef = db.collection("courses").doc(courseId);
          await courseRef.update({
            uploadedFiles: uploadedFiles,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`✅ Uploaded ${uploadedFiles.length} files metadata to course ${courseId}`);
        } catch (error) {
          console.error("❌ Failed to store uploaded files metadata:", error);
        }
      }
      
      const { coarseChunks: chunkTexts, processedFiles } = await embedAndStoreWithMetadata(courseId, filesForEmbedding);
    
    const chunkedResponses = await Promise.all(
      chunkTexts.map((chunk: string, idx: number) => {
        console.log(`  • processing chunk ${idx + 1}/${chunkTexts.length}`);
        return openAiCourseContent(chunk);
      })
    );    

    // 4️⃣ Merge all question arrays
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

    // 5️⃣ Generate lessons & save
    const { lessons, lessonCount } = generateLessons(
      mergedFlashcards,
      mergedMultipleChoice,
      mergedFillInTheBlanks
    );

    const summary = await generateMarkdownSummaryFromTerms(title, mergedFlashcards.map((f: any) => f.term)) || '';

    await updateCourseContent(courseId, { lessons, mergedFlashcards, summary });

    // Store processed files metadata for RAG source tracking
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

    if (classId) {
      await assignCourseToClass(classId, courseId, title, dueDate);
    }

    await createSavedCourse(user.uid, { courseId, lessonCount });

    // 6️⃣ Respond
    return reply.status(201).send({
      message: "Course created successfully",
      courseId,
      lessonCount,
      summary,
      uploadedFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
    });

  } catch (error) {
    console.error("Error creating course:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
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
    const { lessons, mergedFlashcards } = courseData;


    if (!lessons.length) {
      return reply.status(404).send({ error: "No lessons found for this course" });
    }

    return reply.status(200).send({
      message: "Lessons retrieved successfully",
      lessons,
      mergedFlashcards,
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


