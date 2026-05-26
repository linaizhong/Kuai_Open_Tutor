# Skill: detect-learning-style

## Meta
- **Name**: detect-learning-style
- **Type**: passive
- **Phase**: Phase 4 — Passive personalisation
- **Version**: 0.1.0

## Description
Silently observes each interaction and updates the student's learning style profile. Detects whether the student responds better to visual, algebraic, or numerical representations based on their questions and engagement patterns.

## Triggers
```json
{
  "keywords": [],
  "intent": ""
}
```

Note: This is a passive skill. It runs automatically after every interaction and produces no direct output to the student.

## Signals Observed
- Student asks for graphs or diagrams → visual preference signal
- Student asks for "the formula" or algebraic form → algebraic preference signal
- Student asks to "try with numbers" or uses specific examples → numerical preference signal
- Student engages positively (correct answer) after a particular representation → reinforce that style
- Student expresses confusion after a particular representation → flag that style as weak

## Inputs
- `params`: { userInput, response, skillUsed, isCorrect }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `memoryUpdates`: { type: "learningStyle", signal: { preferredRepresentation, respondsWellTo, strugglesWith } }