export const COURSE_GENERATION_LIMITS = {
  maxFiles: 3,
  maxCombinedUploadBytes: 15 * 1024 * 1024,
  maxFileBytes: 10 * 1024 * 1024,
  maxPlainTextBytes: 1 * 1024 * 1024,
  maxExtractedCharacters: 1_000_000,
  maxExtractedChunks: 1_000,
} as const;

export class CourseGenerationLimitError extends Error {
  readonly statusCode = 413;
  readonly code = "COURSE_GENERATION_LIMIT_EXCEEDED";

  constructor(message: string) {
    super(message);
    this.name = "CourseGenerationLimitError";
  }
}
