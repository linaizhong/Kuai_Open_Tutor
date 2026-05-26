# Skill: generate-quiz

## Meta
- **Name**: generate-quiz
- **Type**: active
- **Category**: assessment
- **Version**: 3.0.0

## Description
Generate a single practice question tailored to the student's current subject, mastery level, learning style, and knowledge gaps. Automatically detects the active subject from the knowledge base and generates an appropriately formatted question with marks, marking criteria, and a hint.

## Triggers
```json
{
  "keywords": [
    "quiz", "test", "practice questions", "practice problems",
    "give me a question", "test me", "practice", "question",
    "give me some problems", "practice question", "test my knowledge",
    "quiz me", "generate a question", "practice problem",
    "harder question", "easier question", "similar question"
  ],
  "intent": "generate a practice question for the current subject"
}
```

## Workflow

1. **Detect the active subject** — check in this priority order:
    - `context.knowledgeBase.subjectId`
    - `context.studentModel.activeSubject`
    - `context.memory.getActiveSubject()` if available
    - If none found, use the first available subject from knowledge base

2. **Load subject configuration** — from `context.knowledgeBase.subjectConfig` or fallback to defaults:
    - Question format template
    - Marking criteria style
    - Available question types
    - Subject-specific keywords and terminology

3. **Select the target knowledge point** — use the first that applies:
    - `params.dotPoint` if explicitly provided
    - Infer from `params.userInput` by matching against subject keywords
    - The first entry of `context.studentModel.weakestTopics`
    - Leave unspecified and let the question generation choose freely based on subject context

4. **Determine difficulty** — use the first that applies:
    - Detect an explicit request in `params.userInput` using subject-agnostic keywords:
        - words like "harder", "hard", "difficult", "challenge", "tough" → `hard`
        - words like "easier", "easy", "simpler", "simple", "basic" → `easy`
        - words like "similar", "same level", "medium" → `medium`
    - `params.difficulty` if provided
    - `params.currentDifficulty` from session state
    - Derive from mastery score for the target point (0.0–1.0 scale):
        - score < 0.40 → `easy`
        - score 0.40–0.70 → `medium`
        - score > 0.70 → `hard`
    - Default to `medium`

5. **Try to serve a pre-existing question** — if the knowledge base has a question bank:
    - Filter candidates that: are not in `params.usedQuestionIds`; match difficulty level; match target knowledge point or topic
    - Prefer exact matches; pick randomly from the best pool
    - If a KB question is found, format it using the subject's configured template and return immediately — no LLM generation needed

6. **If no KB question found, generate one with the LLM** — build the prompt using:
    - Subject context from `context.knowledgeBase.subjectConfig`:
        - Subject name and description
        - Question format instructions
        - Marking criteria style guide
        - Example questions if available
    - Difficulty level with generic description
    - Learning style from `context.studentModel.learningStyle.preferredRepresentation`:
        - `visual` → frame the question around visual elements if appropriate for the subject
        - `numerical` → use specific values rather than abstract notation
    - Engagement tone from `context.studentModel.affectiveState.currentEngagement`:
        - `frustrated` → add encouraging framing
        - `confident` → question may be slightly more challenging
    - Topic context from knowledge base
    - Mistake targeting if available
    - Variety note if many questions have been used
    - Use the **Generic Question Format** from Notes for the required output structure

7. **Return the result** in the standard output shape (see Outputs)

## Inputs
- `params`: { userInput, difficulty, topic, dotPoint, currentDifficulty, usedQuestionIds }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: formatted question with marks, marking criteria, and hint
- `visualization`: null
- `syllabusPoint`: knowledge point identifier targeted by the question (or null)
- `questionId`: knowledge base question ID if served from question bank (or null)
- `difficulty`: the actual difficulty level used (`easy`, `medium`, or `hard`)
- `source`: `knowledge-base` if served from KB, `generated` if LLM-generated

