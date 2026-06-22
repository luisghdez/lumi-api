import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod/v3";

const openai = new OpenAI();

const courseSubjects = [
  "Algebra",
  "Algebra 1",
  "Algebra 2",
  "Geometry",
  "Trigonometry",
  "Pre-Calculus",
  "Calculus",
  "Calculus 1",
  "Statistics",
  "Differential Equations",
  "Biology",
  "Chemistry",
  "Physics",
  "Earth & Space Science",
  "Environmental Science",
  "Electrical Engineering",
  "Computer Science",
  "Computer Science / Programming",
  "Honors Computer Education",
  "Health & Medicine",
  "World History",
  "U.S. History",
  "US History",
  "European History",
  "Art History",
  "Psychology",
  "Sociology",
  "Philosophy",
  "World Geography",
  "Civics",
  "Accounting",
  "Finance",
  "Marketing",
  "General Business",
  "Microeconomics",
  "Macroeconomics",
  "Music",
  "Art & Design",
  "Foreign Languages",
  "AP Biology",
  "AP Physics 1",
  "AP Chemistry",
  "AP Environmental Science",
  "AP Physics 2",
  "AP Physics C: E&M",
  "AP Physics C: Mechanics",
  "AP Computer Science A",
  "AP Computer Science Principles",
  "AP Statistics",
  "AP Pre-Calculus",
  "AP Business with Personal Finance",
  "AP US Government & Politics",
  "AP US History",
  "AP European History",
  "AP World History",
  "AP Human Geography",
  "AP Comparative Government & Politics",
  "AP Psychology",
  "AP Macroeconomics",
  "AP Microeconomics",
  "AP African American Studies",
  "AP Research",
  "AP English Language",
  "AP English Literature",
  "AP Music Theory",
  "AP Art History",
  "AP Spanish Language",
  "AP Spanish Literature",
  "AP French",
  "AP German",
  "AP Chinese",
  "AP Italian",
  "AP Japanese",
  "AP Latin",
  "Other",
] as const;

const courseSubjectList = courseSubjects.join(", ");

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
  subject: z.enum(courseSubjects),
  summary: z.string(),
});

export async function openAiCourseContent(extractedText: string) {
  // Define the detailed instructional prompt including the content guidelines.
  const promptInstructions = `
  Generate comprehensive structured course content from the provided educational material.
  
  Rules:
  - Each flashcard should cover ONE specific concept, term, fact, or idea.
  - Definition must NOT include the term word itself.
  - For each flashcard, create 1 fill-in-the-blank and 1 multiple-choice question.
  - MCQs: 4 options (1 correct, 3 distractors).
  - Fill-in-the-blanks: 7 options (1 correct, 6 distractors).
  - Every math symbol or expression—no matter how small—must be enclosed within the $$ … $$ math delimiters; absolutely no other delimiters are allowed.
  - NEVER use \`\\(\` … \`\\)\`, \`\\[\` … \`\\]\`, single \`$\`, back‑ticks, or raw LaTeX without delimiters.  **Only** \`$$ … $$\`.
  - NEVER use Unicode math symbols (√, ∫, ½, …) – write them in LaTeX.
  - Write LaTeX commands **with a doubled back‑slash** (e.g. \`\\\\sqrt\`) so the frontend receives a single back‑slash after JSON escaping.

  Content:
  `;

  try {
    const startTime = Date.now();
    console.log(`⏱️ Starting OpenAI content generation (${extractedText.length} chars, ~${Math.ceil(extractedText.length/4)} tokens)`);
    
    const completion = await openai.chat.completions.parse({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: promptInstructions },
        { role: "user", content: extractedText },
      ],
      // max_tokens: 2048,
      response_format: zodResponseFormat(courseContentSchema, "courseContent"),
    });

    const duration = Date.now() - startTime;
    const courseContent = completion.choices[0].message.parsed;
    
    console.log(`✅ OpenAI content generation completed in ${duration}ms`);
    console.log(`📊 Generated: ${courseContent?.flashcards?.length || 0} flashcards, ${courseContent?.multipleChoiceQuestions?.length || 0} MCQs, ${courseContent?.fillInTheBlankQuestions?.length || 0} FITBs`);
    
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
  2. The most appropriate subject from this predefined list:
  ${courseSubjectList}
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

  const completion = await openai.chat.completions.parse({
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
