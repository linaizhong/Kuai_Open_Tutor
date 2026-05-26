# Skill: socratic-questioning

## Meta
- **Name**: socratic-questioning
- **Type**: active
- **Phase**: Phase 1 — Guide student to derive answer through questions
- **Version**: 0.1.0

## Description
Guide the student to discover the answer themselves through carefully chosen questions, without giving the solution directly. Builds deep understanding rather than dependence.

## Triggers
```json
{
  "keywords": [
    "hint", "clue", "guide me", "help me think", "I'm stuck", "stuck",
    "don't tell me the answer", "help me figure out", "what should I do",
    "where do I start", "I don't know where to begin", "nudge me",
    "point me in the right direction", "don't just give me the answer",
    "help me work it out", "how do I approach", "where do I begin",
    "I need a hint", "just a hint", "give me a clue", "prompt me",
    "help me think through", "what's the first step", "what should I try"
  ],
  "intent": "give the student a guiding hint or question without revealing the answer"
}
```

## Inputs
- `params`: { userInput, problem, currentAttempt }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: Socratic guiding question or hint
- `visualization`: null
- `syllabusPoint`: relevant NESA dot-point code
