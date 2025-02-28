import { FastifyReply, FastifyRequest } from "fastify";
import fs from "fs/promises";
import path from "path";
import { extractTextFromPDF } from "../services/pdfService";
import { extractTextFromImage } from "../services/visionService";
import { openAiCourseContent } from "../services/openAICourseContentService";

export const createCourseController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    console.log("Controller triggered");
    let extractedText = "";

    // Create or ensure the upload directory exists
    const uploadDir = path.join(__dirname, "../../uploads");
    console.log("Creating upload directory:", uploadDir);
    await fs.mkdir(uploadDir, { recursive: true });

    console.log("Iterating over request parts...");
    for await (const part of request.parts()) {
      if ("file" in part) {
        // This is a file part
        console.log(
          "Processing file part:",
          part.fieldname,
          part.filename,
          part.mimetype
        );

        // Get file buffer and define the file path
        const fileBuffer = await part.toBuffer();
        const filePath = path.join(uploadDir, part.filename);
        console.log("Saving file to:", filePath);
        await fs.writeFile(filePath, fileBuffer);
        console.log("File saved successfully.");

        let fileExtractedText = "";
        if (part.mimetype === "application/pdf") {
          console.log("Extracting text from PDF...");
          fileExtractedText = await extractTextFromPDF(filePath);
          console.log("Extracted text from PDF:", fileExtractedText);
        } else if (part.mimetype.startsWith("image/")) {
          console.log("Extracting text from image...");
          fileExtractedText = await extractTextFromImage(filePath);
          console.log("Extracted text from image:", fileExtractedText);
        } else {
          console.log("Reading file as plain text...");
          fileExtractedText = (await fs.readFile(filePath, "utf8")).toString();
          console.log("Extracted text from plain file:", fileExtractedText);
        }
        extractedText += fileExtractedText ? `\n${fileExtractedText}` : "";
      } else {
        // This is a text field
        const textPart = part as { fieldname: string; value: string };
        if (textPart.fieldname === "content" && textPart.value) {
          console.log("Processing text part 'content':", textPart.value);
          extractedText += textPart.value + "\n";
        }
      }
    }

    console.log("Final extracted text:", extractedText);
    if (!extractedText.trim()) {
      console.log("No text extracted, sending error response");
      return reply
        .status(400)
        .send({ error: "No text content or valid file provided" });
    }

    console.log("Calling OpenAI service with extracted text...");
    const courseContent = await openAiCourseContent(extractedText);
    console.log("Received course content from OpenAI:", courseContent);

    return reply.status(201).send({
      message: "Course created successfully",
      course: { courseContent },
    });
  } catch (error) {
    console.error("Error in course creation:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};
