# Product Requirements Document (PRD)

file smenetar:
/Users/yazidhilmi/Documents/cloud/Kalananti-cloud/Academic_Content/B2C/placement-test/junior-final-placement-test.html
/Users/yazidhilmi/Documents/cloud/Kalananti-cloud/Academic_Content/B2C/placement-test/teens.html
/Users/yazidhilmi/Documents/cloud/Kalananti-cloud/Academic_Content/B2C/placement-test/kids-final-placement-test.html

## Kalananti Placement Test

**Status:** Draft for implementation
**Product:** Kalananti Placement Test
**Platform:** Web application
**Primary users:** Prospective Kalananti students aged 5–18, parents, and academic administrators
**Document purpose:** Define the assessment flow, module recommendation rules, adaptive level placement, technical direction, data flow, and acceptance criteria.

---

## 1. Product Summary

Kalananti Placement Test is an interactive, age-aware assessment used to recommend:

1. the module a student is ready to study now;
2. the student's longer-term module potential;
3. whether the student should begin at FOUNDATIONAL — Lv1 or BASIC — Lv2 inside the assigned module;
4. the student's named, goal-based Learning Path derived from Stage 3 interest, shown as an ordered module journey without level or placement-status labels inside the chart;
5. whether an exceptional student qualifies for separate EMERGING — Lv3 Academic Team review.

The assessment must not rely only on conventional multiple-choice questions. Question format, terminology, and interaction difficulty must match the student's age and digital readiness.

The product evaluates four core pillars:

- **Logic:** algorithmic thinking, sequencing, conditions, loops, debugging, and problem solving;
- **Creativity:** visual prediction, animation, layering, layout, and visual communication;
- **Spatial:** direction, coordinates, rotation, scale, grouping, perspective, and 3D reasoning;
- **Digital Literacy:** input-device usage, interface conventions, navigation, files, troubleshooting, and operational readiness.

Logic and Digital Literacy normally act as readiness validators. A student should not be assigned to an advanced tool only because one specialist pillar is high, except for the explicit Teens alternate-path rule: Spatial must be perfect and independently confirmed across both Stage 1A and Stage 1B before Roblox Studio can replace the age-default Python assignment.

---

## 2. Goals

### 2.1 Primary goals

- Recommend an age-appropriate module based on demonstrated ability.
- Distinguish between the student's **Potential Module** and **Assigned Module**.
- Determine a starting level through practical, module-specific challenges.
- Restrict automatic placement to FOUNDATIONAL — Lv1 and BASIC — Lv2.
- Give every student a named Stage 3 Learning Path that turns the student's preferred project outcome into a clear multi-module journey.
- Keep placement evidence and the aspirational Learning Path distinct: Assigned Module and level remain in the placement result, while the path chart contains only its name and ordered modules.
- Explain every locked module using age, Digital Literacy, Logic/readiness, and missing-pillar evidence.
- Route exceptional Lv3 candidates to a separate portfolio and Academic Team review without hiding the regular Stage 3 result from other students.
- Give administrators enough evidence to approve or manually adjust the recommendation.
- Produce a clear result that can later be sent to the parent.

### 2.2 Success indicators

- Students can complete the assessment on desktop, tablet, and supported mobile devices.
- Junior students can complete Stage 1 without requiring strong drag-and-drop skills.
- Kids and Teens demonstrate answers through interaction rather than conventional ABC selection.
- Stage 2 opens only the assessment belonging to the Assigned Module.
- Stage 2 never assigns EMERGING — Lv3 automatically.
- Every student enters Stage 3 after Stage 2.
- Stage 3 preserves the Stage 1 Assigned Module and Stage 2 level; it does not recalculate either value.
- Final Lv3 placement requires portfolio evidence and explicit Academic Team approval.
- Results can be reproduced from stored scores, attempts, and validation evidence.
- No development controls are visible in production.

---

## 3. Audience Segmentation

The application uses three official audience groups. The registration form may display four age ranges to preserve routing detail.

| Form range   | Audience group | User experience                                                           |
| ------------ | -------------- | ------------------------------------------------------------------------- |
| 5–7 years   | Junior         | Large visuals, audio support, short instructions, simple visual selection |
| 8–11 years  | Kids           | Interactive visual assessment; no conventional ABC questions              |
| 12–15 years | Kids           | Same interaction style as Kids, with more advanced content                |
| 16–18 years | Teens          | Technical language, debugging, code reasoning, and direct input           |

Age 7 belongs to Junior. Age 8 belongs to Kids.

---

## 4. Age-Based Module Policy

Stage 1 produces two module outputs:

- **Potential Module:** the highest long-term potential suggested by the student's cognitive profile;
- **Assigned Module:** the age-appropriate module the student should study now.

Only the Assigned Module controls Stage 2.

| Age    | Safe Bet (Fallback) | Target Pathway         | Skip/Advanced Pathway                                                                                                                                                          |
| ------ | ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5–7   | Scratch Jr          | Scratch Jr             | **Scratch** (if Stage 1A Logic, Creativity, DigLit are Perfect & Stage 1B is Perfect)                                                                                    |
| 8–11  | Scratch             | Scratch                | **Roblox Studio** (if Stage 1A+1B Logic, Spatial, DigLit, Creativity are Perfect)                                                                                        |
| 12–15 | Scratch             | Roblox Studio / Python | **Python** (if Logic 1A+1B is Perfect) / **Roblox Studio** (if DigLit & Spatial are High)                                                                          |
| 16–18 | Python              | Python                 | **Roblox Studio** only after perfect Spatial validation across Stage 1A and Stage 1B; high Creativity is supporting potential evidence, not a standalone assignment rule |

Important rules for Module Routing:

- **Junior (5–7):** Stage 1B normally shows 10 questions from the Top 2 ability pillars. If Logic, Creativity, and Digital Literacy in 1A are all perfect, Stage 1B expands to 15 questions across those three pillars. A perfect 15/15 assigns **Scratch**; any mistake preserves **Scratch Jr**.
- **Kids (8–11):** Stage 1B normally shows 10 questions from the Top 2 ability pillars. If all four Stage 1A pillars are perfect, Stage 1B expands to 20 questions. A perfect 20/20 is required for **Roblox Studio**; otherwise the assignment remains **Scratch**.
- **Kids Upper (12–15):** Stage 1B shows 10 Top-2 questions, with perfect Logic or Spatial locked into the selected set. Perfect Logic validation may assign **Python**. High/perfect Spatial plus strong Digital Literacy may assign **Roblox Studio**, especially when Logic is average. Low Logic and Digital Literacy preserves **Scratch**, even when Spatial is high.
- **Teens (16–18):** Python is the age-default Assigned Module. Stage 1B always contains five Logic questions to retain Python-readiness evidence plus five questions from the stronger of Spatial or Creativity. Spatial replaces the second slot when Stage 1A Spatial is perfect. Perfect Spatial validation across both stages assigns **Roblox Studio**; high Creativity alone may support Roblox Studio as Potential Module but never changes the assignment. Low Logic or Spatial does not remove Python; it produces support evidence for Stage 2 and the final report.

```

---

## 5. End-to-End User Flow

```text
Central Registration Landing Page (index.html)
    ├── Input Name, Age Range, Parent Email, Branch
    └── Dynamic Age Routing:
            ├── 5–7 years  → junior-final-placement-test.html
            ├── 8–15 years → kids-final-placement-test.html
            └── 16–18 years → teens.html
    ↓
Stage 1A — Foundation Assessment (Direct start in assigned file)
    ↓
Stage 1B — Module Readiness Validator
    ↓
Potential Module + Assigned Module
    ↓
Stage 2 — Adaptive Practical Assessment for Assigned Module
    ↓
FOUNDATIONAL — Lv1 or BASIC — Lv2 result
    ↓
Stage 3 — Universal Learning Track Result
    ├── Potential Module
    ├── Goal-based path name from Stage 3 interest
    ├── Ordered path modules
    ├── Current Assigned Module + Stage 2 Level
    └── Locked-module reasons
            ↓
Exceptional Lv3 candidate?
    ├── No → regular academic review
    └── Yes → optional Portfolio + Academic Team Lv3 review
    ↓
Submit result to Google Sheets through Apps Script
    ↓
Academic review and approval
    ↓
