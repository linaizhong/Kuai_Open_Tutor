# Skill: session-planner

## Meta
- **Name**: session-planner
- **Type**: active
- **Phase**: Phase 2 — Plan session based on history, mastery gaps, and exam timeline
- **Version**: 0.1.0

## Description
Plan the current study session by analysing the student's mastery gaps, recent velocity, exam date, and available time — then recommending what to focus on and in what order.

## Triggers
```json
{
  "keywords": [
    "what should I study", "what should I do today", "plan my session",
    "study plan", "what should I focus on", "where should I start",
    "what do I need to work on", "what are my weaknesses",
    "plan for today", "session plan", "study schedule",
    "what to study today", "help me plan", "what's most important",
    "prioritise", "what should I prioritise", "best use of my time",
    "I have an hour", "I have 30 minutes", "I have 2 hours",
    "what should I revise", "revision plan", "study for the exam"
  ],
  "intent": "create a personalised study session plan based on mastery gaps and exam timeline"
}
```

## Inputs
- `params`: { userInput, availableMinutes }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: structured session plan with prioritised topics and time allocation
- `visualization`: null
- `syllabusPoint`: null