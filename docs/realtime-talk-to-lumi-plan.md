# Talk to Lumi: delivery plan

## Decision

Ship a feature-flagged WebRTC voice experience for one lesson first. Use
`gpt-realtime-2.1-mini` for low-latency conversation, captions, interruption,
and spoken delivery. Keep Lumi API—not the realtime model—as the authority for
mastery, attempt count, and the next term.

Realtime's model page documents WebRTC and function calling, but not structured
outputs. Each completed learner turn must therefore be assessed by the API with
one schema-validated text-model call, using canonical course data.

- https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini
- https://developers.openai.com/api/reference/typescript/resources/realtime/subresources/calls/methods/create

The existing Speak path remains a fallback until we have measured quality,
latency, reliability, and cost.

## Audit findings

| Area | Current behavior | Problem |
| --- | --- | --- |
| Recognition | iOS `speech_to_text` owns recognition. | It can fail permanently without transcript: the reported “Lumi can't hear me” path. |
| UI state | Starting/listening/stopping/submitting/error are now separate. | The four-second start guard should become a soft “still connecting” state, not a hard permission error. |
| Assessment | The client sends scores, terms, attempt count, and history; API makes serial grade then feedback calls. | Client controls mastery inputs and two model waits add latency. |
| Feedback | Client waits two seconds and polls for TTS before setting returned text. | Optional audio delays essential written feedback. |
| Audio | Session ID retrieval has no owner binding or unclaimed-object expiry. | Cross-user access and retention risk. |
| Progress | Review progress is client-held; Firestore only records lesson completion. | Retries/restarts can produce stale or duplicate learning state. |

## Target interaction

Offer **Talk it through** and **Type an answer**. In Talk mode, learners see
live captions, can interrupt Lumi, can edit a final transcript, and always get
written feedback even if audio playback fails.

```text
idle → permission → connecting → listening ↔ learner speaking
     → assessing → Lumi speaking → listening
                              └── interrupted → listening

any state → text fallback | microphone unavailable | retryable network error
```

- Show “Connecting microphone…” on tap. At about 1.5 seconds show “Still
  connecting” and Cancel; do not call a late native callback a permission failure.
- OS-declared denied/restricted permission: **Microphone unavailable** + Open
  Settings. A completed turn with no transcript: **I didn't hear that** +
  retry/type; remain ready.
- Keep spoken replies brief, interruptible, and mirrored as text. Speaker/TTS
  failure must never block feedback or progress.

## Architecture

```text
iOS app ──Firebase token──> Lumi API
  │                          │ validates ownership, lesson, flag, quota
  │ <──short-lived config────┤ creates an owned attempt
  │                          │
  ├── WebRTC media/data ───> OpenAI Realtime
  │    captions, VAD, barge-in, tutoring speech
  │
  └── final/editable transcript ──> Lumi API assessment
                                      │ canonical rubric + one model call
                                      └── Firestore transaction
```

The app never receives the long-lived OpenAI key. The API creates the documented
WebRTC call server-side, or returns a scoped short-lived client secret after the
installed SDK's supported credential flow is verified.

## Contracts and persistence

`POST /talk/sessions` receives `{ courseId, lessonId, clientAttemptId }` with a
Firebase token. The API verifies the flag and entitlement, derives the current
term from server data, enforces quota, and creates an owned expiring attempt.
It returns an `attemptId` plus only ephemeral realtime connection material and
safe session instructions.

`POST /talk/attempts/:attemptId/assess` receives `{ transcript, turnId,
durationMs }`. The API verifies owner, expiry, idempotency, and term state. It
then reads canonical course data, validates one assessment response with Zod,
and commits it transactionally. Repeating the same `turnId` returns the stored
result without scoring twice.

```ts
type Assessment = {
  attemptId: string;
  termId: string;
  mastery: "not_yet" | "developing" | "mastered";
  score: number;
  evidence: string[];
  feedbackText: string;
  nextAction: "retry" | "next_term" | "review_later" | "complete";
  nextTermId?: string;
};
```

Add server-owned records:

- `users/{uid}/talkState/{courseId_lessonId}`: current term, attempt count, and
  progress.
- `users/{uid}/talkAttempts/{attemptId}`: owner, lifecycle, transcript,
  idempotency key, assessment, timestamps, and expiry.

