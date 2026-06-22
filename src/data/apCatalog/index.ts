import { APExam } from "./types";
import apBiology from "./ap-biology";

/** All AP catalog exams to be seeded into Firestore. Add new exam files here. */
export const AP_EXAMS: APExam[] = [apBiology];

export * from "./types";
