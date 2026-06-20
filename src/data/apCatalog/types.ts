export interface APFlashcard {
  term: string;
  definition: string;
}

export interface APQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  lessonType: "multipleChoice" | "fillInTheBlank";
}

export interface APLesson {
  flashcards: APFlashcard[];
  multipleChoice: APQuestion[];
  fillInTheBlank: APQuestion[];
}

export interface APUnit {
  unitNumber: number;
  unitName: string;
  description: string;
  lessons: APLesson[];
}

export interface APExam {
  /** Must match a value in the courseSubjects enum in openAICourseContentService.ts */
  apSubject: string;
  units: APUnit[];
}