Email parent, with BCC to administrator
```

Stage 3 is mandatory for every audience and age group. Portfolio submission and Lv3 approval are optional exceptional-review branches shown only when the eligibility rules are satisfied.

---

## 6. Stage 0 — Registration Architecture & Routing

### 6.1 Central Router (`index.html`)

All assessment registration is centralized in `index.html`. Individual assessment files (`junior-final-placement-test.html`, `kids-final-placement-test.html`, and `teens.html`) do not render standalone registration forms.

Required registration inputs in `index.html`:

- Student nickname or name;
- detailed age range (`5–7 years`, `8–11 years`, `12–15 years`, `16–18 years`);
- parent's email;
- branch;
- submission identifier;
- assessment version.

### 6.2 Data Handoff & Storage Contract

- Upon form submission in `index.html`, registration data is saved to browser storage:
  - `localStorage.setItem('pt_student_registration', JSON.stringify(profileData))`
  - `localStorage.setItem('pt_student_profile', JSON.stringify(profileData))`
- `index.html` redirects to the target assessment file according to age policy:
  - Age 5–7 → `junior-final-placement-test.html`
  - Age 8–15 → `kids-final-placement-test.html`
  - Age 16–18 → `teens.html`

### 6.3 Direct Access Auto-Redirection Guard

- If any assessment file (`junior-final-placement-test.html`, `kids-final-placement-test.html`, or `teens.html`) is accessed directly without prior registration (i.e. `pt_student_registration` is missing or invalid in `localStorage`), the file **must automatically redirect the browser back to `index.html`**.
- An optional bypass parameter (e.g. `?dev=1` or `?demo=1`) may be allowed for internal QA testing only.

### 6.4 Data handling and State Persistence

- Registration data remains in browser state during the assessment.
- **State Persistence (Auto-Save):** The application must continuously save the student's progress to `localStorage` using their unique `submission_id`. This includes:
  - The current stage (Stage 1, 2, or 3).
  - The current question number or challenge being attempted.
  - All submitted answers (both correct and incorrect).
- **Session Recovery:** If the browser is accidentally closed, refreshed, or opened in a new tab, the application must automatically reload the state based on the `submission_id` and resume the assessment exactly where the student left off.
- **Partial Backend Saving:** To prevent data loss, progress must also be partially synced to the backend (Google Sheets):
  - Every time a student completes a stage (e.g., finishing Stage 1 and entering Stage 2), OR
  - Every 5 completed questions.
- The final, complete payload is sent after the assessment is fully completed.
- Failed submission must not erase the student's completed result.
- Repeated submission must use an idempotent submission identifier to avoid duplicate Sheet rows.

---

## 7. Stage 1 — Module Placement

Stage 1 determines the student's Assigned Module and Potential Module. It does not determine the final course level.

### 7.1 Stage 1A — Foundation

All students are assessed across:

- Logic;
- Creativity;
- Spatial;
- Digital Literacy.

Each pillar should have an equivalent scoring range so no pillar wins merely because it contains more questions.

### 7.2 Question interaction policy

#### Junior, ages 5–7

Junior may use multiple-choice mechanics because the assessment must not assume mature digital operation.

Requirements:

- large visual options;
- maximum three or four choices;
- audio instruction support;
- minimal reading;
- no dependence on complex drag-and-drop;
- no requirement to understand letters A, B, or C;
- optional simple sequence or tap interaction when appropriate.

The underlying scoring may be multiple choice, but visible letter labels are not required.

#### Kids, ages 9–15

Kids must not receive conventional ABC questions.

Allowed interactions include:

- drag-and-drop;
- sequence builder;
- matching;
- route construction;
- visual layering;
- color or layout configuration;
- interactive simulation;
- selecting or manipulating objects inside a task.

#### Teens, ages 16–18

Teens must not receive conventional ABC questions.

Allowed interactions include:

- code tracing with direct output input;
- flow construction;
- debugging by rearranging or editing steps;
- command sequencing;
- state simulation;
- file or interface tasks;
- typed short answers;
- practical mini-editor interactions.

### 7.3 Stage 1B — Readiness validator

Stage 1B provides advanced evidence for the strongest abilities found in Stage 1A and validates exceptional module jumps. Stage 1B is always shown and is dynamic in both pillar composition and length, ranging from **10 to 20 questions**.

#### 7.3.1 Standard Top-2 mode

Unless an exceptional validator condition below is triggered, Stage 1B shows:

- the two highest-scoring ability pillars from Stage 1A;
- five advanced questions for each selected pillar;
- ten questions in total.

The standard Top-2 candidates are **Logic, Creativity, and Spatial**. Digital Literacy is not selected merely because it has a high score. Its Stage 1A result acts as the module-readiness gatekeeper.

Top-2 selection must be deterministic. Sort by Stage 1A score, then apply the age-specific priority below, and finally use the safer pathway as the tie-breaker. Object order must never determine the selected pillars.

| Audience / age     | Standard Stage 1B selection                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Junior, 5–7       | Top two of Logic, Creativity, and Spatial; 10 questions                                                                                                                                                     |
| Kids, 8–11        | Top two of Logic, Creativity, and Spatial; 10 questions                                                                                                                                                     |
| Kids Upper, 12–15 | Top two of Logic, Creativity, and Spatial; Logic must be included when Stage 1A Logic is 5/5, and Spatial must be included when Stage 1A Spatial is 5/5                                                     |
| Teens, 16–18      | Logic is always included for Python-readiness evidence. The second pillar is the higher of Spatial or Creativity; Spatial is locked into the second slot when Stage 1A Spatial is 5/5. Total: 10 questions. |

If both Logic and Spatial are perfect for ages 12–15, those two pillars occupy the two Stage 1B slots. If only one is perfect, that pillar is locked and the remaining slot is filled by the highest other ability pillar.

#### 7.3.2 Exceptional validator mode

The strict **Sempurna** rule applies when the student is attempting to jump beyond the safe age pathway:

| Target module                              | Exceptional trigger from Stage 1A                            | Stage 1B shown                                                   | Condition to pass                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scratch**, Junior 5–7             | Logic, Creativity, and Digital Literacy are all 5/5          | Logic, Creativity, Digital Literacy; 15 questions                | 15/15. Any mistake preserves Scratch Jr as Assigned Module and may retain Scratch as Potential Module.                                             |
| **Roblox Studio**, Kids 8–11        | Logic, Creativity, Spatial, and Digital Literacy are all 5/5 | All four pillars; 20 questions                                   | 20/20. Any mistake preserves Scratch as Assigned Module.                                                                                           |
| **Python**, Kids Upper 12–15        | Logic is 5/5                                                 | Standard 10-question Top-2 set with Logic locked into one slot   | The five Stage 1B Logic questions must be 5/5. The second pillar remains potential evidence.                                                       |
| **Roblox Studio**, Kids Upper 12–15 | Spatial is 5/5 and Digital Literacy is high                  | Standard 10-question Top-2 set with Spatial locked into one slot | Spatial validator evidence must remain high/perfect; Logic and Digital Literacy determine whether Roblox or the safer Scratch pathway is assigned. |
| **Roblox Studio**, Teens 16–18      | Stage 1A Spatial is 5/5                                      | Ten questions: five Logic plus five Spatial                      | Stage 1B Spatial must also be 5/5. Only this complete Spatial validation may change Assigned Module from Python to Roblox Studio.                  |

#### 7.3.3 Digital Literacy gatekeeper

Digital Literacy is evaluated in Stage 1A before module routing. A low Digital Literacy score, defined as **0–2 out of 5**, blocks an automatic jump to a tool-heavier module even when another cognitive pillar is high.

- Junior 5–7 with low Digital Literacy remains assigned to Scratch Jr.
- Kids 8–11 with low Digital Literacy remains assigned to Scratch.
- Kids Upper 12–15 with low Digital Literacy cannot be assigned directly to Roblox Studio. If Logic is also low, Scratch is the safe assignment even when Spatial is high.
- Teens 16–18 remains on the age-default Python pathway when Logic, Spatial, or Digital Literacy is low. Low scores create support and review evidence; they do not route the student to Scratch or remove the age-default Python assignment.

Stage 1B still runs in standard Top-2 mode when an exceptional jump is not available. Its purpose in that case is to preserve evidence about the student's strongest potential, not to override the Digital Literacy gate.

#### 7.3.4 Teens 16–18 routing contract

The Teens route uses age policy differently from the younger routes. Python is not an advanced jump that must be earned through a perfect Logic score. It is the default current pathway for this age group.

Stage 1B selection for Teens is deterministic:

1. include Logic as the first required pillar;
2. if Stage 1A Spatial is 5/5, include Spatial as the second pillar;

### 7.4 Question Attempt Limit, Question Timer, and Skip Policy

Across all assessment applications (`junior-final-placement-test.html`, `kids-final-placement-test.html`, `teens.html`), question navigation and attempt state must strictly enforce the following global rules:

1. **Attempt Limit (Max 2 Attempts):**
   - Every question (multiple choice or interactive) provides a maximum of **2 submission attempts**.
   - **First Attempt Incorrect:** Displays feedback banner/status ("Belum tepat. Kesempatan tersisa: 1. Silakan coba lagi.") and allows the student to try 1 more time.
   - **Second Attempt Incorrect:** Displays final feedback ("Kesempatan habis.") and automatically advances to the next question, recording **score 0** for that question.
   - **Correct Submission (1st or 2nd attempt):** Records full/earned credit and advances to the next question.

2. **Per-Question Timer (2-Minute Hard Limit):**
   - Each question has a hard duration limit of **2 minutes (120 seconds)**.
   - A question timer controller tracks elapsed time for each question key.
   - If 120 seconds elapse without a final submission, the system auto-submits a timeout response and advances to the next question with **score 0**.

3. **Inactivity Skip Policy (1-Minute Lock):**
   - The "Lewati Soal" (Skip Question) action is **disabled / hidden for the first 60 seconds (1 minute)** of each question.
   - Once 60 seconds elapse, the "Lewati Soal" button becomes enabled and available for the student.
   - If the student clicks "Lewati Soal", the system confirms the skip, records **score 0** for that question, and advances to the next question.

3. otherwise compare Spatial and Creativity and include the higher-scoring pillar;
4. if Spatial and Creativity tie, prefer Spatial because it provides evidence for the only alternate Teens module;
5. show five questions for each selected pillar, for ten questions total.

Teens module routing:

| Evidence                                                       | Assigned Module | Potential Module                                                                                                 | Required explanation                                                                                                                     |
| -------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Stage 1A Spatial 5/5 and Stage 1B Spatial 5/5                  | Roblox Studio   | Roblox Studio                                                                                                    | Strong and consistently validated spatial reasoning supports 3D environment building and Lua-based scripting.                            |
| Spatial is high but not perfect across both stages             | Python          | Roblox Studio                                                                                                    | Roblox potential is visible, but the strict Spatial validator for changing the current assignment is not complete.                       |
| Creativity is high but Spatial validation is not perfect       | Python          | Roblox Studio only when Creativity reaches at least 4/5 in Stage 1A and, when selected, at least 4/5 in Stage 1B | Creativity supports game and environment design potential but cannot independently assign Roblox Studio.                                 |
| Logic is high and Spatial is not perfectly validated           | Python          | Python                                                                                                           | The profile supports the age-default text-based programming pathway.                                                                     |
| Logic and Spatial are low                                      | Python          | Python, unless other evidence supports a future Roblox pathway                                                   | Python remains the age-default module; Stage 2 determines FOUNDATIONAL or BASIC and the report explains required support.                |
| Digital Literacy is low and Spatial is not perfectly validated | Python          | Preserve evidence-driven potential                                                                               | Record a`digital_readiness_support_required` flag; do not reroute the student to Scratch solely because of age-default tool readiness. |

For Teens, low Digital Literacy never routes the student down to Scratch. If Spatial is perfect in both stages, Roblox Studio may still be assigned under the explicit alternate-path rule, while `digital_readiness_support_required` remains attached so Stage 2 and the final report can address tool-operation support.

The Teens Stage 1 result must never assign a course level. It outputs Assigned Module and Potential Module only. Stage 2 must load the assessment belonging to the resulting Assigned Module: Python by default or Roblox Studio after complete Spatial validation.

### 7.4 Tie handling

The engine must not use object order as a tie-breaker.

When profiles are equal:

1. apply the age-based module policy;
2. compare module-readiness composite scores;
3. prefer the safer current module;
4. display the higher module as potential when supported by evidence;
5. flag ambiguous results for academic review when necessary.

### 7.5 Stage 1 outputs

Stage 1 must produce:

- score per pillar;
- readiness score per eligible module;
- Assigned Module;
- Potential Module;
- fallback reason, when applicable;
- Stage 2 assessment identifier;
- Stage 3 eligibility prerequisites;
- review flags.

---

## 8. Stage 2 — Adaptive Practical Level Placement

Stage 2 determines whether the student's automatic starting placement inside the Assigned Module is FOUNDATIONAL — Lv1 or BASIC — Lv2. Stage 2 may identify an exceptional **Lv3 candidate**, but it must never assign EMERGING — Lv3 automatically.

Official Kalananti level labels:

- **FOUNDATIONAL — Lv1**
- **BASIC — Lv2**
- **EMERGING — Lv3**

Every student begins a newly assigned module from the appropriate placement level within that module. Levels are module-specific and cannot be transferred directly between modules.

FOUNDATIONAL — Lv1 and BASIC — Lv2 may be recommended from Stage 2 evidence. EMERGING — Lv3 is a special-case placement requiring a separate post-result portfolio review and explicit Academic Team approval.

Example:

```text
Python BASIC — Lv2 does not automatically equal Roblox Studio BASIC — Lv2.
```

### 8.1 Module-specific environments

| Assigned Module | Stage 2 environment                                        |
| --------------- | ---------------------------------------------------------- |
| Scratch Jr      | Visual assessment combined with a simplified block builder |
| Scratch         | HTML/JavaScript block-code builder with executable preview |
| Roblox Studio   | Browser-based 3D/game builder                              |
| Python          | Browser-based mini IDE with automated tests                |

### 8.2 Seven ordered challenge difficulties

Each module contains seven calibrated challenge difficulties:

| Challenge | Intended difficulty                          |
| --------: | -------------------------------------------- |
|         1 | Very easy                                    |
|         2 | Easy                                         |
|         3 | High foundational                            |
|         4 | Early basic                                  |
|         5 | High basic                                   |
|         6 | Advanced evidence for possible Lv3 candidacy |
|         7 | Highest evidence for possible Lv3 candidacy  |

The student does not have to complete all seven challenges. The system uses an adaptive staircase.

For the current Junior implementation, the minimum viable staircase uses three scaffolded question types instead of exposing all seven challenge difficulties. This Junior-specific rule is defined in Section 8.3.1. The seven-difficulty model remains the long-term calibration framework and the default for other audience groups.

### 8.3 Adaptive staircase

Default starting point: **Challenge 4**.

Routing:

- correct on either of the two allowed submissions → move one challenge higher;
- incorrect first submission → allow one final correction submission on the same challenge;
- two incorrect submissions → move one challenge lower;
- first-submission evidence remains stored separately even when the correction submission is successful;
- continue until a mastery boundary is found;
- issue a confirmation challenge around the detected boundary;
- stop when the boundary is sufficiently confirmed.

Junior may transition from a block challenge to a lower visual or sequence challenge when the block interaction is too difficult. This transition lowers the assessed difficulty; it does not erase the original result.

#### 8.3.1 Junior three-question scaffolding

Junior Stage 2 must provide at least three distinct, progressively more difficult question types:

| Question | Difficulty   | Activity                                                                          | Primary evidence                                                |
| -------: | ------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
|        1 | Easy         | Match animal pictures, leg counts, and traits to visual data blocks               | visual matching, categorization, and basic block-slot operation |
|        2 | Intermediate | Arrange movement blocks so a character reaches a target without hitting obstacles | sequencing, direction, spatial reasoning, and program execution |
|        3 | Hard         | Inspect a program that fails and replace the incorrect loop or movement block     | debugging, loop understanding, prediction, and correction       |

The Junior assessment begins at **Question 2 — Intermediate**, not Question 1.

Required routing:

```text
Start at Question 2 — Intermediate
├── Correct → Question 3 — Hard
│   ├── Correct → BASIC — Lv2
│   └── Incorrect → FOUNDATIONAL — Lv1
└── Incorrect → Question 1 — Easy
    ├── Correct → FOUNDATIONAL — Lv1
    └── Incorrect → FOUNDATIONAL — Lv1
