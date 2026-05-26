# Skill: error-analysis

## Meta
- **Name**: error-analysis
- **Type**: active
- **Category**: core
- **Version**: 2.0.0

## Description
Diagnose the type and cause of a student's mistake — whether it is conceptual (misunderstood the idea), computational (arithmetic slip), or a misread of the question — and explain how to avoid it.

## Triggers
```json
{
  "keywords": [
    "wrong", "mistake", "error", "incorrect", "where did I go wrong",
    "what did I do wrong", "why is this wrong", "check my answer",
    "what went wrong", "fix my", "my answer is wrong", "I made a mistake",
    "why did I get this wrong", "what is my mistake", "I got the wrong answer",
    "where is my error", "what error did I make", "why is my answer wrong",
    "diagnose", "find my mistake", "spot my error", "I messed up",
    "something is wrong with my working", "my working is wrong"
  ],
  "intent": "diagnose an error or mistake in student working or answer"
}
```

## Workflow

1. Identify the dot-point being tested: infer it from the student's working or answer by matching topic keywords (e.g. "sin rule", "domain", "gradient") to NESA syllabus topics — or use `params.dotPoint` if already provided
2. Check the student's mistake history on that dot-point (from `context.studentModel.mistakeSummary`) to see if this is a recurring error pattern
3. Read the student's engagement state from `context.studentModel.affectiveState.currentEngagement` and adjust tone accordingly:
   - `frustrated` → lead with empathy, acknowledge that finding mistakes is hard, be concise, end with one clear actionable fix
   - `confident` AND more than 10 total past mistakes diagnosed → be direct and efficient, minimal cushioning
   - otherwise → be encouraging and direct, normalise mistakes as part of learning
4. Classify the mistake into exactly one of these three types:
   - **Conceptual** — student misunderstood a rule, definition, or concept (e.g. applied sin rule instead of cosine rule; confused domain with range)
   - **Computational** — student understood the method but made an arithmetic or algebraic slip (e.g. sign error, wrong arithmetic, dropped a term)
   - **Misread** — student answered something different from what was asked (e.g. found gradient instead of equation of tangent; gave x-intercept instead of y-intercept)
5. If the student has made the same error type on this dot-point before, call this out explicitly — note whether the same conceptual gap appears to be recurring
6. Produce a response using EXACTLY the four-section structure below — no additions, no omissions
7. After the four sections, add one final line with a specific exam technique tip to prevent recurrence
8. Keep the total response under 200 words — sharp and targeted
9. Do NOT re-solve the problem unless it is essential to explain the error

## Inputs
- `params`: { userInput, studentAnswer, correctAnswer, studentWorking, dotPoint }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: structured four-section error diagnosis (see format in Notes)
- `visualization`: null
- `syllabusPoint`: relevant NESA dot-point code inferred from the question content

## Notes

### Required Output Format
Always use exactly these four sections in this order:

```
**Error Type:** [Conceptual | Computational | Misread]
**What Went Wrong:** [One clear sentence naming the specific mistake]
**Why It Happened:** [The underlying misunderstanding or slip — 2–3 sentences]
**How To Fix It:** [Concrete, actionable advice — what to do differently next time]

**To avoid this in future:** [One specific exam technique tip]
```

Do NOT use any other structure. Do NOT omit any section. Do NOT add extra sections.

### Tone Rules
- If student is `frustrated`: open with empathy before the diagnosis — one sentence acknowledging the difficulty. Keep everything concise.
- If student is `confident` and experienced (many past mistakes diagnosed): skip the encouragement, go straight to the diagnosis.
- Otherwise: be warm but efficient. One sentence normalising mistakes is enough before the structured output.

### Difficulty Calibration by Error Type
- **Conceptual errors**: explain the correct rule or definition clearly; link it back to why the student's version was wrong
- **Computational errors**: pinpoint the exact step where the slip occurred; give a checking strategy (e.g. "substitute your answer back in")
- **Misread errors**: quote what the question actually asked vs what the student answered; suggest re-reading the final line of a question before starting

### Context to Use
- If `studentWorking` is provided, diagnose from the working first — it reveals the error type most clearly
- If only `studentAnswer` and `correctAnswer` are provided, infer the likely error type from the gap between them
- If only `userInput` is provided (student describing the issue), diagnose from their description
- If `knowledgeBase.dotPoints[code].commonErrors` is available for the inferred dot-point, check whether the student's mistake matches a known common error for that topic and mention it if so
