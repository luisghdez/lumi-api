import assert from "assert/strict";
import { advanceTalkLesson, talkLessonReply, TalkLessonProgress } from "../services/talkLessonProgress";

const initial: TalkLessonProgress = {
  revision: 0, currentTermIndex: 0, complete: false,
  topics: ['Cells', 'Nucleus', 'Ribosomes'].map((term, i) => ({ term, definition: term, score: 0, attempts: 0, status: i === 0 ? 'active' : 'pending' })),
};
let progress = advanceTalkLesson(initial, { kind: 'question', score: 100, feedback: 'Here is a hint.' });
assert.equal(progress.topics[0].score, 0);
assert.equal(progress.topics[0].attempts, 0);
assert.equal(progress.currentTermIndex, 0);
progress = advanceTalkLesson(progress, { kind: 'answer', score: 70, feedback: 'Good start.' });
progress = advanceTalkLesson(progress, { kind: 'answer', score: 20, feedback: 'Try again.' });
assert.equal(progress.topics[0].score, 70, 'saved mastery must never decrease');
const beforeThird = progress;
progress = advanceTalkLesson(progress, { kind: 'answer', score: 80, feedback: 'Remember the missing detail.' });
assert.equal(progress.currentTermIndex, 1);
assert.equal(progress.topics[0].status, 'review_later');
assert.equal(progress.topics[1].status, 'active');
assert.match(talkLessonReply(beforeThird, progress, { kind: 'answer', score: 80, feedback: 'Keep practicing.' }), /Next, explain Nucleus/);
progress = advanceTalkLesson(progress, { kind: 'answer', score: 100, feedback: 'Correct.' });
progress = advanceTalkLesson(progress, { kind: 'unclear', score: 100, feedback: 'Repeat that.' });
assert.equal(progress.currentTermIndex, 2);
assert.equal(progress.topics[2].attempts, 0);
const beforeLast = progress;
progress = advanceTalkLesson(progress, { kind: 'answer', score: 100, feedback: 'Correct.' });
assert.equal(progress.complete, true);
assert.equal(progress.currentTermIndex, 3);
assert.equal(progress.topics.filter(t => t.status === 'mastered').length, 2);
assert.match(talkLessonReply(beforeLast, progress, { kind: 'answer', score: 100, feedback: 'Correct.' }), /all three topics/);
assert.equal(initial.topics[0].score, 0, 'a transaction retry must not mutate its input');
assert.throws(() => advanceTalkLesson(progress, { kind: 'answer', score: 100, feedback: 'Again.' }), /already complete/);
console.log('Continuous Talk progression checks passed.');
