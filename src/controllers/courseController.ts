import { FastifyReply, FastifyRequest } from "fastify";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { extractTextFromPDF } from "../services/pdfService";
import { extractTextFromImage } from "../services/visionService";
import { openAiCourseContent } from "../services/openAICourseContentService";

export const createCourseController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    console.log("Controller triggered");

    let extractedFilesText: string[] = [];
    let title = "Untitled Course"; // Default title
    let description = "No description provided"; // Default description

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
        // Handle additional fields (title, description, etc.)
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

    // Call OpenAI for each extracted file separately
    const courseContentArray = await Promise.all(
      extractedFilesText.map(async (text, index) => {
        console.log(`\n🔹 Processing File ${index + 1} (Length: ${text.length} chars)`);
        const courseContent = await openAiCourseContent(text);
        
        console.log(`✅ File ${index + 1} Results:`);
        console.log(`   📌 Flashcards: ${courseContent?.flashcards.length}`);
        console.log(`   ❓ Multiple Choice Questions: ${courseContent?.multipleChoiceQuestions.length}`);
        console.log(`   ✏️ Fill in the Blanks: ${courseContent?.fillInTheBlankQuestions.length}`);
        
        return courseContent;
      })
    );

    // Merge results from all files
    const mergedFlashcards = courseContentArray.flatMap(c => c?.flashcards);
    const mergedFillInTheBlanks = courseContentArray.flatMap(c => c?.fillInTheBlankQuestions);
    const mergedMultipleChoice = courseContentArray.flatMap(c => c?.multipleChoiceQuestions);

    console.log(`\n🎯 Total Flashcards Generated: ${mergedFlashcards.length}`);
    console.log(`🎯 Total Multiple Choice Questions: ${mergedMultipleChoice.length}`);
    console.log(`🎯 Total Fill in the Blanks: ${mergedFillInTheBlanks.length}`);

    return reply.status(201).send({
      message: "Course created successfully",
      course: {
        title,
        description,
        flashcards: mergedFlashcards,
        fillInTheBlankQuestions: mergedFillInTheBlanks,
        multipleChoiceQuestions: mergedMultipleChoice,
      },
    });
  } catch (error) {
    console.error("Error in course creation:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};
