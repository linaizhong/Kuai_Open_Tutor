# Skill: adaptive-drill

## Meta
- **Name**: adaptive-drill
- **Type**: active
- **Category**: core
- **Phase**: Phase 2 — Dynamically adjust difficulty based on performance
- **Version**: 1.0.0

## Description
Run a focused drill session that automatically adjusts question difficulty up or down based on the student's performance, targeting their specific weak areas. Presents one question at a time in authentic HSC exam style.

## Triggers
```json
{
  "keywords": [
    "drill", "drilling", "keep going", "more of the same", "harder",
    "make it harder", "too easy", "give me harder questions",
    "adjust difficulty", "I'm getting them all right", "I need more challenge",
    "easier", "make it easier", "too hard", "give me easier questions",
    "I keep getting these wrong", "focus on my weak areas",
    "target my weaknesses", "rapid fire", "quick questions",
    "keep practising", "more practice on", "intensive practice"
  ],
  "intent": "run an adaptive drill session that adjusts difficulty to the student's level"
}
```

## Workflow

1. Identify the student's target dot-point from their weak areas or explicit request
2. Check their recent accuracy on that dot-point to determine appropriate difficulty
3. If accuracy >= 80% — step UP the difficulty and briefly acknowledge their progress
4. If accuracy <= 40% — step DOWN the difficulty and normalise the struggle
5. Otherwise — hold the current difficulty level without comment
6. If a real past-paper question exists for this dot-point and difficulty — use it exactly
7. Otherwise — generate a new question in authentic HSC exam style for the difficulty level
8. Present exactly ONE question — do not answer it or provide hints unless asked
9. End with: "Take your time — show your working when you're ready."

## Inputs
- `params`: { userInput, dotPoint, currentDifficulty, sessionAttempts, usedQuestionIds }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: the drill question presented to the student at the adjusted difficulty
- `visualization`: null
- `syllabusPoint`: NESA dot-point code being drilled

## Notes
- Present ONLY one question per call — never multiple questions at once
- Do NOT reveal the answer or provide working unless the student explicitly asks
- For easy difficulty: straightforward single-concept application, 1–2 marks
- For medium difficulty: multi-step working required, 2–3 marks
- For hard difficulty: non-routine problem requiring synthesis of concepts, 3–4 marks
- For multiple-choice questions: always list all options A, B, C, D
- Never step UP difficulty if the student is frustrated or fatigued
- If the student is frustrated: be warm, patient, and normalise mistakes before the question
- If the student is fatigued: keep the question and any narration very short
