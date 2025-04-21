import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const courseContentSchema = z.object({
  // Include the "name" field as required by your docs.
  name: z.literal("Lumi Course"),
  flashcards: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    })
  ),
  fillInTheBlankQuestions: z.array(
    z.object({
      questionText: z.string(),
      options: z.array(z.string()),
      correctAnswer: z.string(),
      lessonType: z.literal("fillInTheBlank"),
    })
  ),
  multipleChoiceQuestions: z.array(
    z.object({
      questionText: z.string(),
      options: z.array(z.string()),
      correctAnswer: z.string(),
      lessonType: z.literal("multipleChoice"),
    })
  ),
});

export async function openAiCourseContent(extractedText: string) {
  // Define the detailed instructional prompt including the content guidelines.
  const promptInstructions = `
  Generate structured course content.
  
  Rules:
  - One flashcard per key concept.
  - Definition must NOT include the term word.
  - For each flashcard, create 1 fill-in-the-blank and 1 multiple-choice question.
  - MCQs: 4 options (1 correct, 3 distractors).
  - Fill-in-the-blanks: 7 options (1 correct, 6 distractors).
  - Use clear, simple language and real-world examples when helpful.
  - ALWAYS wrap every math expression, no matter how small, in $$…$$.
    NEVER use Unicode math symbols (√, ∫, ½, …) – write them in LaTeX.
    Allowed LaTeX commands: \\sqrt, \\frac, \\int, ^, _, \\times, \\cdot, \\pi.
    If a line has no math, do NOT add $$.

  Content:
  `;

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4.1-nano",
      messages: [
        { role: "system", content: promptInstructions },
        { role: "user", content: extractedText },
      ],
      max_tokens: 1500,
      response_format: zodResponseFormat(courseContentSchema, "courseContent"),
    });

    const courseContent = completion.choices[0].message.parsed;
    return courseContent;
  } catch (error) {
    console.error("Error generating course content:", error);
    throw error;
  }
}
