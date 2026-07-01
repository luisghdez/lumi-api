import { APExam } from "./types";

/** All AP catalog exams to be seeded into Firestore.
 *  Hand-crafted TS entries here take precedence over generated JSON in /generated.
 *  AP Biology is fully generated, so it is intentionally excluded here. */
export const AP_EXAMS: APExam[] = [];

export * from "./types";