Do not store raw audio by default. Retain only transcript and privacy-safe
operational metrics under a defined TTL. Existing review audio must gain an
`ownerUid` check and a scheduled cleanup for objects never retrieved.

## Model responsibilities

| Work | Candidate | Constraint |
| --- | --- | --- |
| Voice/captions/interruptions | `gpt-realtime-2.1-mini` | Teach conversationally; never declare persisted mastery. |
| Authoritative assessment | Benchmark `gpt-5.6-luna` with no reasoning, one structured call | Validate schema; canonical rubric and term only. |
| Legacy voice fallback | `gpt-4o-mini-tts` | Optional; written feedback comes first. |

The actual assessment model is an evaluation decision. Current `gpt-4.1-nano`
is deprecated, so it is not the long-term default. Recheck official OpenAI
documentation and current pricing immediately before production configuration.

## Execution order

### Phase 0 — make the current path safe and measurable

1. Show `/review` text immediately; audio polling runs independently.
2. Replace serial grade/feedback calls with one validated assessment response.
3. Move attempt/progress state server-side; add idempotency.
4. Bind review audio to the authenticated owner and add TTL cleanup.
5. Emit privacy-safe timings and failure classes: permission, connection,
   empty-turn, API, assessment, TTS, and playback.

### Phase 1 — prove quality before realtime rollout

Create a versioned set of at least 60 human-labelled explanations across 10–15
terms: correct paraphrases, partial answers, misconceptions, unrelated answers,
very short answers, hesitant/noisy transcript variants, and ELL phrasing. Run
each assessment configuration against it and report rubric agreement,
false-mastery, false-rejection, feedback specificity, p50/p95 latency, and
per-turn usage. No model advances without a reviewed report.

The initial harness lives in `src/scripts/evaluateReviewAssessments.ts` with 80
labelled cases. It requires explicit confirmation before it makes any paid model
calls:

```bash
npm run evaluate:review -- --models gpt-4.1-nano,gpt-5.6-luna --confirm-live-run
```

It writes a JSON trace and Markdown comparison to the ignored
`src/scripts/output/review-evaluations/` directory. The report checks score
ranges and feedback constraints automatically; a human reviews the saved
feedback for educational quality before selecting `REVIEW_ASSESSMENT_MODEL`.

### Phase 2 — one-lesson realtime prototype

1. Add owned session/assessment API endpoints and the remote feature flag.
2. Implement a Flutter WebRTC adapter behind `talkToLumiRealtime`.
3. Build captions, barge-in, transcript edit, state-specific recovery, and End
   Session.
4. Use the final transcript for the server assessment and display text first.
5. Fall back to legacy Speak or Type on connection/audio-route failure.

### Phase 3 — controlled release

Start internal-only, then a small percentage of one lesson. The flag needs a
kill switch by lesson and app version. Compare Talk against legacy before
expanding; review learner content only under explicit consent and policy.

## Provisional release gates

- 99% of permitted sessions reach listening or a clear fallback.
- Under 3% empty turns after connection succeeds.
- p95 learner-end to visible assessment under 2.5 seconds.
- p95 learner-end to first Lumi audio under 2 seconds, excluding intentional VAD
  silence.
- Authorization tests prove no cross-user attempt or audio retrieval.
- False-mastery rate is no worse than the present path.
- Per-turn cost is measured, quota-capped, and has spend alerts before rollout.

## Test matrix

| Case | Expected behavior |
| --- | --- |
| Mic denied before launch | Clear Settings path; no false listening state. |
| Mic revoked foreground | Safe stop and retry/type fallback. |
| Silence/noise | “Didn't hear that”, retry/type, no permission message. |
| Slow handshake | Cancel/retry then fallback; no stuck spinner. |
| Learner interruption | Lumi audio stops; learner speaks immediately. |
| Double submit | One idempotent assessment and score. |
| TTS/backend failure | Text remains visible and progress stays correct. |
| Exchanged IDs between users | No audio or attempt disclosure. |
| Background/return | Session is intentionally closed or reconnected. |

## Production prerequisites

- Confirm OpenAI project access, usage tier, spend alerts, and chosen realtime
  model availability.
- Verify the session-credential flow against the installed OpenAI SDK.
- Decide VAD/voice defaults, transcript TTL, and cost cap from baseline data.
- Provision the Firebase/Cloud Scheduler-equivalent cleanup job.
