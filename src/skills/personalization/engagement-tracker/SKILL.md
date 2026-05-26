# Skill: engagement-tracker

## Meta
- **Name**: engagement-tracker
- **Type**: passive
- **Phase**: Phase 4 — Passive personalisation
- **Version**: 0.1.0

## Description
Silently monitors engagement signals across the session — response length, question skip rate, consecutive errors, and time patterns — and updates the student's affective state profile.

## Triggers
```json
{
  "keywords": [],
  "intent": ""
}
```

Note: This is a passive skill. It runs automatically after every interaction and produces no direct output to the student.

## Signals Observed
- High recent success rate (>70%) and longer responses → confident / focused
- Low recent success rate (<30%) and shorter responses → frustrated / disengaged
- Student expressing negative emotion keywords → frustrated signal
- Multiple consecutive skips or "I don't know" → disengaged signal
- Long session with sustained accuracy → focused/in-flow signal

## Inputs
- `params`: { userInput, response, isCorrect, sessionAttempts, recentSuccessRate }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `memoryUpdates`: { type: "affectiveState", signal: { engagement: "focused"|"frustrated"|"fatigued"|"confident"|"disengaged", sessionAttempts, recentSuccessRate, notes } }