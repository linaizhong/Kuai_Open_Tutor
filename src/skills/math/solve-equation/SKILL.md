# Skill: solve-equation

## Meta
- **Name**: solve-equation
- **Type**: active
- **Phase**: Phase 1 — Original
- **Version**: 0.1.0

## Description
Solve algebraic equations step by step, including linear, quadratic, simultaneous and trigonometric equations.

## Triggers
```json
{
  "keywords": [
    "solve", "solve for", "find x", "find the value", "what is x", "calculate x",
    "solve the equation", "solve this equation", "find the solution",
    "solve simultaneously", "simultaneous equations", "solve the system",
    "roots of", "find the roots", "solutions to", "solve for y",
    "what are the values", "linear equation", "quadratic equation"
  ],
  "intent": "solve an algebraic or mathematical equation"
}
```

## Inputs
- `params`: { userInput, equation }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: full step-by-step solution
- `visualization`: null
- `syllabusPoint`: relevant NESA dot-point code if applicable