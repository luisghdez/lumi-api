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
Based on the following content, generate a structured set of flashcards, fill-in-the-blank questions, and multiple-choice questions designed to help a learner fully grasp, memorize, and understand the key concepts.

Instructions:
* Dynamically determine the appropriate number of questions based on the depth and importance of the content. Some topics may require more reinforcement than others.
* Generate at least **one flashcard per key concept or topic**.
* For every flashcard you generate, you MUST also generate at least:
    * One fill-in-the-blank question related to that flashcard.
    * One multiple-choice question related to that flashcard.
* If you generate 24 flashcards, you MUST generate AT LEAST:
    * 25 fill-in-the-blank questions
    * 25 multiple-choice questions
* Expand on concepts when necessary.
* In some problems, use clear, self-made definitions that are simpler and easier to understand, avoiding overly technical or complex language.
* Ensure completeness: If a topic is mentioned but not fully explained, expand it logically to provide full context.
* Use engaging, well-structured wording to make learning interactive and effective.
* Be creative when creating the multiple choice and fill in the blank problems.
* **Whenever applicable, include real-world example questions in both the fill-in-the-blank and multiple-choice sections to illustrate practical applications of the concepts.**


Generate the following:
* Flashcards
    * Create a sufficient number of flashcards to cover key facts.
    * The number of flashcards should be proportional to the content complexity.
* Fill-in-the-blank questions
    * Design fill-in-the-blank exercises that challenge learners to recall details.
    * Provide 7 options, including one correct answer and well-thought-out distractors.
* Multiple-choice questions
    * Write multiple-choice questions that test critical thinking and understanding, not just memorization.
    * Each question should have 4 options, with one correct answer and reasonable incorrect choices.
     
    
Content to Use:
`;

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [
        { role: "system", content: promptInstructions },
        { role: "user", content: extractedText },
      ],
      max_tokens: 5000,
      response_format: zodResponseFormat(courseContentSchema, "courseContent"),
    });

    const courseContent = completion.choices[0].message.parsed;
    return courseContent;
  } catch (error) {
    console.error("Error generating course content:", error);
    throw error;
  }
}
