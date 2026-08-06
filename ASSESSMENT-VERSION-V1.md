# Kalananti Placement Test — Assessment Version V1

Stable identifier: `placement-v1`

This document records the shipped V1 configuration. Durable product policy remains in `PRD-placement-test.md`. Do not publish full answer keys in this file.

## 1. Registration and routing

- Registration is centralized in `index.html` and writes top-level `assessmentVersion: "placement-v1"`.
- Age 5–6 routes to Junior.
- Age 7 always shows a reading-readiness pop-up before the preparation screen.
  - “Sudah bisa membaca” routes to Kids.
  - “Belum bisa membaca” routes to Junior.
- The age-7 answer is stored as `student.canReadIndependently`; `student.routingReason` stores the deterministic routing reason.
- Age 8–15 routes to the Kids application. Exact age controls policy inside that application.
- Age 16–18 routes to Teens.
- Direct access without a valid registration returns to `index.html`, except explicit local QA modes.

## 2. Stage 1 inventory and selection

- Stage 1A covers Logic, Creativity, Spatial, and Digital Literacy with five scored items per pillar.
- V1 permits A–D multiple-choice for every audience. Visual and practical interaction is still used where interaction itself is evidence.
- Junior and Kids Stage 1B use ten items from two selected readiness pillars unless an explicit exceptional route in the PRD applies.
- Teens Stage 1B is fixed at five Logic plus five Spatial questions. Digital Literacy remains Stage 1A evidence.
- Question evidence stores question ID, stage, pillar, focus, difficulty, submitted value, correctness, timestamp, and technical-error status where available.

## 3. V1 Stage 2 environments

- Junior uses the Junior Scratch Jr scaffold.
- All Kids learners use the Scratch Stage 2 environment in V1.
- All Teens learners use the Python Stage 2 environment in V1.
- The Teens Python editor uses deterministic source-pattern validation in V1; execution in a real Python runtime is future development.
- A recommendation changed to another module after Stage 2 always starts that new module at Level 1. The report must identify the module actually assessed in Stage 2.

## 4. Timers, skip, and attempts

- Stage 1A, Stage 1B, and Stage 2 use the same per-question clock.
- Skip is hidden/disabled for the first 60 seconds.
- At 60 seconds the student may confirm “Lewati Soal”.
- At 120 seconds the system auto-skips.
- Stage 1 skip/timeout records an incorrect answer with score 0 and advances.
- Stage 2 skip/timeout records a failed challenge and moves down the adaptive staircase.
- Practical Stage 2 questions allow at most two scored submissions. Technical failures are recorded separately and do not consume a scored attempt.
- Timer state is keyed by stage and question/challenge and resumes from the saved deadline after refresh.

## 5. Module and Roblox-interest rules

- Junior remains Scratch Jr and Kids Lower remains Scratch.
- The final Stage 3 module-choice question is the only source of explicit Interest Confirmation.
- For eligible ages 10–15 choosing Roblox Studio, the V1 override requires Stage 1A Logic ≥3/5 and Spatial ≥3/5.
- When the threshold passes, the final recommendation is Roblox Studio Level 1 because V1 Kids Stage 2 assessed Scratch.
- When it does not pass, the age/readiness-safe module remains primary and the Learning Path still points toward Roblox Studio. Parent-facing copy explains whether Logic, Spatial, or both need strengthening.
- Digital Literacy 0–2 creates support evidence and does not independently block Roblox.
- For ages 16–18, Python remains the fixed V1 Assigned Module. Roblox Studio may appear as Potential Module or project context, but Stage 3 does not replace Python.
- Parent-facing wording uses “langkah awal” and “tujuan berikutnya”, not “locked module”.

## 6. Lv3 candidacy

`lv3Candidate` is true only when all of the following are true:

1. Stage 1A is perfect;
2. Stage 1B is perfect;
3. the Stage 2 upward path reaches the highest difficulty;
4. the highest-difficulty confirmation passes;
5. every scored Stage 2 submission succeeds on the first attempt.

The automatic result remains Level 2. Only Academic Team review may set `lv3_approved` and display EMERGING — Lv3.

## 7. Portfolio review in V1

- V1 has no placement-test web upload form.
- A candidate result email asks the parent to reply to the Academic Team reply-to address.
- Source code or an editable project file is mandatory.
- Accepted guidance:
  - Scratch: `.sb3` or shared project link;
  - Roblox Studio: `.rbxl`/`.rbxlx`, project link, and `.lua` source;
  - Python: `.py` or repository plus README.
- Screenshots and videos are supporting evidence only.

## 8. Persistence and synchronization

- Every answer, scored submission, stage/question index, timer deadline, and relevant interaction state is saved locally before navigation.
- Local state is scoped by `submissionId`.
- Refresh or temporary Wi-Fi loss resumes the exact active stage and question.
- Failed backend operations remain in the local sync queue and retry idempotently.
- In-progress checkpoints use `save_stage` with status `in_progress`; completed stages use status `completed`.
- Finalization never deletes a local result while queued operations remain.

## 9. Review and email lifecycle

Review lifecycle values (`placement_review_status`):

- `submitted`
- `under_review`
- `approved`
- `needs_manual_review`
- `lv3_candidate`
- `lv3_approved`
- `lv3_not_approved`

Delivery lifecycle values (`email_status`):

- `not sent`
- `waiting_branch_recipient`
- `sent`
- `failed`

Email rules:

- Parent email is the `To` recipient.
- Every valid BM/SA email in `DROPDOWNS` columns B/C on the exact branch row is BCC'd.
- The exact `Online` row is used for Online registrations.
- If B and C contain no valid recipient, the result and PDF remain stored and sending is held as `waiting_branch_recipient`.
- Dashboard-access approval never sends a result automatically.
- An authorized BM/SA reviews the stored result and explicitly uses “Approve & Send”.
- “Approve & Send” is idempotent: retrying after a refresh or lost response does not resend an email whose delivery status is already `sent`.
- Replies go to the configured Academic Team reply-to address; BCC recipients are not relied on for reply routing.

## 10. Known V1 limitations

- Kids Stage 2 is Scratch-only.
- Teens Stage 2 is Python-only.
- Python validation does not execute Python code.
- Multiple-choice A–D remains in use.
- Roblox and Python browser environments are not full recreations of the production tools.
- Calibration and richer module-specific Stage 2 routing are future development.
