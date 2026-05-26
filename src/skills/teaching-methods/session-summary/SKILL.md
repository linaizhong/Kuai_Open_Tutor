# Skill: session-summary

## Meta
- **Name**: session-summary
- **Type**: active
- **Phase**: Phase 3 — Summarise what was covered and what to revisit
- **Version**: 0.1.0

## Description
Generate a concise summary of the current study session — what topics were covered, questions attempted, accuracy, and what to revisit next time.

## Triggers
```json
{
  "keywords": [
    "session summary", "summarise", "summary", "what did we cover",
    "what did I do today", "wrap up", "let's wrap up", "end of session",
    "what did we do", "recap the session", "session recap",
    "what have we covered", "what topics did we do",
    "how did I go today", "how was my session", "session report",
    "what should I do next time", "what to focus on next",
    "what to do tomorrow", "end this session", "I'm done for today",
    "that's it for today", "finishing up", "before I go"
  ],
  "intent": "summarise the session and recommend what to focus on next time"
}
```

## Inputs
- `params`: { userInput }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: session summary with topics covered, accuracy, and next-session recommendations
- `visualization`: null
- `syllabusPoint`: null