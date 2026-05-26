# Skill: emotional-support

## Meta
- **Name**: emotional-support
- **Type**: active
- **Phase**: Phase 3 — Respond to frustration or disengagement with encouragement
- **Version**: 0.1.0

## Description
Respond warmly and constructively to a student expressing frustration, anxiety, or disengagement — validating their feelings, reframing setbacks as normal, and rebuilding confidence before returning to study.

## Triggers
```json
{
  "keywords": [
    "frustrated", "I give up", "this is too hard", "I can't do this",
    "I hate maths", "I'm so bad at this", "stressed", "anxious",
    "worried about", "so confused", "hopeless", "I don't understand anything",
    "I'm terrible at this", "I'll never get this", "I'm dumb",
    "I'm stupid", "what's wrong with me", "why can't I get this",
    "I want to give up", "this is pointless", "I'm going to fail",
    "I'm freaking out", "panicking", "I'm overwhelmed",
    "I feel like crying", "I've been staring at this for hours",
    "I can't concentrate", "I'm exhausted", "I hate this"
  ],
  "intent": "provide emotional support and encouragement to a frustrated or anxious student"
}
```

## Inputs
- `params`: { userInput }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: warm, personalised encouragement before gently returning to study
- `visualization`: null
- `syllabusPoint`: null