```

Routing rules:

- "Correct" means correct on either of the two allowed scored submissions.
- Each question allows a maximum of two scored submissions.
- An incorrect first submission keeps the student on the same question and provides an age-appropriate visual hint.
- A correct second submission remains recorded as `firstSubmissionCorrect: false` and `finalSubmissionCorrect: true`.
- Routing to Question 1 or Question 3 occurs only after the current question has a final evaluated result.
- Question 1 is a fallback scaffold, Question 2 is the default starting task, and Question 3 is the upper validation task.
- Junior Stage 2 produces only FOUNDATIONAL — Lv1 or BASIC — Lv2.
- This three-question Junior route does not produce `lv3_candidate` or EMERGING — Lv3.
- Technical errors do not consume a scored submission and do not trigger downward routing.

The stored Junior question trail must include:

```json
{
  "question": 2,
  "difficulty": "intermediate",
  "submissionAttemptCount": 2,
  "firstSubmissionCorrect": false,
  "finalSubmissionCorrect": true,
  "resetCount": 1,
  "durationSeconds": 180
}
```

### 8.4 Level mapping

The table below applies to the general seven-difficulty staircase. The current Junior three-question implementation uses the explicit routing and level outcomes in Section 8.3.1.

|                             Highest confirmed mastery | Automatic Stage 2 result                                                   |
| ----------------------------------------------------: | -------------------------------------------------------------------------- |
|                                        Challenge 1–3 | FOUNDATIONAL — Lv1                                                        |
|                                        Challenge 4–5 | BASIC — Lv2                                                               |
| Challenge 6–7 without every exceptional prerequisite | BASIC — Lv2 with advanced evidence recorded                               |
|       Challenge 7 with every exceptional prerequisite | `lv3_candidate`; record special status and continue to universal Stage 3 |

If Challenge 1 is not completed successfully, the result remains FOUNDATIONAL — Lv1 with a `foundation_support_required` review flag. There is no Level 0.

### 8.5 Exceptional Lv3 candidate requirements

Lv3 candidacy is intentionally rare. The student must satisfy all of the following:

1. answer every scored item correctly in Stage 1A;
2. answer every scored item correctly in Stage 1B;
3. begin Stage 2 at Challenge 4 and continue moving upward without an incorrect first submission;
4. complete Challenges 4, 5, 6, and 7 correctly on the first submission;
5. pass the highest-difficulty confirmation challenge;
6. have no unresolved technical error or ambiguous evidence affecting the result.

Meeting these conditions produces:

```text
Stage 2 Automatic Placement: BASIC — Lv2
Special Status: Lv3 Candidate
Next Step: Universal Stage 3, followed by optional portfolio review
```

It does not produce an approved Lv3 placement.

### 8.6 Confirmation evidence

A single successful challenge is not sufficient when it is the only evidence around a boundary.

The system should seek two consistent pieces of evidence, such as:

- success at the boundary plus success on a parallel confirmation task;
- success below the boundary and failure above it;
- two equivalent validations within the same difficulty band.

For the Lv3-candidate path, confirmation at the highest tested boundary is mandatory even when all previous submissions were correct.

### 8.7 Submission and retry policy

Before a scored run, the student may:

- drag and rearrange items;
- remove items;
- reset the workspace;
- revise the answer.

When the student presses **Run & Check**:

- each challenge allows a maximum of two scored submissions;
- a correct first submission moves upward immediately;
- an incorrect first submission unlocks one final correction submission;
- a correct correction submission moves upward, while preserving `firstSubmissionCorrect: false`;
- two incorrect submissions move downward;
- corrected completion is stored separately and never replaces first-submission evidence;
- a technical failure must not be scored as an incorrect answer.

### 8.8 Challenge telemetry

Each challenge result should store:

```json
{
  "challengeId": "module-difficulty-variant",
  "module": "Scratch",
  "difficulty": 4,
  "submissionAttemptCount": 2,
  "firstSubmissionCorrect": false,
  "finalSubmissionCorrect": true,
  "runCount": 3,
  "resetCount": 1,
  "hintUsed": false,
  "durationSeconds": 240,
  "validationChecks": {},
  "technicalError": false
}
```

Time, run count, and reset count are supporting evidence. They should not independently fail a student.

---

## 9. Practical Environment Validation

### 9.1 Scratch Jr and Scratch

The block builder may provide:

- event blocks;
- move and turn;
- repeat;
- if/condition;
- costume or state changes;
- broadcast;
- collision;
- run and reset controls;
- visual preview.

Validation should execute the block program and inspect outcomes rather than compare one exact block arrangement.

Possible validation:

- target reached;
- required object collected;
- character returned to destination;
- condition triggered;
- loop used where required;
- step limit respected.

### 9.2 Roblox Studio

The browser-based 3D builder may use Three.js or an equivalent browser-rendered scene.

Assessment capabilities may include:

- add objects;
- position on X/Y/Z;
- rotation;
- scale;
- material or color;
- anchor;
- grouping or parent-child;
- collision;
- play/test mode.

Validation must inspect scene state:

- object count and type;
- position and rotation tolerance;
- anchor state;
- grouping;
- collision configuration;
- traversable path;
- task-specific simulation result.

### 9.3 Python

The mini IDE should provide:

- code editor;
- Run button;
- visible console output;
- visible examples;
- hidden tests;
- safe execution limits;
- reset option.

Recommended MVP runtimes:

- Pyodide; or
- Skulpt.

Validation must use multiple test cases where possible. Matching one hardcoded output must not be sufficient for challenges that require reusable logic.

---

## 10. Result Screen

The result screen must display:

- student name;
- Assigned Module;
- assigned Kalananti level;
- Potential Module, when different;
- short human-readable explanation;
- learning roadmap;
- submission/review status.

For regular students, the displayed placement is FOUNDATIONAL — Lv1 or BASIC — Lv2.

For an exceptional candidate, the UI must not state that the student has already achieved Lv3. It should display:

```text
Current Placement: BASIC — Lv2
Special Status: Candidate for EMERGING — Lv3
Next Step: Choose a module and submit a project portfolio for Academic Team review.
```

Example:

```text
Assigned Module: Scratch
Starting Level: BASIC — Lv2
Potential Pathway: Python

Your logical reasoning shows strong potential for Python.
For your current age and tool readiness, Scratch is the recommended starting point.
```

The UI must not describe FOUNDATIONAL as failure.
The UI must not describe `lv3_candidate` as a confirmed level.

### 10.1 Parent-facing result objective

The final result must work as both:

1. an evidence-based placement report; and
2. a personalized explanation of why the recommended learning program is relevant for the student.

The report must not use fear, unsupported promises, or generic claims that every child must learn coding. The recommendation must be explained from the student's actual Stage 1 pillar evidence, Stage 2 practical performance, Stage 3 interest, age, and tool readiness.

The parent should be able to answer these questions after reading the result:

- What is my child's recommended module and starting level?
- What strengths did my child demonstrate?
- Which abilities still need to be developed?
- Why is the recommended module appropriate now?
- What will my child develop through the module?
- What is the next step after this module?
- Is a higher level confirmed, still a candidate, or not recommended yet?

### 10.2 Parent-facing information hierarchy

The result must be presented in the following order:

1. **Primary recommendation:** Assigned Module and current confirmed level;
2. **Personalized placement statement:** one short explanation connecting evidence to the recommendation;
3. **Four-pillar profile:** Logic, Creativity, Spatial, and Digital Literacy;
4. **Why learn this module now:** evidence → development need → learning activity → expected competency;
5. **Initial development priorities:** two or three concrete learning focuses;
6. **Learning Path:** official path name → ordered module journey, without level or placement-status labels inside the chart;
7. **Arah Belajar Berdasarkan Minat:** desired project outcome → official Learning Path → module to learn first and why;
8. **Review status and next action:** shown only when an exceptional review is actually applicable;
9. **Parent CTA:** download report, consult Academic Team, or view the recommended program.

Potential Module and Interest Confirmation must not compete visually with the primary recommendation. The first screenful must make the current Assigned Module and confirmed level unambiguous.

### 10.3 Four-pillar presentation

Each pillar must display:

- the pillar name;
- a parent-friendly development band;
- optional numeric score as secondary information;
- what the student demonstrated;
- why the ability matters;
- how the recommended module will develop it.

Recommended parent-facing bands:

| Internal normalized score | Parent-facing band | Copy intent                                             |
| ------------------------- | ------------------ | ------------------------------------------------------- |
| 80–100                   | Kekuatan Utama     | Highlight a consistently demonstrated strength          |
| 65–79                    | Berkembang Baik    | Show a useful foundation that should be extended        |
| 45–64                    | Sedang Bertumbuh   | Show emerging ability that needs structured practice    |
| 0–44                     | Perlu Pendampingan | Explain the need for support without describing failure |

These bands are presentation bands only. They must not replace the recommendation engine or become new placement thresholds.

Parent-facing pillar copy must use this structure:

```text
[Student Name] [demonstrated evidence].
Kemampuan ini penting untuk [developmental relevance].
Melalui [Assigned Module], [Student Name] akan berlatih [specific learning activity or competency].
```

Example:

```text
Logika — Kekuatan Utama

