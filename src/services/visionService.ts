import fs from "fs/promises";
import OpenAI from "openai";
import FileType from "file-type";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const extractTextFromImage = async (
  input: string | Buffer
): Promise<string> => {
  let imageBuffer: Buffer;

  if (typeof input === "string") {
    // you passed a file path
    console.log("📷 Reading image from disk:", input);
    imageBuffer = await fs.readFile(input);
  } else {
    // you passed a Buffer directly
    console.log("📷 Using in-memory image buffer");
    imageBuffer = input;
  }

  const fileTypeResult = await FileType.fromBuffer(imageBuffer);
  const mimeType = fileTypeResult?.mime || "image/png"; 
  console.log("Detected MIME Type:", mimeType);

  const base64Image = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
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
};
