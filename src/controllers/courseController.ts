import { FastifyReply, FastifyRequest } from "fastify";
import fs from "fs/promises";
import path from "path";
import { extractTextFromPDF } from "../services/pdfService";
import { extractTextFromImage } from "../services/visionService";

interface CourseRequest {
  title: string;
  description: string;
  instructor: string;
}

export const createCourseController = async (
    request: FastifyRequest,
    reply: FastifyReply
) => {
  try {
    // Extract form-data fields directly from request.body
    // const { title, description, instructor } = request.body;

    // if (!title || !description || !instructor) {
    //   return reply.status(400).send({ error: "Missing required fields" });
    // }

    // Extract uploaded file
    const data = await request.file();
    console.log("File data:", data);

    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    // Define upload directory
    const uploadDir = path.join(__dirname, "../../uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    // Save the uploaded file
    const filePath = path.join(uploadDir, data.filename);
    const fileBuffer = await data.toBuffer();
    await fs.writeFile(filePath, fileBuffer);

    let extractedText = "";
    if (data.mimetype === "application/pdf") {
      extractedText = await extractTextFromPDF(filePath);
    } else if (data.mimetype.startsWith("image/")) {
      extractedText = await extractTextFromImage(filePath);
    } else {
      extractedText = (await fs.readFile(filePath, "utf8")).toString();
    }

    return reply.status(201).send({
      message: "Course created successfully",
    //   course: { title, description, instructor, extractedText },
      course: { title: "title", description: "description", instructor: "instructor", extractedText },
      file: {
        filename: data.filename,
        mimetype: data.mimetype,
        size: data.file.bytesRead,
        path: filePath,
      },
    });
  } catch (error) {
    console.error("Error in course creation:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
};