Nara mampu mengenali urutan dan hubungan sebab-akibat dengan konsisten.
Kemampuan ini menjadi dasar untuk menyusun instruksi dan memecahkan masalah.
Melalui Scratch Jr, Nara akan berlatih mengubah urutan tersebut menjadi proyek interaktif.
```

The report must never label a pillar as `poor`, `failed`, `weak child`, `not talented`, or equivalent language.

### 10.4 Dynamic report inputs

The copy generator must receive:

- `student_name`;
- `audience_group`;
- `exact_age`;
- `assigned_module`;
- `assigned_level`;
- `potential_module`;
- `interest_confirmation`;
- four normalized pillar scores;
- strongest pillar or pillars;
- development pillar or pillars;
- module-readiness scores;
- Stage 2 mastery boundary and challenge trail;
- fallback or locked-module reasons;
- `lv3_candidate`;
- portfolio status;
- Academic Team decision;
- review flags.

If a required input is missing or ambiguous, the report must use neutral copy and display `Menunggu peninjauan Academic Team`. It must not invent evidence.

This fallback is an error-handling state only. It must never appear merely because the automatic result is FOUNDATIONAL — Lv1 or BASIC — Lv2. When Stage 1, Stage 2, and Stage 3 evidence is complete, those placements are final automatic recommendations and require no Academic Team approval.

### 10.5 Universal recommendation copy formula

The main recommendation paragraph should be assembled using:

```text
[Student Name] direkomendasikan memulai [Assigned Module] pada [Assigned Level].
Hasil assessment menunjukkan [strongest demonstrated evidence].
[Development evidence] masih perlu diperkuat agar [Student Name] dapat [next competency].
Melalui [Assigned Module], [Student Name] akan berlatih [module-specific activities].
```

When the strongest and development evidence cannot be confidently selected:

```text
[Student Name] direkomendasikan memulai [Assigned Module] pada [Assigned Level].
Rekomendasi ini mempertimbangkan hasil kemampuan, tantangan praktis, usia, dan kesiapan penggunaan perangkat.
Academic Team akan meninjau hasil lengkap sebelum laporan dikirim kepada orang tua.
```

### 10.6 Scenario A — FOUNDATIONAL — Lv1

#### Display status

```text
Rekomendasi Saat Ini: [Assigned Module]
Starting Level: FOUNDATIONAL — Lv1
Status: Direkomendasikan untuk membangun fondasi
```

#### Main parent-facing copy

```text
[Student Name] direkomendasikan memulai [Assigned Module] pada FOUNDATIONAL — Lv1.

Hasil assessment menunjukkan bahwa [Student Name] sudah mulai mengenali [strongest demonstrated evidence]. Agar kemampuan tersebut berkembang lebih stabil, [development pillar evidence] masih perlu dilatih melalui aktivitas yang bertahap dan terarah.

Di level ini, [Student Name] akan membangun fondasi melalui [module-specific foundational activities]. Tujuannya bukan mengulang hal yang sudah bisa dilakukan, tetapi membantu [Student Name] memahami proses, mencoba dengan lebih mandiri, dan memiliki dasar yang kuat sebelum masuk ke tantangan yang lebih kompleks.
```

#### “Why learn now?” copy

```text
Mengapa mulai dari level ini?

FOUNDATIONAL — Lv1 memberikan ruang bagi [Student Name] untuk memahami konsep inti tanpa terburu-buru. Fondasi yang kuat membantu anak tidak hanya mengikuti contoh, tetapi secara bertahap memahami mengapa sebuah instruksi menghasilkan tindakan tertentu.
```

#### Initial development priorities

The report selects two or three relevant priorities:

- menyusun langkah dalam urutan yang benar;
- memahami hubungan antara instruksi dan hasil;
- menggunakan perangkat dan antarmuka dengan lebih mandiri;
- mengenali kesalahan sederhana dan mencoba memperbaikinya;
- menuangkan ide menjadi proyek digital sederhana;
- memahami posisi, arah, atau perubahan objek.

#### Prohibited interpretation

FOUNDATIONAL — Lv1 must never be described as:

- failing the placement test;
- being behind other children;
- having no coding talent;
- needing to repeat a class;
- being unable to progress.

### 10.7 Scenario B — BASIC — Lv2

#### Display status

```text
Rekomendasi Saat Ini: [Assigned Module]
Starting Level: BASIC — Lv2
Status: Siap mengembangkan kemampuan melalui proyek
```

#### Main parent-facing copy

```text
[Student Name] direkomendasikan memulai [Assigned Module] pada BASIC — Lv2.

Hasil assessment menunjukkan bahwa [Student Name] telah memiliki dasar yang cukup baik dalam [strongest demonstrated evidence] dan mampu menerapkannya pada tantangan praktis. [Development pillar evidence] masih dapat dikembangkan agar [Student Name] semakin mandiri ketika menghadapi proyek yang lebih kompleks.

Di level ini, [Student Name] tidak hanya mengenal fungsi dasar, tetapi mulai menggabungkan logika, kreativitas, dan proses pemecahan masalah untuk menghasilkan proyek yang dapat dijelaskan dan dikembangkan kembali.
```

#### “Why learn now?” copy

```text
Mengapa BASIC — Lv2 menjadi langkah yang tepat?

[Student Name] sudah siap bergerak dari aktivitas pengenalan menuju pembuatan proyek yang lebih terstruktur. Pembelajaran pada level ini membantu anak mengubah kemampuan yang sudah terlihat menjadi kebiasaan berpikir: merencanakan, mencoba, mengevaluasi hasil, dan memperbaiki proyek.
```

#### Initial development priorities

The report selects two or three relevant priorities:

- menggabungkan beberapa instruksi menjadi satu alur;
- merencanakan proyek sebelum mulai membuat;
- menguji hasil dan melakukan debugging;
- menggunakan kreativitas untuk menyampaikan ide;
- menjelaskan cara kerja proyek;
- meningkatkan kemandirian menggunakan fitur dan perangkat.

### 10.8 Scenario C — `lv3_candidate`, not yet approved

This is the parent-facing scenario immediately after the automatic assessment when the exceptional criteria are satisfied. The confirmed placement remains BASIC — Lv2.
This scenario applies only to assessment routes that can produce `lv3_candidate`. The Junior three-question Stage 2 route must never enter Scenario C, D, or E because Junior produces only FOUNDATIONAL — Lv1 or BASIC — Lv2.

#### Display status

```text
Current Placement: BASIC — Lv2
Special Status: Candidate for EMERGING — Lv3
Confirmation: Belum dikonfirmasi
Next Step: Portfolio dan peninjauan Academic Team
```

#### Main parent-facing copy

```text
[Student Name] menunjukkan performa yang sangat kuat dan konsisten pada rangkaian assessment. [Student Name] berhasil menyelesaikan tantangan tingkat lanjut dengan bukti kuat pada [strongest pillar evidence].

Penempatan yang telah dikonfirmasi saat ini adalah BASIC — Lv2. Berdasarkan hasil tersebut, [Student Name] terpilih sebagai kandidat untuk EMERGING — Lv3.

Status kandidat belum berarti bahwa Lv3 telah diberikan. Academic Team perlu meninjau portfolio untuk memastikan bahwa [Student Name] dapat menerapkan kemampuan tersebut secara mandiri dalam sebuah proyek, bukan hanya pada aktivitas placement test.
```

#### Parent value explanation

```text
Mengapa perlu portfolio?

Placement test menunjukkan cara [Student Name] menyelesaikan tantangan terarah. Portfolio membantu Academic Team melihat bagaimana [Student Name] merencanakan, membuat, menjelaskan, dan memperbaiki proyek secara lebih mandiri. Langkah ini memastikan bahwa penempatan Lv3 benar-benar sesuai dan tidak membuat proses belajar menjadi terlalu mudah atau terlalu berat.
```

#### CTA

Primary:

```text
Kirim Portfolio untuk Review Lv3
```

Secondary:

```text
Lihat Rekomendasi BASIC — Lv2
```

The result must never display `Starting Level: EMERGING — Lv3` while the status is only `lv3_candidate`, `portfolio_pending`, `portfolio_submitted`, or `portfolio_under_review`.

### 10.9 Scenario D — EMERGING — Lv3 approved

This scenario is shown only after explicit Academic Team approval with status `lv3_approved`.

#### Display status

```text
Rekomendasi Final: [Approved Module]
Starting Level: EMERGING — Lv3
Status: Disetujui Academic Team
```

#### Main parent-facing copy

```text
Setelah meninjau hasil placement test dan portfolio, Academic Team mengonfirmasi bahwa [Student Name] siap memulai [Approved Module] pada EMERGING — Lv3.

[Student Name] menunjukkan kemampuan yang konsisten dalam [strongest demonstrated evidence] serta mampu menerapkannya secara lebih mandiri pada proyek. Pada level ini, [Student Name] membutuhkan tantangan yang memberi ruang untuk merancang solusi, mengambil keputusan, melakukan debugging, dan menjelaskan proses pembuatan proyek.

Rekomendasi Lv3 bukan hanya didasarkan pada kecepatan menyelesaikan soal, tetapi pada kualitas pemahaman, konsistensi, dan bukti penerapan kemampuan dalam portfolio.
```

#### “Why learn now?” copy

```text
Mengapa EMERGING — Lv3?

Aktivitas pengenalan atau latihan yang terlalu terarah berisiko tidak lagi memberikan tantangan yang cukup. EMERGING — Lv3 memberi [Student Name] proyek yang lebih terbuka agar kemampuan berpikir, kreativitas, dan kemandiriannya terus berkembang.
```

#### Initial development priorities

- merancang solusi untuk brief yang lebih terbuka;
- menggabungkan beberapa konsep dalam satu proyek;
- melakukan debugging dan menjelaskan alasan perbaikannya;
- membuat keputusan desain atau teknis secara mandiri;
- mempresentasikan proses, hasil, dan kemungkinan pengembangan proyek.

### 10.10 Scenario E — Lv3 not approved after review

If the portfolio does not confirm Lv3 readiness, the result must preserve BASIC — Lv2 and explain the decision constructively.

#### Display status

```text
Rekomendasi Final: [Assigned Module]
Starting Level: BASIC — Lv2
Portfolio Review: Lv3 belum direkomendasikan
```

#### Parent-facing copy

```text
[Student Name] tetap menunjukkan potensi yang kuat berdasarkan placement test. Setelah meninjau portfolio, Academic Team merekomendasikan [Student Name] memulai dari BASIC — Lv2 agar [specific portfolio development evidence] dapat diperkuat terlebih dahulu.

Keputusan ini tidak menghapus potensi [Student Name]. BASIC — Lv2 akan memberikan kesempatan untuk membangun konsistensi, kemandirian, dan kualitas penerapan melalui proyek sebelum dilakukan evaluasi menuju tantangan berikutnya.
```

The report should include specific review evidence when available and may state when the student can be reviewed again. It must not use `failed portfolio review`.

### 10.11 Pillar-specific parent copy library

The implementation may adapt the following copy using the student's band and actual evidence.

#### Logic

```text
Kekuatan Utama / Berkembang Baik:
[Student Name] mampu mengenali pola, urutan, atau hubungan sebab-akibat dengan baik. Kemampuan ini menjadi fondasi untuk menyusun instruksi, memecahkan masalah, dan melakukan debugging.

Sedang Bertumbuh / Perlu Pendampingan:
[Student Name] sedang membangun kemampuan untuk menyusun langkah dan melihat hubungan antara instruksi dengan hasil. Latihan coding visual akan membantu proses berpikir tersebut menjadi lebih terstruktur.
```

#### Creativity

```text
Kekuatan Utama / Berkembang Baik:
[Student Name] mampu menggunakan pilihan visual dan ide untuk membentuk sebuah hasil. Kemampuan ini dapat dikembangkan menjadi keterampilan merancang cerita, animasi, permainan, atau pengalaman digital.

