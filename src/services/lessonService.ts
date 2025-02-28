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
    flashcards: Flashcard[];
    multipleChoice?: Question[];
    fillInTheBlank?: Question[];
  }
  
  // Function to repeat questions and flashcards across lessons
  function repeatItems<T>(items: T[], repetitions: number): T[] {
    const repeatedItems: T[] = [];
    for (let i = 0; i < repetitions; i++) {
      repeatedItems.push(...items);
    }
    return repeatedItems;
  }
  
  export function generateLessons(
    flashcards: Flashcard[],
    multipleChoice: Question[],
    fillInTheBlanks: Question[]
  ): { [key: string]: Lesson } {
    const lessons: { [key: string]: Lesson } = {};
    let lessonCount = 1;
  
    const totalFlashcards = flashcards.length;
    const totalMultipleChoice = multipleChoice.length;
    const totalFillInBlank = fillInTheBlanks.length;
  
    // ✅ Ensure each item appears **3-4 times** across lessons
    const repeatedFlashcards = repeatItems(flashcards, 5);
    const repeatedMultipleChoice = repeatItems(multipleChoice, 3);
    const repeatedFillInBlank = repeatItems(fillInTheBlanks, 3);
  
    let flashcardIndex = 0, multipleChoiceIndex = 0, fillInBlankIndex = 0;
    let strongReviewLessons = 1;
  
    // 🟢 **Determine number of Strong Review Lessons**
    if (totalFlashcards > 12 && totalFlashcards <= 20) {
      strongReviewLessons = 2;
    } else if (totalFlashcards > 20 && totalFlashcards <= 30) {
      strongReviewLessons = 3;
    } else if (totalFlashcards > 30 && totalFlashcards <= 50) {
      strongReviewLessons = 4;
    } else if (totalFlashcards > 50) {
      strongReviewLessons = 5;
    }
  
    // 🔹 **Strong Review Phase: Flashcards + Match the Term**
    const flashcardsPerLesson = Math.ceil(totalFlashcards / strongReviewLessons);
    for (let i = 0; i < strongReviewLessons; i++) {
      const start = flashcardIndex;
      const end = Math.min(start + flashcardsPerLesson, totalFlashcards);
  
      lessons[`lesson${lessonCount}`] = {
        flashcards: repeatedFlashcards.slice(start, end), // Repeated flashcards
      };
  
      flashcardIndex = end;
      lessonCount++;
    }
  
    // 🟡 **Balanced Section: Mix of Problems + Flashcards**
    while (multipleChoiceIndex < repeatedMultipleChoice.length || fillInBlankIndex < repeatedFillInBlank.length) {
      const flashcardsToInclude = totalFlashcards < 28 ? 4 : Math.min(repeatedFlashcards.length - flashcardIndex, 8);
      lessons[`lesson${lessonCount}`] = {
        flashcards: repeatedFlashcards.slice(flashcardIndex, flashcardIndex + flashcardsToInclude), 
        multipleChoice: repeatedMultipleChoice.slice(multipleChoiceIndex, multipleChoiceIndex + 4),
        fillInTheBlank: repeatedFillInBlank.slice(fillInBlankIndex, fillInBlankIndex + 4),
      };
      flashcardIndex += flashcardsToInclude;
      multipleChoiceIndex += 4;
      fillInBlankIndex += 4;
      lessonCount++;
    }
  
    // 🔴 **Challenge Section: More Problems, Flashcards for Match the Term**
    while (multipleChoiceIndex < repeatedMultipleChoice.length || fillInBlankIndex < repeatedFillInBlank.length) {
      const flashcardsToInclude = totalFlashcards < 28 ? 4 : Math.min(repeatedFlashcards.length - flashcardIndex, 8);
      lessons[`lesson${lessonCount}`] = {
        flashcards: repeatedFlashcards.slice(flashcardIndex, flashcardIndex + flashcardsToInclude),
        multipleChoice: repeatedMultipleChoice.slice(multipleChoiceIndex, multipleChoiceIndex + 5),
        fillInTheBlank: repeatedFillInBlank.slice(fillInBlankIndex, fillInBlankIndex + 5),
      };
      flashcardIndex += flashcardsToInclude;
      multipleChoiceIndex += 5;
      fillInBlankIndex += 5;
      lessonCount++;
    }
  
    return lessons;
  }
  