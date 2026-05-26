# Skill: cognitive-load-monitor

## Meta
- **Name**: cognitive-load-monitor
- **Type**: passive
- **Phase**: Phase 4 — Passive personalisation
- **Version**: 0.1.0

## Description
Silently monitors attempt patterns to detect cognitive fatigue or overload — such as a sudden drop in accuracy, increasing errors on previously mastered topics, or very short responses. Signals the coordinator to simplify or take a break.

## Triggers
```json
{
  "keywords": [],
  "intent": ""
}
```

Note: This is a passive skill. It runs automatically after every interaction and produces no direct output to the student.

## Signals Observed
- Accuracy drops sharply within a single session (e.g. was 80%, now 30%) → overload signal
- Student makes errors on topics they previously had high mastery → fatigue signal
- Student responses become very short or one-word → disengagement/fatigue signal
- Many consecutive incorrect attempts → cognitive overload signal
- Session length exceeds typical productive threshold → fatigue signal

## Inputs
- `params`: { userInput, response, isCorrect, sessionAttempts, recentAccuracy }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `memoryUpdates`: { type: "cognitiveLoad", signal: { loadLevel: "normal"|"elevated"|"overloaded", recommendation: "continue"|"simplify"|"break" } }