Sedang Bertumbuh / Perlu Pendampingan:
[Student Name] masih membutuhkan contoh dan batasan yang jelas ketika mengembangkan ide. Proyek bertahap akan membantu [Student Name] berani mencoba, memilih, dan mengembangkan idenya sendiri.
```

#### Spatial

```text
Kekuatan Utama / Berkembang Baik:
[Student Name] mampu memahami posisi, arah, perpindahan, atau hubungan antarobjek dengan baik. Kemampuan ini mendukung pembuatan animasi, permainan, dan lingkungan digital.

Sedang Bertumbuh / Perlu Pendampingan:
[Student Name] sedang mengembangkan pemahaman tentang posisi, arah, dan perubahan objek. Aktivitas visual dan simulasi akan membantu menghubungkan instruksi dengan perubahan yang terlihat di layar.
```

#### Digital Literacy

```text
Kekuatan Utama / Berkembang Baik:
[Student Name] cukup mandiri dalam memahami interaksi dan navigasi digital. Kesiapan ini membantu [Student Name] lebih fokus pada proses membuat dan memecahkan masalah.

Sedang Bertumbuh / Perlu Pendampingan:
[Student Name] masih perlu membangun kenyamanan dan kemandirian menggunakan perangkat serta antarmuka digital. Pembelajaran terarah akan melatih kebiasaan mencoba, menavigasi, dan mengatasi kendala sederhana.
```

### 10.12 Module-specific learning value

The “why this module” section should use the Assigned Module, not the Potential Module.

| Assigned Module | Parent-facing learning value                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Scratch Jr      | Mengubah ide menjadi cerita atau animasi sederhana sambil membangun urutan, sebab-akibat, dan kemandirian dasar menggunakan perangkat   |
| Scratch         | Menyusun logika proyek, menggabungkan visual dan interaksi, melakukan debugging, serta menjelaskan cara kerja karya digital             |
| Roblox Studio   | Mengembangkan penalaran spasial, logika sistem, desain lingkungan 3D, pengujian, dan pemecahan masalah dalam proyek                     |
| Python          | Mengubah masalah menjadi langkah yang terstruktur, menulis dan menguji instruksi berbasis teks, membaca error, serta memperbaiki solusi |

### 10.13 Interest Confirmation scenarios

When Interest Confirmation matches the Assigned Module:

```text
Minat [Student Name] pada [Interest Confirmation] selaras dengan hasil kemampuan dan rekomendasi saat ini. Keselarasan ini dapat membantu pembelajaran dimulai melalui proyek yang dekat dengan ketertarikannya.
```

When Interest Confirmation matches the Potential Module but not the Assigned Module:

```text
[Student Name] tertarik mempelajari [Interest Confirmation]. Minat tersebut menjadi tujuan yang baik untuk perjalanan belajarnya. Saat ini, [Assigned Module] direkomendasikan untuk membangun [required competencies] terlebih dahulu sebelum melanjutkan ke [Interest Confirmation].
```

When Interest Confirmation differs from both:

```text
[Student Name] menunjukkan ketertarikan pada [Interest Confirmation]. Informasi ini akan digunakan untuk memilih tema proyek yang lebih relevan, tetapi penempatan saat ini tetap [Assigned Module] — [Assigned Level] berdasarkan kemampuan dan kesiapan yang telah ditunjukkan.
```

### 10.14 Goal-based Learning Path presentation

The Learning Path is an aspirational roadmap derived from the student's Stage 3 Interest Confirmation. It must help parents understand the ordered program journey associated with the type of project the student wants to create.

The chart displays only:

1. `Learning Path [Student Name]` as the section heading;
2. the official path name;
3. ordered module nodes joined by arrows.

The chart must not display:

- FOUNDATIONAL, BASIC, EMERGING, or any level;
- `Available Now`, `Potential`, `Next Module`, or `Locked` badges;
- pillar scores or readiness requirements;
- a claim that every module must be taken simultaneously.

Immediately after the chart, the report must explain the recommendation in parent-facing language using this sequence:

```text
[Student Name] ingin [desired project outcome].
Karena itu, perjalanan belajarnya diarahkan melalui [Official Path Name].
Untuk menuju tujuan tersebut, [Assigned Module] sebaiknya dipelajari lebih dulu karena [required foundation], sebelum melanjutkan ke [Interest Confirmation].
```

When Interest Confirmation already equals Assigned Module, the final sentence becomes:

```text
Berdasarkan hasil placement, [Assigned Module] menjadi modul yang sebaiknya dipelajari sekarang.
```

The UI heading for this explanation is **Arah Belajar Berdasarkan Minat**, not the technical label `Konfirmasi Minat Stage 3`.

A general `Status Placement dan Review Lv3` section must not appear in ordinary results. Lv3 portfolio/review information is shown only to a student who is actually marked `lv3_candidate`, adjacent to the optional review action.

Placement information remains available elsewhere in the report through Assigned Module, assigned level, Potential Module, and the parent-facing explanation. The path represents an ordered learning journey and may support a multi-module program offer, but purchasing language must not imply guaranteed outcomes or artificial urgency.

Examples:

```text
GAME CREATOR PATH
Scratch Jr → Scratch → Roblox Studio

APP CREATOR PATH
Scratch → Python

