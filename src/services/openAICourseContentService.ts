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

const courseSummarySchema = z.object({
  title: z.string(),
  subject: z.enum([
    "Algebra",
    "Geometry", 
    "Statistics",
    "Calculus",
    "Biology",
    "Chemistry",
    "Physics",
    "Earth & Space Science",
    "Environmental Science",
    "Computer Science",
    "World History",
    "U.S. History",
    "European History",
    "Art History",
    "Psychology",
    "Sociology",
    "Philosophy",
    "Accounting",
    "Finance",
    "Marketing",
    "General Business",
    "Microeconomics",
    "Macroeconomics",
    "Music",
    "Art & Design",
    "Foreign Languages",
    "Other"
  ]),
  summary: z.string(),
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
    Every math symbol or expression—no matter how small—must be enclosed within the $$ … $$ math delimiters; absolutely no other delimiters are allowed.
    NEVER use \`\\(\` … \`\\)\`, \`\\[\` … \`\\]\`, single \`$\`, back‑ticks, or raw LaTeX without delimiters.  **Only** \`$$ … $$\`.
    NEVER use Unicode math symbols (√, ∫, ½, …) – write them in LaTeX.
    Write LaTeX commands **with a doubled back‑slash** (e.g. \`\\\\sqrt\`) so the frontend receives a single back‑slash after JSON escaping.

  Content:
  `;

  try {
    const startTime = Date.now();
    console.log(`⏱️ Starting OpenAI content generation (${Math.ceil(extractedText.length/1000)}k chars)`);
    
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: promptInstructions },
        { role: "user", content: extractedText },
      ],
      // max_tokens: 2048,
      response_format: zodResponseFormat(courseContentSchema, "courseContent"),
    });

    const duration = Date.now() - startTime;
    console.log(`✅ OpenAI content generation completed in ${duration}ms`);

    const courseContent = completion.choices[0].message.parsed;
    return courseContent;
  } catch (error) {
    console.error("Error generating course content:", error);
    throw error;
  }
}


export async function generateMarkdownSummaryFromTerms(terms: string[]) {
  const prompt = `
  Based on the provided terms, generate:
  
  1. A short, engaging title for the course (15-25 characters)
  2. The most appropriate subject from the predefined list
  3. A comprehensive Markdown study guide
  
  For the study guide:
  - Start with one catchy intro line
  - Explain each term in plain, student‑friendly words  
  - Use Markdown formatting: headings, bullet lists, tables, etc.
  - Show links between related terms
  - Add helpful context—don't just repeat the list
  
  Terms:
  ${terms.map(t => `- ${t}`).join("\n")}
  `;

  const startTime = Date.now();
  console.log(`⏱️ Starting enhanced summary generation for ${terms.length} terms`);

  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "You generate course titles, categorize subjects, and create readable Markdown summaries for students. Choose the most appropriate subject from the predefined list." },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(courseSummarySchema, "courseSummary"),
  });

  const duration = Date.now() - startTime;
  console.log(`✅ Enhanced summary generation completed in ${duration}ms`);

  const result = completion.choices[0].message.parsed;
  return result;
}
