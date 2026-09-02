import assert from "assert";
import { isTalkRealtimeEnabledForLesson } from "../services/talkConfig";

assert.equal(isTalkRealtimeEnabledForLesson("lesson1", {}), false);
assert.equal(
  isTalkRealtimeEnabledForLesson("lesson1", {
    TALK_TO_LUMI_REALTIME_ENABLED: "true",
  }),
  false,
);
assert.equal(
  isTalkRealtimeEnabledForLesson("lesson1", {
    TALK_TO_LUMI_REALTIME_ENABLED: "true",
    TALK_TO_LUMI_REALTIME_LESSON_IDS: "lesson2, lesson1",
  }),
  true,
);
assert.equal(
  isTalkRealtimeEnabledForLesson("lesson3", {
    TALK_TO_LUMI_REALTIME_ENABLED: "true",
    TALK_TO_LUMI_REALTIME_LESSON_IDS: "lesson2, lesson1",
  }),
  false,
);
assert.equal(
  isTalkRealtimeEnabledForLesson("lesson3", {
    TALK_TO_LUMI_REALTIME_ENABLED: "true",
    TALK_TO_LUMI_REALTIME_LESSON_IDS: "*",
  }),
  true,
);

console.log("Talk feature-gate checks passed.");
