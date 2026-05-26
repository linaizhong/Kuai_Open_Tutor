# Skill: velocity-tracker

## Meta
- **Name**: velocity-tracker
- **Type**: passive
- **Phase**: Phase 4 — Passive personalisation
- **Version**: 0.1.0

## Description
Silently tracks how fast the student's mastery is improving per topic over time. Updates the velocity profile after each session, detecting whether a topic is improving, stalling, or declining.

## Triggers
```json
{
  "keywords": [],
  "intent": ""
}
```

Note: This is a passive skill. It runs automatically after every interaction and produces no direct output to the student.

## Signals Observed
- Mastery score increased since last session on this topic → positive velocity delta
- Mastery score unchanged or decreased → zero or negative delta
- Number of attempts needed per correct answer → efficiency signal
- Rate of improvement over multiple sessions → trend (improving / stalling / declining)

## Inputs
- `params`: { userInput, response, dotPoint, isCorrect, masteryBefore, masteryAfter }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `memoryUpdates`: { type: "velocity", topicCode, topicLabel, delta, attempts }