# Skill: progress-celebration

## Meta
- **Name**: progress-celebration
- **Type**: active
- **Phase**: Phase 3 — Proactively surface improvements to reinforce motivation
- **Version**: 0.1.0

## Description
Proactively identify and celebrate genuine improvements in the student's mastery, velocity, or accuracy — reinforcing a growth mindset and keeping motivation high.

## Triggers
```json
{
  "keywords": [
    "how am I going", "am I improving", "how have I improved",
    "show my progress", "progress", "how much have I improved",
    "am I getting better", "is my hard work paying off",
    "how far have I come", "have I improved", "am I doing well",
    "what have I achieved", "my achievements", "motivate me",
    "encourage me", "cheer me up", "remind me I'm doing well",
    "give me some good news", "any good news about my progress",
    "show me something positive", "what am I good at",
    "what are my strengths", "what have I mastered"
  ],
  "intent": "celebrate and surface genuine improvements in the student's progress"
}
```

## Inputs
- `params`: { userInput }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: personalised celebration of specific, genuine progress
- `visualization`: null
- `syllabusPoint`: null