## Notes

### Subject Configuration
Each subject in the knowledge base should provide a `subjectConfig` object with:

```json
{
  "subjectId": "unique-identifier",
  "name": "Display Name",
  "questionFormat": {
    "template": "**Question:**\n{question}\n\n**Marks:** {marks}\n\n**Marking Criteria:**\n{criteria}\n\n**Hint:**\n{hint}",
    "mathNotation": "latex",
    "mathDelimiters": {
      "inline": ["$", "$"],
      "display": ["$$", "$$"]
    },
    "marksIncluded": true,
    "criteriaIncluded": true,
    "hintIncluded": true
  },
  "difficultyLevels": ["easy", "medium", "hard"],
  "defaultDifficulty": "medium"
}
```

### Generic Question Format
Instruct the LLM to respond with the following structure, adapting to the subject's configuration:

```
**Question:**
[The question text. 
 - If the subject uses LaTeX notation (maths, physics, etc.), wrap all mathematical expressions in the configured delimiters (e.g., $...$)
 - If the subject uses plain text, use appropriate notation (e.g., x^2 for squared)
 - Include all necessary context, data, or references]

**Marks:** [number]

**Marking Criteria:**
[Bullet-point list of what a full-mark answer must include]

**Hint:**
[A single sentence that nudges the student toward the method without giving it away]
```

### LaTeX Guidelines (for subjects that use it)
When the subject configuration specifies `mathNotation: "latex"`, ALL mathematical expressions MUST be wrapped in the configured delimiters:

- Use `$x^2$` for x squared
- Use `$\int$` for integral symbols
- Use `$\frac{a}{b}$` for fractions
- Use `$\sqrt{x}$` for square roots
- Use `$\sum$` for summation
- Use `$\lim_{x \to a}$` for limits
- Use `$f(x)$` for functions
- Use `$\sin$`, `$\cos$`, `$\tan$` for trigonometric functions
- Use `$\log$`, `$\ln$` for logarithms

### Unicode Guidelines (for subjects that use it)
When the subject configuration specifies `mathNotation: "unicode"`, use appropriate Unicode symbols:
- Use `∫` for integral symbols
- Use `²` for squared (or `^2` for clarity)
- Use `√` for square roots
- Use `∑` for summation
- Use `→` for arrows

### Plain Text Guidelines (for subjects that use it)
When the subject configuration specifies `mathNotation: "plain"`, use clear plain text notation:
- Use `x^2` for x squared
- Use `integral of` for integrals
- Use `sqrt(x)` for square roots
- Use `sum of` for summation

### Example Generated Questions

**For a mathematics subject (using LaTeX):**
```
**Question:**
Evaluate the integral $\int_0^1 (x^2 + 1) \, dx$.

**Marks:** 3

**Marking Criteria:**
- Correctly set up the definite integral
- Apply the power rule correctly to get $\frac{x^3}{3} + x$
- Evaluate at limits: $[\frac{1^3}{3} + 1] - [\frac{0^3}{3} + 0] = \frac{4}{3}$

**Hint:**
Remember that $\int x^n \, dx = \frac{x^{n+1}}{n+1} + C$, but for definite integrals, the constant cancels out.
```

**For a chemistry subject (using plain text with Unicode):**
```
**Question:**
Balance the following chemical equation: 
H₂ + O₂ → H₂O

**Marks:** 2

**Marking Criteria:**
- Correct coefficients for all reactants and products
- Equation is balanced (same number of each atom on both sides)

**Hint:**
Start by balancing oxygen atoms, then hydrogen.
```

**For a history subject (using plain text):**
```
**Question:**
Explain the main causes of World War I.

**Marks:** 5

**Marking Criteria:**
- Discuss at least three major causes
- Explain how each cause contributed to the outbreak
- Use specific historical evidence

**Hint:**
Consider both long-term factors (alliances, nationalism) and the immediate trigger.
