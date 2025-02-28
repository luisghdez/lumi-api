interface Flashcard {
    term: string;
    definition: string;
  }
  
  interface Question {
    questionText: string;
    options: string[];
    correctAnswer: string;
  }
  
  interface Lesson {
    flashcards?: Flashcard[];
    matchTheTerm?: Question[];
    multipleChoice?: Question[];
    fillInTheBlank?: Question[];
  }
  
  export function generateLessons(
    flashcards: Flashcard[],
    multipleChoice: Question[],
    fillInTheBlanks: Question[]
  ): { [key: string]: Lesson } {
    const lessons: { [key: string]: Lesson } = {};
    let flashcardIndex = 0, multipleChoiceIndex = 0, fillInBlankIndex = 0;
    let lessonCount = 1;
  
    // Strong Review Phase: Flashcards + Match the Term
    while (flashcardIndex < flashcards.length) {
      lessons[`lesson${lessonCount}`] = {
        flashcards: flashcards.slice(flashcardIndex, flashcardIndex + 12),
        // matchTheTerm: multipleChoice.slice(multipleChoiceIndex, multipleChoiceIndex + 2)
      };
      flashcardIndex += 12;
      multipleChoiceIndex += 2;
      lessonCount++;
    }
  
    // Balanced Section: Mix of Problems + Some Flashcards
    while (multipleChoiceIndex < multipleChoice.length || fillInBlankIndex < fillInTheBlanks.length) {
      lessons[`lesson${lessonCount}`] = {
        flashcards: flashcards.slice(flashcardIndex, flashcardIndex + 4),
        multipleChoice: multipleChoice.slice(multipleChoiceIndex, multipleChoiceIndex + 4),
        fillInTheBlank: fillInTheBlanks.slice(fillInBlankIndex, fillInBlankIndex + 4),
        // matchTheTerm: multipleChoice.slice(multipleChoiceIndex, multipleChoiceIndex + 2)
      };
      flashcardIndex += 4;
      multipleChoiceIndex += 4;
      fillInBlankIndex += 4;
      lessonCount++;
    }
  
    // Challenge Section: Only Problems, No Flashcards
    while (multipleChoiceIndex < multipleChoice.length || fillInBlankIndex < fillInTheBlanks.length) {
      lessons[`lesson${lessonCount}`] = {
        multipleChoice: multipleChoice.slice(multipleChoiceIndex, multipleChoiceIndex + 5),
        fillInTheBlank: fillInTheBlanks.slice(fillInBlankIndex, fillInBlankIndex + 5),
        // matchTheTerm: multipleChoice.slice(multipleChoiceIndex, multipleChoiceIndex + 2)
      };
      multipleChoiceIndex += 5;
      fillInBlankIndex += 5;
      lessonCount++;
    }
  
    return lessons;
  }
  