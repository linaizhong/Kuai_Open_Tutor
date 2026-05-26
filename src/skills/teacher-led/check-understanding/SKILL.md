# Skill: check-understanding

## Meta
- **Name**: check-understanding
- **Type**: active
- **Category**: core
- **Phase**: Teacher-Led mode - Check student understanding after explanation
- **Version**: 2.0.0

## Description
Generate questions to check student understanding of a concept and evaluate their responses. Used in Teacher-Led mode after explanations and in Test-Led mode to assess answers. Supports multiple-choice and open-ended questions with difficulty levels adapted to the student model. When evaluating answers, returns clear, student-friendly feedback — not raw rubric output.

## Triggers
```json
{
  "keywords": [
    "check understanding", "do you understand", "test me",
    "quiz me", "question", "practice question", "check",
    "evaluate", "assessment", "test my knowledge"
  ],
  "intent": "check student understanding of a topic"
}
```

## Inputs
- `params.action`: 'generate' | 'evaluate' | 'generate-multiple'
- `params.topic`: topic code to check (e.g. 'MA-C1')
- `params.studentAnswer`: student's answer text (for evaluate action)
- `params.question`: the question object being evaluated (for evaluate action)
- `params.questionType`: 'auto' | 'open' | 'multiple-choice'
- `params.difficulty`: 'easy' | 'medium' | 'hard'
- `params.count`: number of questions for generate-multiple
- `params.activeSubject`: current subject identifier
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs

### For action: 'generate'
```json
{
  "result": "question text",
  "question": {
    "question": "string",
    "type": "open|multiple-choice",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "string",
    "explanation": "string",
    "difficulty": "easy|medium|hard"
  },
  "action": "generated",
  "topic": "topic-code",
  "isCorrect": null,
  "score": null,
  "feedback": null
}
```

### For action: 'evaluate'
```json
{
  "result": "student-friendly feedback text",
  "isCorrect": true,
  "score": 0.85,
  "feedback": "student-friendly feedback text (same as result)",
  "action": "evaluated",
  "topic": "topic-code"
}
```

## Workflow

### For action: 'generate'
1. Read `activeSubject` to set subject context
2. Generate a question appropriate for the topic and difficulty
3. For multiple-choice: provide 4 options with one correct answer
4. Return structured question object

### For action: 'evaluate'
1. Read the question text and correct answer from `params.question`
2. Read the student's answer from `params.studentAnswer`
3. Determine if the answer is correct (isCorrect: true/false)
4. Assign a score from 0.0 to 1.0
5. Write feedback in **student-friendly language** — see Feedback Format below
6. Return structured evaluation

## Feedback Format (for evaluate action)

**CRITICAL**: Write feedback as if speaking directly to the student — warm, encouraging, and specific. Do NOT return a numbered rubric or structured assessment report.

### Correct answer feedback template:
```
[Strength acknowledgement — what they did well, specifically]

[Optional: one deeper insight or connection to broaden understanding]
```

### Incorrect answer feedback template:
```
[Acknowledge the attempt positively if possible]

[Clear explanation of what was missing or wrong — one or two sentences]

[The correct approach or answer — briefly]
```

### Feedback rules:
- NEVER use numbered lists like "1. Whether it demonstrates understanding: True"
- NEVER use headers like "**Specific Feedback:**" or "**Score:**"
- NEVER start with "The student..." — write to the student, not about them
- DO use "you" and "your" — address them directly
- DO be specific — reference the actual question and their actual answer
- DO keep it under 100 words — concise is better
- DO end on an encouraging note for incorrect answers

### Good feedback examples:

For a correct maths answer:
```
You've correctly applied the chain rule here — well done! Identifying that sin(2x+3) is a composite function is the key insight most students miss. Your answer of 2cos(2x+3) is exactly right.
```

For an incorrect maths answer:
```
Good attempt at using the power rule! You correctly found the antiderivative terms, but check your evaluation at the limits — you need to substitute x=1 and x=0 and subtract. Try [1/4 - 2 + 5] - [0] = 13/4.
```

For a correct English answer:
```
Excellent analysis — you've identified the metaphor and explained its effect on the reader clearly. Connecting it to the author's purpose shows strong critical thinking.
```

For an incorrect English answer:
```
You've spotted the right technique (metaphor) but the explanation needs more depth. Focus on *why* the author chose this technique — what effect does it create for the reader? Try to connect it to the text's broader theme.
```

## Notes
- Always prioritise student-friendly language in evaluate responses
- Score 1.0 = fully correct; 0.5 = partially correct; 0.0 = incorrect
- For open-ended questions, partial credit (0.3–0.8) is appropriate when the student shows understanding but misses something
- The `feedback` field and `result` field should contain the same student-friendly text
- Do NOT include raw assessment rubrics in the output
