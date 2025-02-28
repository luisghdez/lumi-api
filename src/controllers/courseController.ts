import { FastifyReply, FastifyRequest } from "fastify";
import fs from "fs/promises";
import path from "path";
import { extractTextFromPDF } from "../services/pdfService";
import { extractTextFromImage } from "../services/visionService";
import { openAiCourseContent } from "../services/openAICourseContentService";

interface CourseRequest {
  title: string;
  description: string;
  instructor: string;
  // Optional field for direct text input
  content?: string;
}

export const createCourseController = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    let extractedText = "";

    // Check if text content is provided directly in the body
    const { content } = request.body as CourseRequest;
    if (content && content.trim().length > 0) {
      extractedText = content;
    } else {
      // Otherwise, try to extract file if available
      const data = await request.file();
      console.log("File data:", data);

      if (!data) {
        return reply
          .status(400)
          .send({ error: "No file uploaded or content provided" });
      }

      // Define upload directory and save the file
      const uploadDir = path.join(__dirname, "../../uploads");
      await fs.mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, data.filename);
      const fileBuffer = await data.toBuffer();
      await fs.writeFile(filePath, fileBuffer);

      if (data.mimetype === "application/pdf") {
        extractedText = await extractTextFromPDF(filePath);
      } else if (data.mimetype.startsWith("image/")) {
        extractedText = await extractTextFromImage(filePath);
      } else {
        extractedText = (await fs.readFile(filePath, "utf8")).toString();
      }
    }

    // Call the OpenAI service with the extracted text
    const courseContent = await openAiCourseContent(extractedText);

    return reply.status(201).send({
      message: "Course created successfully",
      course: {
        courseContent, // The structured content returned by GPT-4‑o
      },
    });
  } catch (error) {
    console.error("Error in course creation:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};