INTERACTIVE CREATOR PATH
Scratch Jr → Scratch
```

For **Teens, ages 16–18**, the examples above are replaced by the Teens special-case sequences defined in Section 12.3.1. Stage 3 changes the project framing and route context only. Every Teens route still ends at Python. The official Learning Path name—not a raw module-interest label—is the element emphasized in the chart.

### 10.15 Parent-facing CTA

The result should provide:

- primary CTA: `Konsultasikan Hasil dengan Academic Team`;
- secondary CTA: `Unduh Laporan Lengkap`;
- optional program CTA after approval: `Lihat Program yang Direkomendasikan`;
- Lv3 candidate CTA: `Kirim Portfolio untuk Review Lv3`.

`Mulai Assessment Baru` must not be the primary parent-facing CTA.

### 10.16 Copy acceptance criteria

- The current confirmed Assigned Module and level are visible before Potential Module and interest.
- Every result contains at least one strength statement grounded in assessment evidence.
- Every result contains at least one development statement grounded in assessment evidence.
- Every development statement explains how the Assigned Module will address it.
- Every pillar appears with parent-friendly interpretation, not only a number.
- FOUNDATIONAL — Lv1 is framed as foundation building, not failure.
- BASIC — Lv2 is framed as readiness for structured project development.
- `lv3_candidate` remains visibly BASIC — Lv2 until approval.
- EMERGING — Lv3 appears as the starting level only after `lv3_approved`.
- `lv3_not_approved` preserves the student's potential and gives a constructive next step.
- Interest never overwrites ability-based placement.
- Potential Module never appears to be immediately available when it is locked.
- The copy does not promise guaranteed academic, career, or intelligence outcomes.
- The copy can be traced to stored Stage 1, Stage 2, Stage 3, or review evidence.

---

## 11. Academic Review and Parent Email

### 11.1 Submission flow

```text
Browser
→ Apps Script endpoint
→ Google Sheets
→ academic review
→ approval
→ parent email
→ BCC administrator
```

### 11.2 Required statuses

- `submitted`
- `under_review`
- `approved`
- `lv3_candidate`
- `portfolio_pending`
- `portfolio_submitted`
- `portfolio_under_review`
- `lv3_approved`
- `lv3_not_approved`
- `needs_manual_review`
- `rejected`
- `email_sent`
- `email_failed`

### 11.3 Email policy

- Parent email must not be sent before academic approval.
- Approved results are sent to the registered parent email.
- The configured administrator receives a BCC.
- Email failure must update status without deleting the approved result.
- Retrying email must not create a duplicate assessment row.

### 11.4 Suggested Sheet fields

- submission ID;
- timestamp;
- assessment version;
- student name;
- age range;
- audience group;
- parent email;
- branch;
- four Stage 1 pillar scores;
- module-readiness scores;
- Potential Module;
- Assigned Module;
- fallback reason;
- Stage 2 challenge trail;
- Stage 1A perfect-score flag;
- Stage 1B perfect-score flag;
- Lv3-candidate flag;
- Stage 3 selected module;
- portfolio project links or file references;
- portfolio descriptions;
- portfolio submission timestamp;
- portfolio review notes;
- portfolio decision;
- assigned level;
- review flags;
- review status;
- reviewer;
- reviewed timestamp;
- email status;
- email timestamp.

---

## 12. Stage 3 — Universal Interest and Learning-Track Confirmation

Stage 3 is mandatory for Junior, Kids, and Teens. It runs after Stage 2 and before any final result is shown.

Stage 3 does not rescore Stage 1, change the Assigned Module, or change the Stage 2 level. Its purpose is to connect demonstrated potential, the module available now, the modules that must be learned next, and the student's own preference so parents can understand both ability and motivation.

### 12.1 Inputs carried into Stage 3

Stage 3 must receive:

- student name, age, and audience group;
- Stage 1 pillar and readiness scores;
- Potential Module;
- Assigned Module;
- fallback or locked-module reasons;
- Stage 2 Assigned Module assessment;
- Stage 2 assigned level;
- Stage 2 challenge trail and review flags.

### 12.2 Mandatory interest confirmation

Every student answers age-appropriate questions about:

- preferred project type;
- preferred way of building;
- preferred visual or technical activity;
- debugging preference;
- desired project outcome;
- prior experience;
- module they currently want to learn;
- a short reason for that choice.

The Stage 3 interest result is stored as **Interest Confirmation**. It is supporting evidence and must never overwrite Potential Module, Assigned Module, or assigned level.

### 12.3 Named goal-based Learning Paths

The final report selects one official Learning Path from the Stage 3 Interest Confirmation. The same official naming is used across audiences, while module order may follow the explicit audience rules below.

| Interest Confirmation | Official path ID        | Official path name                 | Junior, 5–7                           | Kids, 8–15                            | Teens, 16–18                               |
| --------------------- | ----------------------- | ---------------------------------- | -------------------------------------- | -------------------------------------- | ------------------------------------------- |
| Scratch               | `interactive_creator` | **Interactive Creator Path** | Scratch Jr → Scratch                  | Scratch Jr → Scratch → Roblox Studio | Scratch → Roblox Studio →**Python** |
| Roblox Studio         | `game_creator`        | **Game Creator Path**        | Scratch Jr → Scratch → Roblox Studio | Scratch → Roblox Studio               | Roblox Studio →**Python**            |
| Python                | `app_creator`         | **App Creator Path**         | Scratch Jr → Scratch → Python        | Scratch → Python                      | Scratch →**Python**                  |

Selection rules:

1. use Interest Confirmation when Stage 3 has a confirmed result;
2. if Interest Confirmation is missing because of an exceptional incomplete-data state, use Potential Module;
3. if Potential Module is also missing, use Assigned Module;
4. map the selected target deterministically using the table above;
5. do not use Stage 2 level, pillar score, age gate, or purchase choice to rename the path;
6. do not change Assigned Module, Potential Module, or assigned level when selecting a path.

The module sequence represents the complete foundation-to-goal journey for the student's audience, even when the Assigned Module is a later node. The separate placement result tells the parent where the student should begin now.

#### 12.3.1 Teens special case — Learning Path context with Python as the fixed destination

For Teens, Stage 3 must never replace the ability-based recommendation with a module merely because the student selected it as an interest.

The Teens rules are:

1. **Python is the fixed final destination** for every Teens Learning Path.
2. The **official Learning Path name** is visually highlighted in the chart. Individual module nodes are not highlighted as interest labels; Python remains the final node in every route.
3. The answer to the explicit Stage 3 question **“modul mana yang ingin kamu dalami?”** is stored as `Interest Confirmation`. Earlier preference questions are supporting evidence and must not be combined into a majority vote that overrides this final confirmation.
4. A Scratch interest produces `Interactive Creator Path`: Scratch → Roblox Studio → **Python**.
5. A Roblox Studio interest produces `Game Creator Path`: Roblox Studio → **Python**.
6. A Python or app-development interest produces `App Creator Path`: Scratch → **Python**.
7. The selected interest changes the Learning Path and its explanation under **Arah Belajar Berdasarkan Minat**, but it does not change the Teens Assigned Module or assigned level.
8. Scratch is not presented as the primary recommendation for a Teens student. It may be described only as a short visual introduction or project context.
9. Roblox Studio must not be presented as the recommended starting module when Creativity or Spatial readiness is below the required threshold. The report records the game/3D interest as a possible project theme, explains the readiness gap in parent-facing language, and keeps Python as the main learning direction.
10. Even when Creativity and Spatial readiness are adequate, a Roblox Studio interest remains an interest context unless the separate Teens Stage 1A and Stage 1B alternate-assignment requirements have actually assigned Roblox Studio.

Required parent-facing outcomes:

- **Interactive Creator Path:** explain that interactive and visual projects can provide the starting context, while the Teens technical journey continues toward Python.
- **Game Creator Path with insufficient readiness:** state that Roblox Studio is not yet recommended as the starting point because the relevant Creativity/Spatial evidence is not strong enough; keep the journey directed toward Python.
- **Game Creator Path with sufficient readiness:** allow game development to frame projects, without letting Stage 3 overwrite the ability-based placement.
- **App Creator Path:** state that the path aligns with application, tools, and solution-building goals and leads to Python.

Parent-facing copy must lead with the official path name. It must not lead with raw labels such as `minat Scratch`, `minat Roblox`, or `minat Python`.

Required stored result fields:

```json
{
  "learning_path_id": "game_creator",
  "learning_path_name": "Game Creator Path",
  "learning_path_modules": ["Scratch", "Roblox Studio"],
  "learning_path_source": "interest_confirmation"
}
```

`learning_path_source` must be one of `interest_confirmation`, `potential_module_fallback`, or `assigned_module_fallback`.

### 12.4 Locked-module explanation

A module may be shown as Potential or Interested In while remaining locked. Every locked module must have one or more explicit reason codes:

- `age_requirement`;
- `digital_literacy_requirement`;
- `logic_readiness_requirement`;
- `spatial_readiness_requirement`;
- `missing_pillar_evidence`;
- `assigned_module_prerequisite`;
- `academic_review_required`.

Parent-facing copy must explain the reason in plain language and state which module or skill should be completed first.

### 12.5 Final result timing and contents

No parent-facing final result screen is shown between stages. After each stage is completed and its result is saved, the product must automatically open the next stage without a `Lanjut`, `Lihat rekomendasi`, or equivalent manual continuation button. The complete placement result appears only after Stage 3 is completed.

The final result must show:

- Potential Module from Stage 1;
- the official Learning Path name and ordered module journey;
- Assigned Module from Stage 1;
- assigned level from Stage 2;
- Interest Confirmation from Stage 3;
- locked-module reasons;
- Assigned Module and assigned level outside the Learning Path chart;
- the next module and prerequisites;
- review status.

### 12.6 Optional exceptional Lv3 review after the result

If Stage 2 records `lv3_candidate`, the universal Stage 3 and final learning-track result still run normally. After the result, the product may offer a separate portfolio submission for Academic Team review.

Portfolio submission does not replace Stage 3. Only explicit `lv3_approved` may produce EMERGING — Lv3; otherwise the automatic placement remains BASIC — Lv2.

Academic Team review applies only to the optional EMERGING — Lv3 branch or to a genuine missing/ambiguous-data error. Regular FOUNDATIONAL — Lv1 and BASIC — Lv2 results must be shown immediately after Stage 3 and must not display `Menunggu peninjauan Academic Team`.

The UI must not frame a Lv2 decision as failure or rejection.

---

## 13. Technical Architecture

### 13.1 Current direction

- Vanilla HTML, CSS, and JavaScript;
- centralized application state;
- local visual assets under `assets/images/`;
- responsive CSS;
- touch and pointer interaction support;
- Apps Script as the initial backend integration;
- Google Sheets as the initial operational datastore.

### 13.2 Recommended state model

```js
{
  assessmentVersion,
  submissionId,
  student: {
    name,
    parentEmail,
    branch,
    ageRange,
    audienceGroup
  },
  stage1: {
    scores,
    readinessScores,
    potentialModule,
    assignedModule,
    fallbackReason,
    reviewFlags
  },
  stage2: {
    module,
    currentDifficulty,
    challengeTrail,
    highestConfirmedMastery,
    automaticPlacement,
    lv3Candidate,
    lv3CandidateEvidence
  },
  stage3: {
    eligible,
    selectedModule,
    portfolioItems,
    status,
    reviewerDecision,
    reviewerNotes,
    finalApprovedLevel
  },
  submission: {
    status,
    submittedAt,
    lastError
  }
}
```

### 13.3 Question-bank direction

Question content should eventually move from hardcoded JavaScript into versioned JSON or an API.

Every question or challenge should have:

- stable ID;
- assessment version;
- audience group;
- pillar or module;
- difficulty;
- interaction type;
- content;
- validation rules;
- asset references;
- active/inactive status.

---

## 14. Production and Developer Controls

- Developer controls must not appear on GitHub Pages or another production domain.
- Local development may expose developer navigation automatically on `localhost` and `127.0.0.1`.
- Production must not rely only on visually hiding controls if their actions can alter submitted results.
- Test submissions must be marked and must not be mixed with real assessment results.

---

## 15. Accessibility and Responsive Requirements

- All interactive tasks must support the intended input method.
- Kids drag-and-drop must support touch devices.
- Critical actions require visible text or accessible labels.
- Junior instructions should support Indonesian text-to-speech.
- Color must not be the only indicator of correctness or state.
- The application must not create horizontal overflow at supported widths.
- Local images must have fallback behavior or error handling.
- Reduced-motion preferences should be respected for decorative animation.

---

## 16. Acceptance Criteria

### Registration

- The form records all required fields.
- Every age option maps to the correct audience and module policy.
- Invalid email blocks the assessment start.

### Stage 1

- Every student completes all four pillars.
- Junior receives simple visual-choice interactions.
- Kids and Teens receive no conventional ABC question UI.
- Scores are balanced by pillar.
- Logic and Digital Literacy participate in module readiness.
- Stage 1B always opens with at least 10 questions.
- Standard Stage 1B contains five advanced questions from each of the Top 2 ability pillars selected from Logic, Creativity, and Spatial.
- Digital Literacy is used as a Stage 1A gatekeeper and is not treated as a standard Top-2 ability pillar.
- Junior Stage 1B expands to 15 questions only when Logic, Creativity, and Digital Literacy are all perfect in Stage 1A.
- Kids 8–11 Stage 1B expands to 20 questions only when all four Stage 1A pillars are perfect.
- Kids Upper 12–15 Stage 1B remains 10 questions and locks perfect Logic and/or Spatial into its Top-2 selection.
- Teens 16–18 Stage 1B always contains five Logic questions and five questions from Spatial or Creativity.
- Teens 16–18 locks Spatial as the second Stage 1B pillar when Stage 1A Spatial is 5/5; otherwise the higher of Spatial and Creativity is selected, with Spatial winning a tie.
- The system outputs both Potential Module and Assigned Module.
- Age 8–11 is assigned Roblox Studio only after perfect four-pillar evidence across the exceptional validator; otherwise it remains Scratch.
- Age 12–15 may be assigned Python after perfect Logic validation, Roblox Studio after strong Spatial and Digital Literacy evidence, or Scratch as the safer fallback.
- Age 16–18 remains assigned to Python by default.
- Age 16–18 is assigned Roblox Studio only when Spatial is 5/5 in both Stage 1A and its five Stage 1B Spatial questions.
- High Teens Creativity may support Roblox Studio as Potential Module but cannot independently change Assigned Module.
- Low Teens Logic, Spatial, or Digital Literacy records support evidence without routing the student down to Scratch.
- Teens Stage 2 loads Python unless complete Spatial validation changed Assigned Module to Roblox Studio.

### Stage 2

- Stage 2 loads only the Assigned Module assessment.
- The general challenge bank provides seven ordered difficulties.
- The general adaptive staircase starts at Difficulty 4.
- The current Junior implementation provides at least Easy, Intermediate, and Hard question types.
- Junior starts at Question 2 — Intermediate.
- Junior Intermediate success routes to Question 3 — Hard.
- Junior Intermediate failure routes to Question 1 — Easy.
- Junior receives at most two scored submissions per question.
- Junior Hard success results in BASIC — Lv2 and Hard failure results in FOUNDATIONAL — Lv1.
- Junior Easy success results in BASIC — Lv2 and Easy failure results in FOUNDATIONAL — Lv1.
- Junior's three-question scaffold never assigns EMERGING — Lv3 or produces `lv3_candidate`.
- Junior question trails preserve both first-submission and final-submission correctness.
- Correct submission within the two-attempt limit moves upward.
- Incorrect first submission allows one final correction submission.
- Two incorrect submissions move downward.
- A successful correction does not replace first-submission evidence.
- The system confirms the detected mastery boundary.
- Mastery 1–3 maps to FOUNDATIONAL — Lv1.
- Mastery 4–5 maps to BASIC — Lv2.
- Mastery 6–7 does not assign EMERGING — Lv3 automatically.
- A student is marked `lv3_candidate` only when Stage 1A and Stage 1B are perfect and the Stage 2 upward path plus highest-difficulty confirmation are completed without an incorrect first submission.
- A candidate's automatic placement remains BASIC — Lv2 until the separate post-result portfolio review is approved.
- Technical errors do not count as incorrect answers.

### Stage 3

- Every Junior, Kids, and Teens student enters Stage 3 after Stage 2.
- Stage 3 receives and preserves the Stage 1 Potential Module and Assigned Module.
- Stage 3 receives and preserves the Stage 2 assigned level.
- Stage 3 records the student's Interest Confirmation without overwriting ability-based placement.
- Stage 3 deterministically maps Scratch to Interactive Creator Path, Roblox Studio to Game Creator Path, and Python to App Creator Path.
- Interest Confirmation comes from the explicit final module-choice question; earlier Stage 3 preference answers do not override it through majority voting.
- Junior path sequences begin with Scratch Jr and Kids path sequences begin with Scratch.
- Teens uses the special-case sequences: Scratch → Roblox Studio → Python, Roblox Studio → Python, or Scratch → Python according to Interest Confirmation.
- Every Teens path ends at Python, while the official Learning Path name is the visually highlighted element.
- Teens Stage 3 choices change the Learning Path and the **Arah Belajar Berdasarkan Minat** explanation; they do not overwrite the ability-based Assigned Module or assigned level.
- Parent-facing copy leads with Interactive Creator Path, Game Creator Path, or App Creator Path rather than raw `minat [module]` wording.
- A low Creativity or Spatial result prevents Roblox Studio from being described as the recommended Teens starting point, even when Roblox Studio is the confirmed interest.
- The Learning Path chart contains only the path name and ordered modules, with no level or placement-status labels.
- Assigned Module, assigned level, Potential Module, and locked-module explanations remain separate report content.
- Every locked module has at least one explicit age, readiness, pillar, or prerequisite reason.
- The complete result is shown only after Stage 3.
- Optional portfolio review is offered after the result only to `lv3_candidate` students.
- Only explicit `lv3_approved` review assigns EMERGING — Lv3.

### Result and integration

- Result displays Assigned Module, assigned level, and Potential Module.
- Candidate screens clearly distinguish BASIC — Lv2 automatic placement from unconfirmed Lv3 candidacy.
- Portfolio evidence and the Academic Team decision are stored with the assessment record.
- Completed results survive a temporary submission failure.
- Apps Script submission does not create duplicate rows.
- Parent email is sent only after approval.
- Administrator receives a BCC.
- Production does not display developer controls.

### Quality assurance

- No uncaught JavaScript error occurs in the complete flow.
- All referenced local assets load.
- No horizontal overflow occurs on supported desktop and mobile widths.
- Touch-based interactions are tested on a mobile viewport.
- Every recommendation can be explained from stored scoring evidence.

---

## 17. Out of Scope for Initial Release

- Full recreation of Scratch or Roblox Studio;
- automatic preference-based module switching;
- transferring levels between modules;
- automatic EMERGING — Lv3 placement without portfolio review;
- parent self-service approval;
- unrestricted server-side Python execution;
- machine-learning recommendation logic;
- automatic recommendation without academic review.

---

## 18. Open Implementation Decisions

The following require implementation prototyping but do not block the product logic:

- Pyodide versus Skulpt for Python;
- Three.js interaction design for the Roblox assessment;
- block-builder library versus custom HTML/JavaScript blocks;
- exact number of confirmation tasks per difficulty;
- calibration content for the seven difficulties;
- Apps Script authentication and administrator approval interface;
- supported browser and device matrix.

---

## 19. Mandatory Documentation & Maintenance Policy

All developers and AI coding agents working on the Kalananti Placement Test codebase MUST strictly adhere to the following documentation rule:

- **Mandatory Changelog Update:** After EVERY chat, task, feature addition, bug fix, or visual update, all changes MUST be documented immediately in [`CHANGELOG.md`](file:///Users/yazidhilmi/Documents/cloud/Kalananti-cloud/Academic_Content/B2C/placement-test/CHANGELOG.md).
- **Required Changelog Structure:** Each entry in `CHANGELOG.md` must detail:
  1. **What was changed & the goal** of the task;
  2. **Technical process & root cause analysis** (why the bug/issue occurred);
  3. **What worked** (successful solutions, fixes, and build steps);
  4. **What did not work** (failed initial attempts, race conditions, or misleading visual cues encountered during development).
- **Build Re-assembly:** Whenever `stage2-junior.html`, `junior.html`, or `stage 3.html` are modified, `node assemble-junior-final.mjs` MUST be executed to re-compile `junior-final-placement-test.html` and `junior-preview.html`.

---

## 20. Code.gs Technical Documentation

This section provides a breakdown of how `Code.gs` is structured, specifically focusing on the Google Sheets integration, sheet names, and how the web app handles and stores session data.

### 20.1 Google Sheets Link & Folder IDs

At the very top of `Code.gs`, there is a configuration object named `PLACEMENT_CONFIG` that acts as the single source of truth for external references:

- **Google Sheet ID:** `1aTftCK6eF_gLPYueH-TH7nt4Pc0Ew247xfF49a91eK4`
  - *Access the sheet via: `https://docs.google.com/spreadsheets/d/1aTftCK6eF_gLPYueH-TH7nt4Pc0Ew247xfF49a91eK4`*
