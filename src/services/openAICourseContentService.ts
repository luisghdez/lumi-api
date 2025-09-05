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


export async function generateMarkdownSummaryFromTerms(title: string, terms: string[]) {
  const openai = new OpenAI();

  const prompt = `
  Create a **Markdown** study guide.
  
  1. Start with one catchy intro line.
  2. Explain each term in plain, student‑friendly words.
  3. Use Markdown formatting: headings, bullet lists, tables, etc.
  4. Show links between related terms.
  5. Add helpful context—don't just repeat the list.
  
  Terms:
  ${terms.map(t => `- ${t}`).join("\n")}
  `;

  const startTime = Date.now();
  console.log(`⏱️ Starting summary generation for ${terms.length} terms`);

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "You generate readable Markdown summaries for students." },
      { role: "user", content: prompt },
    ],
    // max_tokens: 1500,
  });

  const duration = Date.now() - startTime;
  console.log(`✅ Summary generation completed in ${duration}ms`);

  return completion.choices[0].message.content;
}
