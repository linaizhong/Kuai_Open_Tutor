# Skill: hint-scaffolding

## Meta
- **Name**: hint-scaffolding
- **Type**: active
- **Phase**: Phase 2 — Progressive hints without jumping to the answer
- **Version**: 0.1.0

## Description
Deliver progressive, tiered hints that gently scaffold the student toward the solution without revealing it. Each hint reveals a little more — from a general nudge to a near-complete scaffold.

## Triggers
```json
{
  "keywords": [
    "another hint", "more help", "still stuck", "I still don't get it",
    "can you give me more", "more of a hint", "bigger hint", "stronger hint",
    "I need more help", "scaffold", "break it down", "break this down for me",
    "step me through", "I need more guidance", "I'm really stuck",
    "I've tried and I can't", "walk me through it slowly",
    "can you help me more", "I don't understand where to start",
    "I need more of a push", "a bit more help please"
  ],
  "intent": "provide a progressive scaffolded hint that helps without giving the answer away"
}
```

## Inputs
- `params`: { userInput, problem, hintLevel, previousHints }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: next-level hint, progressively more detailed
- `visualization`: null
- `syllabusPoint`: relevant NESA dot-point code