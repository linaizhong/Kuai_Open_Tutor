# Skill: past-paper-practice

## Meta
- **Name**: past-paper-practice
- **Type**: active
- **Category**: core
- **Version**: 2.0.0

## Description
Serve authentic HSC past paper questions from the knowledge base, filtered by year, topic, dot-point, difficulty, and section. Supports optional timed mode using the HSC standard of 1.5 minutes per mark. Falls back to an LLM-generated question in authentic past-paper style when no KB question matches.

## Triggers
```json
{
  "keywords": [
    "past paper", "past exam", "HSC question", "exam question",
    "past paper question", "real exam", "previous exam", "HSC exam practice",
    "2023 question", "2022 question", "2021 question", "2020 question",
    "section I", "section II", "multiple choice question", "short answer question",
    "extended response", "from the exam", "actual exam question",
    "official question", "NESA question", "timed", "under exam conditions",
    "exam practice", "practise for the exam", "exam style question"
  ],
  "intent": "practice with a real HSC past paper exam question"
}
```

## Workflow

1. **Parse the user request** from `params.userInput` (use explicit `params` overrides where provided):
   - **Year**: `params.year` if set; otherwise look for a 4-digit year matching `20XX` in the input (e.g. "from 2022" → `2022`)
   - **Section**: `params.section` if set; otherwise detect:
     - `section ii`, `short answer`, `extended response`, or `working required` → `II`
     - `section i`, `multiple choice`, or `mc` → `I`
     - neither → null (no section filter)
   - **Timed mode**: `params.timed` if set; otherwise detect words `timed`, `timer`, `time me`, `exam conditions`, or `time limit` → `true`; otherwise `false`

2. **Identify the target dot-point and topic** — use the first that applies:
   - `params.dotPoint` if provided
   - Keyword-match `params.topic` or `params.userInput` against `context.knowledgeBase.dotPoints[code].keywords` (highest keyword hit count wins; ignore if score is 0)
   - Extract the topic prefix from the dot-point code (e.g. `MA-C` from `MA-C1.3`) as `targetTopic`

3. **Determine difficulty** — use the first that applies:
   - `params.difficulty` if provided
   - Detect explicit request in `params.userInput`:
     - `hard`, `difficult`, `challenge`, `tough`, `harder` → `hard`
     - `easy`, `simple`, `basic`, `easier`, `straightforward` → `easy`
     - `medium`, `moderate`, `middle` → `medium`
   - Derive from `context.studentModel.masteryProfile[dotPointCode]` if available:
     - score < 0.40 → `easy`; score 0.40–0.70 → `medium`; score > 0.70 → `hard`
   - Derive from `context.studentModel.overallMastery` using the same thresholds
   - Default to `medium`

4. **Select a question from the knowledge base** — if `context.knowledgeBase.questionIndex` and `context.knowledgeBase.questions` exist:
   - Apply hard filters first (reject if any condition fails):
     - Not in `params.usedQuestionIds`
     - If year was requested: `q.year === year`
     - If section was requested: `q.section === section`
     - Difficulty within ±1 level of target (e.g. target `medium` accepts `easy`, `medium`, or `hard`)
   - From the remaining pool, pick the best available sub-pool in this priority order:
     1. Exact dot-point match (`q.dotPoints` includes `targetDotPoint`)
     2. Same topic match (`q.topic === targetTopic`)
     3. Exact difficulty match (`q.difficulty === difficulty`)
     4. Any remaining question in the pool
   - Pick randomly from the chosen sub-pool
   - If a KB question is found, format it using the **KB Question Format** in Notes and return immediately (skip Step 5)

5. **If no KB question found, generate one with the LLM**:
   - Apply tone: if `context.studentModel.affectiveState.currentEngagement` is `frustrated`, prefix the response with a brief warm framing: *"Here's a solid past-paper style question for you."*
   - Build the user message:
     - State the difficulty and section (see **Section Labels** in Notes)
     - If year was requested, add: "in the style of [year] HSC"
     - If dot-point data is available, include: topic code, name, and up to 3 key concepts
     - Otherwise, include the student's raw message and instruct the LLM to infer the most relevant topic
   - Use the **LLM Fallback Output Format** from Notes
   - Note: timed mode is **not** applied to LLM-generated questions since marks are uncertain

6. **Return** the result in the standard output shape (see Outputs)

## Inputs
- `params`: { userInput, year, topic, dotPoint, difficulty, timed, usedQuestionIds }
- `context`: { studentId, studentModel, model, knowledgeBase }

## Outputs
- `result`: formatted question text ready to display to the student
- `visualization`: null
- `syllabusPoint`: NESA dot-point code for the question (or null)
- `questionId`: KB question ID if served from the knowledge base (for marking-guideline-feedback to look up); null if LLM-generated
- `timedMode`: `{ minutes, seconds }` if timed mode is active and question is from KB; null otherwise
- `source`: `past-paper` if from KB, `generated` if LLM-generated

## Notes

### Timed Mode Calculation
HSC standard: ~1.5 minutes per mark (90 seconds), rounded to nearest 30 seconds.

| Marks | Time |
|---|---|
| 1 | 1 min 30 sec |
| 2 | 3 min |
| 3 | 4 min 30 sec |
| 4 | 6 min |
| 5 | 7 min 30 sec |

Formula: `totalSeconds = round((marks × 90) / 30) × 30`

### KB Question Format
Assemble this directly from the KB question object — no LLM needed:

```
**HSC [q.year] — Question [q.questionNumber] (Section [q.section])**  *(representative question — modelled on authentic HSC style)*  [if q.source === 'representative']
**Marks:** [q.marks]

[q.stem]

  **A)** [option A]
  **B)** [option B]
  **C)** [option C]
  **D)** [option D]
[only if q.options exists]
```

**If timed mode is active**, append:
```
⏱ **Timed mode:** You have **[X min Y sec]** for this question.
_Show all working. When you're done, share your answer and I'll mark it against the official criteria._
```

**If not timed**, append:
```
Take your time — show all working when you're ready and I'll give you detailed feedback.
```

### LLM Fallback Output Format
Instruct the LLM to respond with exactly:

```
**HSC [year] — Question [number] (Section [I or II])**
**Marks:** [number]

[Question stem — plain text maths only, no LaTeX backslash commands]

[For multiple choice: list options A) B) C) D)]

Take your time — show all working when you're ready and I'll give you detailed feedback.
```

Requirements: mirror the vocabulary and structure of real HSC Mathematics Advanced exams; fully self-contained question; difficulty consistent with requested level; do NOT include the answer or solution.

### Section Labels
Use these in the LLM fallback user message:

| Detected section | Label to use |
|---|---|
| `I` | Section I (multiple choice, 1 mark) |
| `II` | Section II (short answer or extended response) |
| null | any section |