- **Google Drive PDF Folder ID:** `171mw0cN5K22tjsTfAHrKhqPbD7ZjPV9W` (Used to store the generated Placement Test PDF results).

### 20.2 Tab / Sheet Names

The Google Apps Script interacts with exactly three specific tabs within the target Google Sheet. If they do not exist, the `setupPlacementStorage()` function is designed to create them automatically.

- **`Sessions`** (`sessionsSheet`): The primary database table. It tracks the current state of every student's placement test (e.g., student details, current stage, final result).
- **`StagePayloads`** (`payloadsSheet`): An append-only historical log of raw JSON data submitted from the frontend at every stage. This is useful for auditing and preventing data loss.
- **`SyncLog`** (`logSheet`): A basic system log that records successful operations and errors for debugging purposes.

### 20.3 How and When it Stores Web App Sessions

The script acts as a REST API backend for the frontend web app. It receives HTTP POST requests via the `doPost(event)` function. It stores and updates sessions across three main actions:

#### A. Initializing a Session (`action: 'register'`)

When a student starts the test, the frontend sends a `register` action.

- **What it does:** The `register_()` function is triggered.
- **Storage Action:** It either creates a new row or finds an existing row (based on `submissionId`) in the **`Sessions`** sheet.
- **Data Stored:** It saves the student's demographic data (name, age, email, branch) and sets the initial state (`session_status: 'in_progress'`, `current_stage: 1`).

#### B. Progressing Through the Test (`action: 'save_stage'`)

As the student completes Stage 1, Stage 2, or Stage 3, the frontend sends a `save_stage` action to periodically sync their progress.

- **What it does:** The `saveStage_()` function is triggered.
- **Storage Action 1 (Audit):** It immediately appends a new row to the **`StagePayloads`** sheet containing the raw JSON of the answers to keep a safe backup.
- **Storage Action 2 (State Update):** It updates the student's row in the **`Sessions`** sheet, recording which stage they just completed, timestamping it, and saving any module/level recommendations calculated up to that point.

#### C. Completing the Test (`action: 'finalize'`)

When the test is completely finished, the frontend sends a `finalize` action.

- **What it does:** The `finalize_()` function is triggered.
- **Storage Action:**
  1. The browser renders the approved visual report and converts that report DOM into an A4 PDF attachment.
  2. `Code.gs` validates the browser-generated PDF attachment and saves the exact attachment to the designated Google Drive folder.
  3. It sets `email_status` to `'not sent'` by default (email is **not** automatically sent upon test completion).
  4. Finally, it updates the **`Sessions`** sheet one last time, changing `session_status` to `'completed'`, and attaching the Google Drive PDF URL to the row.
  5. Parent email delivery is triggered manually by changing Column AF (`email_status`) to `Sent` in the Google Sheet (via `onEdit(e)`) or via the Branch Dashboard dropdown selector (`action: 'update_email_status'`).

`Code.gs` is not the active visual report renderer. The active visual PDF must come from the browser through `payload.pdfAttachment`. The legacy `buildPdfHtml_()` helper may still exist in the backend source, but it is not the source of truth for the approved Junior, Kids, or Teens report layout.

### 20.4 Final Report Rendering and PDF Ownership

The final report has three separate responsibilities:

1. **Audience HTML file**
   - Calculates the report content from the placement state.
   - Builds the visible report DOM, narrative, radar chart, placement module, level, and Learning Path.
   - Owns audience-specific report CSS and HTML structure.
2. **Shared browser PDF client (`placement-sync.js`)**
   - Finds the rendered report DOM.
   - Clones it into an off-screen A4 export sandbox.
   - Waits for fonts and image assets.
   - Rasterizes profile charts when required.
   - Converts the report to a PDF using `html2pdf.js`, `html2canvas`, and `jsPDF`.
   - Sends the generated PDF as Base64 through `finalizeWithReport()`.
3. **Apps Script backend (`Code.gs`)**
   - Validates the finalization identity and registered session.
   - Validates the MIME type, Base64 size, and `%PDF-` file signature.
   - Stores the exact browser-generated PDF in Google Drive.
   - Sends the exact same PDF as the parent email attachment.
   - Updates finalization, PDF, and email status in the `Sessions` sheet.

Therefore:

- Report copy, sections, colors, spacing, chart placement, and audience-specific layout must be fixed in the audience render function.
- A4 capture width, page breaks, clipping, image quality, missing assets, chart rasterization, and PDF-only layout must be fixed in `placement-sync.js`.
- Drive storage, attachment validation, email delivery, or final session status must be fixed in `Code.gs`.

### 20.5 Active Final Report Function Map

The function name is the stable search anchor. Line numbers below are a snapshot of the active files on **27 July 2026** and may move after editing.

| Audience      | Active file                          | Final report renderer                  | Current template landmark                                                                                                                           | Report selector       |
| ------------- | ------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Junior, 5–7  | `junior-final-placement-test.html` | `wireStage3()`                       | Function starts near line 1547;`const appContent` starts near line 1817; `appEl.innerHTML = appContent` installs the report                     | `.placement-report` |
| Kids, 8–15   | `kids-final-placement-test.html`   | `finalResult()`                      | Function starts near line 14071;`shell(...)` starts near line 14228; `<article class="placement-report kids-report...">` starts near line 14281 | `.placement-report` |
| Teens, 16–18 | `teens.html`                       | `renderTeensResultReport(container)` | Function starts near line 8319;`container.innerHTML` starts near line 8417; `<article class="teen-report...">` starts near line 8447            | `.teen-report`      |

Important distinctions:

- Junior does not currently have a function named `renderJuniorReport()`. The final report is assembled inside `wireStage3()`.
- Kids contains several embedded functions named `renderResult()`, but they render intermediate stage results. The final placement report is owned by `finalResult()`.
- Teens also contains an intermediate `renderResult(container)`. The final placement report is owned by `renderTeensResultReport(container)`.
- Junior's `.placement-report` lives inside the Stage 3 iframe document. PDF code must use the actual report element and its `ownerDocument`; searching only the outer parent document can cause `placement_report_not_found`.

### 20.6 Shared Browser PDF Functions

The shared source of truth is `placement-sync.js`.

