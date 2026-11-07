/** Opt-in HTTP integration test. Uses only a temporary QA account; cleans it up. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { admin, auth, db } from "../config/firebaseConfig";

async function main() {
  const base = process.env.LUMI_ACTIVATION_TEST_BASE_URL || "http://127.0.0.1:3000";
  const origin = new URL(base);
  if (!["localhost", "127.0.0.1"].includes(origin.hostname)) {
    throw new Error("Activation verification must target a local API.");
  }
  if (!process.env.FIRESTORE_EMULATOR_HOST && process.env.LUMI_ACTIVATION_TEST_ALLOW_REMOTE !== "1") {
    throw new Error("Set LUMI_ACTIVATION_TEST_ALLOW_REMOTE=1 to use a disposable QA account in the configured Firebase project.");
  }
  const uid = `qa-activation-${randomUUID()}`;
  const userRef = db.collection("users").doc(uid);
  let courseId: string | undefined;
  let token = "";
  async function request(method: string, path: string, body?: unknown, expected = 200) {
    const response = await fetch(`${base}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, expected, `${method} ${path}: unexpected status ${response.status}`);
    return response.json() as Promise<any>;
  }
  async function completionEvents() {
    const events = await db.collection("analyticsEvents").where("userId", "==", uid).get();
    return events.docs.filter(d => d.get("type") === "lesson_completed");
  }
  try {
    // No real learner account is used or modified.
    await auth.createUser({ uid });
    const customToken = await auth.createCustomToken(uid);
    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    assert.ok(apiKey, "FIREBASE_WEB_API_KEY is required (Firebase public client configuration)");
    const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    });
    assert.equal(authResponse.status, 200, "QA sign-in failed");
    token = (await authResponse.json() as any).idToken;
    await userRef.set({ name: "Activation QA", xpCount: 0, streakCount: 0, timezone: "UTC", hasCompletedOnboarding: false });

    const catalog = await request("GET", "/courses/ap-catalog");
    assert.ok(catalog.courses.length > 0, "AP catalog must have courses");
    courseId = catalog.courses[0].id;
    assert.ok(courseId);
    await request("POST", "/saved-courses", { courseId }, 201);
    await request("POST", "/saved-courses", { courseId }, 201);
    const events = await db.collection("analyticsEvents").where("userId", "==", uid).get();
    assert.equal(events.docs.filter(d => d.get("type") === "course_saved").length, 1, "Save retries must emit one event");

    const content = await request("GET", `/courses/${courseId}/lessons`);
    assert.ok(content.lessons.length >= 2);
    // Complete a lesson other than lesson1 first to verify learner-level activation.
    const first = content.lessons[1].id;
    const second = content.lessons[0].id;
    await request("PATCH", "/users/me", { hasCompletedOnboarding: true, onboardingCourseIds: [courseId] });
    assert.equal((await userRef.get()).get("hasCompletedOnboarding"), true);
    const attempt = randomUUID();
    const payload = { xp: 15, lessonAttemptId: attempt, durationMs: 12000 };
    const result = await request("PATCH", `/saved-courses/${courseId}/lessons/${first}/complete`, payload);
    assert.equal(result.xpAwarded, 15);
    const retry = await request("PATCH", `/saved-courses/${courseId}/lessons/${first}/complete`, payload);
    assert.equal(retry.xpAwarded, 0);
    assert.equal(retry.wasPreviouslyCompleted, true);
    const concurrentRetries = await Promise.all([
      request("PATCH", `/saved-courses/${courseId}/lessons/${first}/complete`, payload),
      request("PATCH", `/saved-courses/${courseId}/lessons/${first}/complete`, payload),
    ]);
    assert.ok(concurrentRetries.every(result => result.xpAwarded === 0));
    let completions = await completionEvents();
    assert.equal(completions.length, 1);
    assert.equal(completions[0].get("isFirstLesson"), true);
    assert.equal(completions[0].get("lessonId"), first);
    assert.equal(completions[0].get("courseType"), "ap_catalog");
    assert.equal((await userRef.get()).get("xpCount"), 15);
    assert.equal((await userRef.get()).get("firstLessonId"), first);

    // Simulate a legacy learner whose progress predates the user-level marker.
    await userRef.update({ hasCompletedLesson: admin.firestore.FieldValue.delete(), firstLessonCompletedAt: admin.firestore.FieldValue.delete() });
    await request("PATCH", `/saved-courses/${courseId}/lessons/${second}/complete`, { ...payload, lessonAttemptId: randomUUID() });
    completions = await completionEvents();
    assert.equal(completions.filter(d => d.get("isFirstLesson") === true).length, 1);
    assert.equal((await userRef.get()).get("xpCount"), 30);
    await request("PATCH", `/saved-courses/${courseId}/lessons/missing-qa-lesson/complete`, payload, 500);
    assert.equal((await completionEvents()).length, 2);
    assert.equal((await userRef.get()).get("xpCount"), 30);
    console.log("PASS: authenticated AP discovery, save/retry, onboarding persistence, lesson loading, first completion, duplicate XP protection, legacy history, invalid completion.");
  } finally {
    // Atomically remove only this QA user's save and reverse its catalog counter.
    if (courseId) {
      const savedRef = userRef.collection("savedCourses").doc(courseId);
      const catalogRef = db.collection("courses").doc(courseId);
      await db.runTransaction(async tx => {
        if (!(await tx.get(savedRef)).exists) return;
        tx.delete(savedRef);
        tx.update(catalogRef, { savedCount: admin.firestore.FieldValue.increment(-1) });
      });
    }
    const events = await db.collection("analyticsEvents").where("userId", "==", uid).get();
    for (const event of events.docs) await event.ref.delete();
    await userRef.delete();
    await auth.deleteUser(uid).catch(error => {
      if (error.code !== "auth/user-not-found") throw error;
    });
    console.log("QA account, saved course, and analytics events cleaned up.");
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
