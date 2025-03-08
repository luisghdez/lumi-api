// 1. Import or load your planet data (JSON) however you prefer
// For example:
import planetThemes from '../data/planet_themes.json';

// 2. Helper to shuffle an array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 3. Create a queue of planet names to ensure no duplicates
const shuffledPlanets = shuffleArray(planetThemes.planets);

// 4. Function to get a random description template
function getRandomDescription(category: string): string {
  const templates = (planetThemes.descriptions as any)[category] || [];
  const randomIndex = Math.floor(Math.random() * templates.length);
  return templates[randomIndex];
}

// 5. Function to build the final planet description with placeholders
function buildPlanetDescription(
  category: string,
  planetName: string,
  terms: string[]
): string {
  // Get a random template from the chosen category
  let template = getRandomDescription(category);

  // Fill in placeholders: {planet}, {term1}, {term2}, {term3}
  template = template.replace('{planet}', planetName);
  template = template.replace('{term1}', terms[0] || 'Term1');
  template = template.replace('{term2}', terms[1] || 'Term2');
  template = template.replace('{term3}', terms[2] || 'Term3');

  return template;
}

// 6. Update your generateLessons function
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
  lessonNumber?: number;
  flashcards: Flashcard[];
  multipleChoice?: Question[];
  fillInTheBlank?: Question[];
  planetName?: string;
  planetDescription?: string;
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

  // ✅ Ensure each item appears 3-4 times across lessons
  const repeatedFlashcards = repeatItems(flashcards, 5);
  const repeatedMultipleChoice = repeatItems(multipleChoice, 3);
  const repeatedFillInBlank = repeatItems(fillInTheBlanks, 3);

  let flashcardIndex = 0,
    multipleChoiceIndex = 0,
    fillInBlankIndex = 0;

  // Determine number of Strong Review Lessons
  let strongReviewLessons = 1;
  if (totalFlashcards > 12 && totalFlashcards <= 20) {
    strongReviewLessons = 2;
  } else if (totalFlashcards > 20 && totalFlashcards <= 30) {
    strongReviewLessons = 3;
  } else if (totalFlashcards > 30 && totalFlashcards <= 50) {
    strongReviewLessons = 4;
  } else if (totalFlashcards > 50) {
    strongReviewLessons = 5;
  }

  // 🔹 Strong Review Phase: Flashcards + Match the Term
  const flashcardsPerLesson = Math.ceil(totalFlashcards / strongReviewLessons);

  for (let i = 0; i < strongReviewLessons; i++) {
    const start = flashcardIndex;
    const end = Math.min(start + flashcardsPerLesson, totalFlashcards);

    // Grab planet name & build description
    const planetName = shuffledPlanets.pop() || 'Unknown';
    const currentFlashcards = repeatedFlashcards.slice(start, end);
    const topThreeTerms = currentFlashcards.slice(0, 3).map(fc => fc.term);
    const planetDescription = buildPlanetDescription(
      'StrongReview',
      planetName,
      topThreeTerms
    );

    lessons[`lesson${lessonCount}`] = {
      lessonNumber: lessonCount,
      flashcards: currentFlashcards,
      planetName,
      planetDescription
    };

    flashcardIndex = end;
    lessonCount++;
  }

  // 🟡 Balanced Section: Mix of Problems + Flashcards
  while (
    multipleChoiceIndex < repeatedMultipleChoice.length ||
    fillInBlankIndex < repeatedFillInBlank.length
  ) {
    const flashcardsToInclude =
      totalFlashcards < 28
        ? 4
        : Math.min(repeatedFlashcards.length - flashcardIndex, 8);

    const currentFlashcards = repeatedFlashcards.slice(
      flashcardIndex,
      flashcardIndex + flashcardsToInclude
    );
    const topThreeTerms = currentFlashcards.slice(0, 3).map(fc => fc.term);

    // Grab planet name & build description
    const planetName = shuffledPlanets.pop() || 'Unknown';
    const planetDescription = buildPlanetDescription(
      'Balanced',
      planetName,
      topThreeTerms
    );

    lessons[`lesson${lessonCount}`] = {
      lessonNumber: lessonCount,
      flashcards: currentFlashcards,
      multipleChoice: repeatedMultipleChoice.slice(
        multipleChoiceIndex,
        multipleChoiceIndex + 4
      ),
      fillInTheBlank: repeatedFillInBlank.slice(
        fillInBlankIndex,
        fillInBlankIndex + 4
      ),
      planetName,
      planetDescription
    };

    flashcardIndex += flashcardsToInclude;
    multipleChoiceIndex += 4;
    fillInBlankIndex += 4;
        lessonCount++;
      }

    // // 🔴 **Challenge Section: More Problems, Flashcards for Match the Term**
    // while (multipleChoiceIndex < repeatedMultipleChoice.length || fillInBlankIndex < repeatedFillInBlank.length) {
    //     const flashcardsToInclude = totalFlashcards < 28 ? 4 : Math.min(repeatedFlashcards.length - flashcardIndex, 8);
    //     lessons[`lesson${lessonCount}`] = {
    //       lessonNumber: lessonCount,
    //       flashcards: repeatedFlashcards.slice(flashcardIndex, flashcardIndex + flashcardsToInclude),
    //       multipleChoice: repeatedMultipleChoice.slice(multipleChoiceIndex, multipleChoiceIndex + 5),
    //       fillInTheBlank: repeatedFillInBlank.slice(fillInBlankIndex, fillInBlankIndex + 5),
    //     };
    //     flashcardIndex += flashcardsToInclude;
    //     multipleChoiceIndex += 5;
    //     fillInBlankIndex += 5;
    //     lessonCount++;
    //   }
    
      return lessons;
    }
