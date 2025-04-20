import { FastifyRequest, FastifyReply } from "fastify";
import { getFeaturedCoursesFromFirebase, getLessonsWithProgressFromFirebase, getUsersSavedCoursesFromFirebase, saveCourseToFirebase } from "../services/courseService";
import { generateLessons } from "../services/lessonService";
import { extractTextFromImage } from "../services/visionService";
import { openAiCourseContent } from "../services/openAICourseContentService";
import { createSavedCourse } from "../services/savedCourseService";
import { parseOfficeAsync } from "officeparser";


const OFFICE_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",   // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",         // xlsx
  "application/msword",                                                        // legacy .doc
  "application/vnd.ms-powerpoint",                                             // legacy .ppt
  "application/vnd.ms-excel"                                                   // legacy .xls
]);

/**
 * Splits `text` into chunks ≤ maxLen, breaking at the last `.` before the limit.
 */
function splitIntoChunks(text: string, maxLen = 1500): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    if (text.length - start <= maxLen) {
      chunks.push(text.slice(start).trim());
      break;
    }

    const end = start + maxLen;
    const periodIdx = text.lastIndexOf(".", end);
    const splitPos = periodIdx > start ? periodIdx + 1 : end;

    chunks.push(text.slice(start, splitPos).trim());
    start = splitPos;
  }

  return chunks;
}

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

    const extractedFilesText: string[] = [];
    let title = "Untitled Course";
    let description = "No description provided";

    // 1️⃣ Extract raw text from all parts
    for await (const part of request.parts()) {
      if ("file" in part) {
        console.log("Processing file:", part.filename, part.mimetype);
        const fileBuffer = await part.toBuffer();
        let fileExtractedText = "";

        if (OFFICE_MIME_TYPES.has(part.mimetype)) {
          console.log("Extracting text from Office/PDF...");
          fileExtractedText = await parseOfficeAsync(fileBuffer);

        } else if (part.mimetype.startsWith("image/")) {
          console.log("Extracting text from image...");
          fileExtractedText = await extractTextFromImage(fileBuffer);

        } else {
          console.log("Reading file as plain text...");
          fileExtractedText = fileBuffer.toString("utf8");
        }

        if (fileExtractedText.trim()) {
          extractedFilesText.push(fileExtractedText);
        }

      } else {
        const { fieldname, value } = part as any;
        if (fieldname === "title" && value.trim()) {
          title = value;
        } else if (fieldname === "description" && value.trim()) {
          description = value;
        } else if (fieldname === "content" && value.trim()) {
          extractedFilesText.push(value);
        }
      }
    }

    if (extractedFilesText.length === 0) {
      return reply.status(400).send({ error: "No valid text provided" });
    }

    console.log(
      `Extracted text from ${extractedFilesText.length} part(s), now chunking...`
    );

    // 2️⃣ Break every file’s text into sentence‑safe chunks
    const allChunks = extractedFilesText.flatMap((text) =>
      splitIntoChunks(text, 1500)
    );
    console.log(`→ ${allChunks.length} chunks ready for OpenAI.`);

    // 3️⃣ Call OpenAI in parallel on each chunk
    const chunkedResponses = await Promise.all(
      allChunks.map((chunk, idx) => {
        console.log(`  • processing chunk ${idx + 1}/${allChunks.length}`);
        return openAiCourseContent(chunk);
      })
    );

    // 4️⃣ Merge all question arrays
    const mergedFlashcards = chunkedResponses.flatMap((r) => r?.flashcards || []);
    const mergedFillInTheBlanks = chunkedResponses.flatMap(
      (r) => r?.fillInTheBlankQuestions || []
    );
    const mergedMultipleChoice = chunkedResponses.flatMap(
      (r) => r?.multipleChoiceQuestions || []
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

    const courseId = await saveCourseToFirebase({
      title,
      description,
      createdBy: user.uid,
      lessons,
      mergedFlashcards,
    });

    await createSavedCourse(user.uid, { courseId, lessonCount });

    // 6️⃣ Respond
    return reply.status(201).send({
      message: "Course created successfully",
      courseId,
      lessonCount,
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


