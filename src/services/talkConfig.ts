export type TalkEnvironment = Record<string, string | undefined>;

/**
 * Both gates must be explicit. A true global flag with an empty allow-list is
 * deliberately disabled; `*` is only useful for internal development.
 */
export function isTalkRealtimeEnabledForLesson(
  lessonId: string,
  environment: TalkEnvironment = process.env,
): boolean {
  if (environment.TALK_TO_LUMI_REALTIME_ENABLED !== "true") return false;
  const lessonIds = new Set(
    (environment.TALK_TO_LUMI_REALTIME_LESSON_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  return lessonIds.has("*") || lessonIds.has(lessonId);
}
