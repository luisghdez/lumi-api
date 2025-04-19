import { FastifyRequest, FastifyReply } from "fastify";
import { authenticateUser } from "../middleware/authUser";
import { getFeaturedCoursesFromFirebase, getLessonsWithProgressFromFirebase, getUsersSavedCoursesFromFirebase, saveCourseToFirebase } from "../services/courseService";
import { generateLessons } from "../services/lessonService";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { extractTextFromPDF } from "../services/pdfService";
import { extractTextFromImage } from "../services/visionService";
import { openAiCourseContent } from "../services/openAICourseContentService";
import { getUserCoursesFromFirebase } from "../services/courseService";
import { createSavedCourse } from "../services/savedCourseService";


export const createCourseController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const user = (request as any).user;

    if (!user || !user.uid) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    console.log("Controller triggered");

    let extractedFilesText: string[] = [];
    let title = "Untitled Course"; 
    let description = "No description provided"; 

    console.log("Processing request data...");

    for await (const part of request.parts()) {
      if ("file" in part) {
        console.log("Processing file:", part.filename, part.mimetype);

        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, part.filename);

        console.log("Saving file temporarily:", tempFilePath);

        const fileBuffer = await part.toBuffer();
        await fs.writeFile(tempFilePath, fileBuffer);

        let fileExtractedText = "";
        if (part.mimetype === "application/pdf") {
          console.log("Extracting text from PDF...");
          fileExtractedText = await extractTextFromPDF(tempFilePath);
        } else if (part.mimetype.startsWith("image/")) {
          console.log("Extracting text from image...");
          fileExtractedText = await extractTextFromImage(tempFilePath);
        } else {
          console.log("Reading file as plain text...");
          fileExtractedText = (await fs.readFile(tempFilePath, "utf8")).toString();
        }

        console.log("Deleting temporary file:", tempFilePath);
        await fs.unlink(tempFilePath);

        if (fileExtractedText.trim()) {
          extractedFilesText.push(fileExtractedText);
        }
      } else {
        const textPart = part as { fieldname: string; value: string };
        if (textPart.fieldname === "content" && textPart.value.trim()) {
          extractedFilesText.push(textPart.value);
        } else if (textPart.fieldname === "title" && textPart.value.trim()) {
          title = textPart.value;
        } else if (textPart.fieldname === "description" && textPart.value.trim()) {
          description = textPart.value;
        }
      }
    }

    if (extractedFilesText.length === 0) {
      console.log("No valid text extracted.");
      return reply.status(400).send({ error: "No valid text provided" });
    }

    console.log(`Processing ${extractedFilesText.length} extracted texts separately...`);
    console.log(`📝 Title: ${title}`);
    console.log(`📖 Description: ${description}`);

    const courseContentArray = await Promise.all(
      extractedFilesText.map(async (text, index) => {
        console.log(`\n🔹 Processing File ${index + 1} (Length: ${text.length} chars)`);

        return await openAiCourseContent(text);
      })
    );

    const mergedFlashcards = courseContentArray.flatMap(c => c?.flashcards || []);
    const mergedFillInTheBlanks = courseContentArray.flatMap(c => c?.fillInTheBlankQuestions || []);
    const mergedMultipleChoice = courseContentArray.flatMap(c => c?.multipleChoiceQuestions || []);

    console.log(`\n🎯 Total Flashcards: ${mergedFlashcards.length}`);
    console.log(`🎯 Total Multiple Choice Questions: ${mergedMultipleChoice.length}`);
    console.log(`🎯 Total Fill in the Blanks: ${mergedFillInTheBlanks.length}`);

    const { lessons, lessonCount } = generateLessons(
      mergedFlashcards,
      mergedMultipleChoice,
      mergedFillInTheBlanks
    );
        
    const courseId = await saveCourseToFirebase({
      title,
      description,
      createdBy: user.uid,
      // createdByName: user.name,
      lessons,
      mergedFlashcards,
    });

    await createSavedCourse(user.uid, { courseId, lessonCount: lessonCount });

    return reply.status(201).send({
      message: "Course created successfully",
      courseId,
      lessonCount
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
    const featuredCourses = await getFeaturedCoursesFromFirebase(user.uid);

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


