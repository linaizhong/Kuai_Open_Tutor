# Skill: exam-technique-coach

## Meta
- **Name**: exam-technique-coach
- **Type**: active
- **Category**: core
- **Version**: 2.0.0

## Description
Coach the student on HSC exam technique — how to present working, manage time, maximise marks on multi-part questions, and avoid common presentation mistakes that cost marks.

## Triggers
```json
{
  "keywords": [
    "exam technique", "exam strategy", "how to show working", "presentation",
    "how to write my answer", "time management", "how much time",
    "how long should I spend", "exam tips", "how to answer",
    "what should I write", "do I need to show working",
    "can I skip steps", "how detailed", "how to set out",
    "exam advice", "exam preparation", "HSC tips", "exam tricks",
    "how to get full marks", "presentation marks", "how to lay out",
    "marking sees", "what do markers want", "how does the marker mark",
    "what does the examiner want", "how to write solutions"
  ],
  "intent": "advise on HSC exam technique, working presentation and time management"
}
```

## Workflow

1. **Detect the question type** from `params.questionType` if provided, otherwise infer from `params.userInput`:
   - contains `differentiat`, `integrat`, `calculus`, `dy/dx`, `d/dx`, `turning point`, or `rate of change` → `calculus`
   - contains `statistic`, `probability`, `normal distribution`, `z-score`, `sample`, `mean`, `median`, or `standard deviation` → `statistics`
   - contains `financial`, `annuity`, `loan`, `compound interest`, `future value`, `present value`, or `superannuation` → `financial`
   - contains `trig`, `sin`, `cos`, `tan`, `angle`, `radian`, `ASTC`, or `unit circle` → `trigonometry`
   - contains `function`, `domain`, `range`, `inverse`, `composite`, or `f(x)` → `functions`
   - contains `part [a-e]`, `multiple part`, `section ii`, or `extended response` → `multi-part`
   - otherwise → `general`

2. **Calibrate advice depth** from `context.studentModel.overallMastery`:
   - mastery < 0.50 → keep advice practical and concrete — focus on the basics of what to write rather than advanced strategy
   - mastery 0.50–0.75 → focus on presentation polish and common mark-dropping habits
   - mastery > 0.75 → focus on maximising marks through presentation, time strategy, and avoiding careless errors
   - mastery unknown → give balanced general advice

3. **Apply urgency framing** if `context.studentModel.weeksRemaining` is ≤ 6 — note that the exam is that many weeks away and prioritise the highest-impact tips

4. **Apply tone** from `context.studentModel.affectiveState.currentEngagement`:
   - `frustrated` → keep advice calm, reassuring, and easy to action
   - otherwise → use a clear, practical, coach-like tone

5. **Generate the coaching response** using all of the above context, following these strict requirements:
   - Be specific to HSC Mathematics Advanced marking conventions (NESA 2017 syllabus)
   - Give concrete examples of what to write vs what NOT to write wherever possible
   - Cover all three of: (1) what working to show, (2) how markers award marks, (3) common presentation errors that lose marks
   - If question type is not `general`, name it explicitly at the start (see **Question Type Labels** in Notes)
   - Limit advice to 3–5 actionable points maximum — quality over quantity
   - Use plain text maths (e.g. `x^2`, `dy/dx`, `sqrt(x)`) — no LaTeX backslash commands
   - Do NOT restate the student's question — dive straight into the advice
   - End with a single `Examiner's tip:` line giving the single most important piece of advice for this question type

## Inputs
- `params`: { userInput, questionType, topic }
- `context`: { studentId, studentModel, model, knowledgeBase }

## Outputs
- `result`: exam technique advice tailored to the question type and student level
- `visualization`: null
- `syllabusPoint`: null

## Notes

### Question Type Labels
Use these display names when naming the detected question type in the response:

| Detected type | Display name |
|---|---|
| `calculus` | Calculus (differentiation, integration, rates of change) |
| `statistics` | Statistical Analysis |
| `financial` | Financial Mathematics |
| `trigonometry` | Trigonometric Functions |
| `functions` | Functions |
| `multi-part` | multi-part / extended response questions |
| `general` | (do not name a type — give general HSC exam technique advice) |
