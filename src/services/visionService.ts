import fs from "fs/promises";
import OpenAI from "openai";
import FileType from "file-type";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const extractTextFromImage = async (filePath: string): Promise<string> => {
  try {
    console.log("📷 Processing image:", filePath);

    const imageBuffer = await fs.readFile(filePath);

    const fileTypeResult = await FileType.fromBuffer(imageBuffer);
    const mimeType = fileTypeResult?.mime || "image/png"; // Default to PNG if unknown
    console.log("Detected MIME Type:", mimeType);

    const base64Image = imageBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract and return all readable text from this image." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      store: true,
    });

    return response.choices[0].message.content || "No text detected.";
  } catch (error) {
    console.error("❌ Error extracting text from image:", error);
    throw new Error("Failed to process image file.");
  }
};