| Function                                 | Current location snapshot             | Responsibility                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createReportPdf(options)`             | `placement-sync.js`, near line 976  | Finds or accepts the report element, clones it into the PDF sandbox, waits for fonts/assets, rasterizes charts, applies export CSS, and returns`{ blob, filename }` |
| `downloadReportPdf(options)`           | `placement-sync.js`, near line 1082 | Creates a temporary`blob:` URL and downloads the generated browser PDF                                                                                              |
| `finalizeWithReport(payload, options)` | `placement-sync.js`, near line 1095 | Generates the same visual PDF, converts it to Base64, adds`payload.pdfAttachment`, and queues the `finalize` operation                                            |

Generated or injected copies of these functions also exist inside the active final HTML artifacts:

| File                                 | `createReportPdf` | `downloadReportPdf` | `finalizeWithReport` |
| ------------------------------------ | ------------------- | --------------------- | ---------------------- |
| `junior-final-placement-test.html` | near line 1129      | near line 1235        | near line 1248         |
| `kids-final-placement-test.html`   | near line 1130      | near line 1236        | near line 1249         |
| `teens.html`                       | near line 1129      | near line 1235        | near line 1248         |

Do not independently hand-edit all embedded copies for a shared PDF behavior change. Update `placement-sync.js`, then use the verified injection/rebuild path for the affected final artifacts and check that only one active sync client/config block remains.

The active PDF capture settings include:

- A4 portrait output.
- Full-bleed report margin where applicable.
- `html2canvas` scale `2`.
- JPEG quality `0.96`.
- A minimum capture width large enough for desktop report layout.
- CSS/legacy page-break handling.
- Explicit page-break-before selectors for report continuation headers.
- Avoid rules for report headers, sections, pillar cards, Learning Path nodes, and two-column sections.

### 20.7 Data Used to Build the Teens Final Report

The Teens visual report is rendered from browser state, not reconstructed by `Code.gs`.

Student identity:

- `name`
- `exactAge`
- `parentEmail` / `emailOrtu`

Stage 1 and pillar profile:

- `scores.logic`
- `scores.creativity`
- `scores.spatial`
- `scores.digital`
- `stage1AdvancedPillarScores`

Placement recommendation:

- `recommendedModule`
- `potentialModule`

Stage 2:

- `stage2Result.assignedModule`
- `stage2Result.level`
- `stage2Result.masteryHighest`
- `stage2Result.challengeCount`
- `stage2Result.submissionCount`
- `stage2Result.lv3Candidate`
- `stage2Result.trail`

Stage 3:

- `stage3Answers`
- `stage3Answers[8]` as the explicit final module/interest confirmation
- `stage3Reason`

The Teens renderer derives:

- four pillar ratios and presentation bands;
- strongest and development-focus pillars;
- assigned module and assigned level;
- Lv3 candidate status;
- confirmed interest;
- official Learning Path ID, name, modules, and source;
- report narrative, radar chart, and report date.

The same general boundary applies to Junior and Kids: their audience renderer owns all report calculations and visible copy, while `Code.gs` receives the completed visual PDF plus a concise result summary.

### 20.8 Finalize API Contract

Before finalization, the session must already be registered through `index.html` using the same `submissionId` and `syncToken`. Opening an audience file directly without a registered session is not sufficient for a production finalization.

Effective finalization envelope:

```js
{
  operationId: "...",
  action: "finalize",
  submissionId: "pt_...",
  syncToken: "...",
  revision: 1234567890,
  payload: {
    parentEmail: "orangtua@email.com",
    result: {
      assignedModule: "Python",
      potentialModule: "Python",
      assignedLevel: "BASIC — Lv2",
      lv3Candidate: false,
      learningPathName: "App Creator Path",
      learningPathModules: ["Scratch", "Python"]
    },
    completedAt: "2026-07-27T10:00:00.000Z",
    pdfAttachment: {
      filename: "Laporan Placement Test - Nama Siswa.pdf",
      mimeType: "application/pdf",
      base64: "JVBERi0x..."
    }
  }
}
```

Required for successful backend finalization:

- `operationId`
- `action: "finalize"`
- `submissionId`
- matching `syncToken`
- a previously registered session
- `parentEmail`, unless it already exists in the registered `Sessions` row
- non-empty `pdfAttachment.base64`
- `pdfAttachment.mimeType` exactly `application/pdf`
- decoded PDF bytes beginning with `%PDF-`

The `result` object is not what draws the visual PDF. It supports the email summary and backend fallbacks. For accurate email content it should include:

- `assignedModule`
- `potentialModule`
- `assignedLevel`
- `lv3Candidate`
- `learningPathName`
- `learningPathModules`

Backend ownership:

| Complaint                                                 | Backend function to inspect                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| Session is rejected or token is invalid                   | `validateOperation_()` and `requireAuthorizedSession_()`       |
| Parent email is missing                                   | `finalize_()` and the registered `Sessions.parent_email` value |
| Visual PDF attachment is missing                          | `finalize_()`                                                    |
| MIME, Base64, size, or PDF signature is rejected          | `pdfBlobFromAttachment_()`                                       |
| PDF filename or Drive duplication is wrong                | `createResultPdf_()`                                             |
| Email HTML summary is wrong                               | `buildEmailBody_()`                                              |
| Drive URL, email status, or final session status is wrong | `finalize_()`                                                    |

### 20.9 Safe PDF Preview Without New Source Files or Production Dev Mode

Layout iteration must not require a student to complete every placement question manually. It must also not require adding a permanent preview file or adding a visible dev mode to an active audience file.

Approved preview workflow:

1. Open the active audience file in an isolated temporary/incognito browser context.
2. Inject a representative placement state at runtime.
3. Temporarily replace `PlacementSync.finalizeWithReport()` and `PlacementSync.finalize()` with preview-only no-op handlers.
4. Temporarily prevent completion helpers from mutating the real placement registration/session.
5. Call the real audience render function:
   - Junior: `wireStage3()` using the staged iframe state.
   - Kids: `finalResult()`.
   - Teens: `render()` with `state.currentStage = 4`, which calls `renderTeensResultReport(container)`.
6. Call the real `PlacementSync.createReportPdf()` using the active report selector or explicit Junior iframe element.
7. Save only the generated preview artifact under a temporary directory such as `/private/tmp/placement-pdf-preview/`.
8. Return a clickable temporary PDF link for visual review.

Safety requirements:

- No Apps Script request.
- No Google Sheet write.
- No Google Drive upload.
- No parent email.
- No permanent repository preview file.
- No permanent dev-mode control in a production audience file.
- No reuse of a real active student's registration/session.

A browser `blob:` URL is valid only for the lifetime of its browser tab and is not shareable. To provide a clickable artifact outside the tab, save the generated blob as a temporary PDF under `/private/tmp`. A persistent Google Drive URL requires an upload/backend action and is not part of this safe preview workflow.

### 20.10 Complaint-to-Code Troubleshooting Map

Use this table before making any report change:

| User complaint                                                                      | First location to inspect                                                                                                                                      | Typical owner                           |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Text, section order, module, level, Learning Path, or narrative is wrong for Junior | `junior-final-placement-test.html` → `wireStage3()` → `appContent`                                                                                     | Junior report renderer                  |
| Text, section order, module, level, Learning Path, or narrative is wrong for Kids   | `kids-final-placement-test.html` → `finalResult()` → `shell(...)`                                                                                      | Kids report renderer                    |
| Text, section order, module, level, Learning Path, or narrative is wrong for Teens  | `teens.html` → `renderTeensResultReport(container)` → `container.innerHTML`                                                                            | Teens report renderer                   |
| Report looks correct on screen but clips, shrinks, or breaks badly in PDF           | `placement-sync.js` → `createReportPdf()` and `installPdfExportStyle()`                                                                                 | Shared browser PDF client               |
| Page 2 starts in the wrong place                                                    | `placement-sync.js` page-break rules plus `.rc-print-continuation`, `.kids-print-continuation`, or `.teen-print-continuation` in the audience template | Shared PDF client and audience template |
| Radar chart is missing or blank in PDF                                              | `placement-sync.js` → `rasterizeProfileCharts()` and the audience `getRadarChart()`                                                                     | Shared PDF client and audience renderer |
| Logo, illustration, or font is missing                                              | `waitForReportAssets()`, font readiness, CORS settings, and the asset URL in the audience renderer                                                           | Shared PDF client and audience template |
| Downloaded PDF differs from the emailed attachment                                  | `finalizeWithReport()` payload, `Code.gs` → `pdfBlobFromAttachment_()`, and actual received email attachment                                            | Browser-to-backend boundary             |
| `placement_report_not_found` occurs for Junior                                    | `wireStage3()` and explicit `reportPdfOptions.element` / `document` for the Stage 3 iframe                                                               | Junior wrapper and shared PDF client    |
| PDF is created but email fails                                                      | `Code.gs` → `finalize_()` and `MailApp.sendEmail()` error/status                                                                                        | Apps Script backend                     |
| Email content is wrong but attachment is correct                                    | `Code.gs` → `buildEmailBody_()`                                                                                                                           | Apps Script email template              |
| Drive file name, duplicate behavior, or URL is wrong                                | `Code.gs` → `createResultPdf_()`                                                                                                                          | Apps Script storage                     |

Acceptance gate:

- Source syntax or injection checks alone are not enough.
- Render the active audience report with representative data.
- Generate the real UI PDF.
- Inspect the PDF pages visually.
- For email parity changes, compare the UI-generated/downloaded PDF with the actual received email attachment before declaring success.

### 20.11 Junior Generation Warning

Junior has a generated/assembled architecture, but this checkout currently contains legacy/ignored generator copies whose report template may not match the newest tracked `junior-final-placement-test.html`.

Rules:

- Treat the active tracked `junior-final-placement-test.html` as the current runtime artifact.
- Search for `wireStage3()` and `const appContent` to locate the current report implementation.
- Do not run a legacy assembler blindly, because it can overwrite the newer active report template.
- Before restoring a generator-based workflow, synchronize the generator's `wireStage3Impl()` template with the active tracked Junior report.
- After synchronization, rebuild and compare generated outputs before accepting them.
- Always browser-test the regenerated Junior wrapper, including the Stage 3 iframe report and PDF creation using the explicit report element.

---

## 21. Branch Dashboard Portal & Authentication Architecture

This section documents the architecture, data security, and API contract for the Branch Placement Test Dashboard Portal (`hasil-placement-test-kalananti.html`) and its Google Apps Script backend endpoints in `Code.gs`.

### 21.1 Overview & Security Model

The Branch Dashboard Portal provides Branch Managers (BM) and SA Kids at each Kalananti branch with secure, branch-scoped access to placement test results without exposing full database spreadsheet edit access or cross-branch data.

- **Frontend File:** [`hasil-placement-test-kalananti.html`](file:///Users/yazidhilmi/Documents/cloud/Kalananti-cloud/Academic_Content/B2C/placement-test/hasil-placement-test-kalananti.html)
- **Authentication:** Token-based session authentication (`DashboardSessions` tab in Google Sheets). Sessions automatically expire after 24 hours.
- **Authorization:** Standard branch users can strictly view data filtered by their authorized branch (`row.branch === authorizedBranch`).

### 21.2 Google Sheets Security & Access Control Tabs

- **`DROPDOWNS`**: Contains master branch names (Column A starting at row 5), authorized BM emails (Column B), and authorized SA Kids emails (Column C).
- **`AccessRequests`**: Audit log recording user requests for branch dashboard access (`requested_at`, `branch`, `name`, `email`, `role`, `status`).
- **`DashboardSessions`**: Active token database (`token`, `branch`, `email`, `role`, `created_at`, `expires_at`).

### 21.3 Apps Script API Endpoint Specifications

The backend handles both `doGet` (for quick branch list retrieval) and `doPost` (for authentication and branch-filtered data access).

#### A. Fetch Branch List (`GET /doGet?action=get_branches`)

- **Parameters:** `action=get_branches`
- **Output:** `{ ok: true, branches: ["Online", "Branch A", ...] }`

#### B. Request Access (`POST /doPost` with `action: 'request_dashboard_access'`)

- **Payload:** `{ action: 'request_dashboard_access', branch, name, email, role }`
- **Behavior:** Appends user credentials to Column B (BM) or Column C (SA Kids) in `DROPDOWNS` if not already registered, and logs entry in `AccessRequests`. Enforces a 5-minute review window for newly registered users.

#### C. Branch Login (`POST /doPost` with `action: 'login_dashboard'`)

- **Payload:** `{ action: 'login_dashboard', branch, email }`
- **Behavior:** Validates email against `DROPDOWNS` for the specified branch. Creates a unique session token in `DashboardSessions` (valid for 24 hours).
- **Output:** `{ ok: true, authenticated: true, token, branch, userEmail, role }`

#### D. Fetch Branch Results (`POST /doPost` or `GET /doGet` with `action: 'get_branch_results'`)

- **Payload:** `{ action: 'get_branch_results', token }`
- **Behavior:** Validates `token` against `DashboardSessions`. Reads `Sessions` tab and returns ONLY records matching the authorized branch.

#### E. Logout (`POST /doPost` with `action: 'logout_dashboard'`)

- **Payload:** `{ action: 'logout_dashboard', token }`
- **Behavior:** Invalidates and deletes the session token from `DashboardSessions`.
