# Skill: provide-feedback

## Meta
- **Name**: provide-feedback
- **Type**: active
- **Category**: core
- **Phase**: Teacher-Led mode - Provide constructive feedback on student responses
- **Version**: 1.1.0

## Description
Analyse student answers and provide personalised, constructive feedback. Identifies misconceptions, highlights correct elements, and suggests improvements. Tailors feedback tone and depth based on student model (affective state, learning style). Uses dynamic generation to create context-aware, personalised feedback. Integrates with KnowledgeEnhancer for enhanced misconception detection and improvement suggestions.

## Triggers
```json
{
  "keywords": [
    "feedback", "how did I do", "is this correct", "mark my answer",
    "check my answer", "review", "assess", "evaluate my response",
    "what did I get wrong", "why is this wrong", "help me improve",
    "give me feedback", "tell me how I did"
  ],
  "intent": "provide feedback on student's answer"
}
```

## Inputs
- `params`: {
  question: object|string,      // the question asked
  studentAnswer: string,         // student's response
  correctAnswer?: string,        // expected correct answer (optional)
  isCorrect?: boolean,           // whether answer is correct (optional)
  score?: number,                 // optional score (0.0-1.0)
  topic: string,                 // topic code
  feedbackType?: 'simple' | 'detailed' | 'enhanced' | 'auto',
  useEnhanced?: boolean,          // whether to use enhanced generation (default: true)
  activeSubject: string
  }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
```json
{
  "result": "feedback text",
  "feedback": "feedback text",
  "misconceptions": [
    {
      "type": "known|detected",
      "description": "misconception description",
      "suggestion": "how to correct it",
      "confidence": 0.5
    }
  ],
  "improvements": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "score": 0.5,
  "isCorrect": true,
  "enhanced": true,
  "fromCache": false,
  "syllabusPoint": "topic-code"
}
```

## Features
- **Enhanced Misconception Detection**: Uses both knowledge base and LLM to identify student misconceptions
- **Tone Adaptation**: Adjusts feedback tone based on student's affective state (frustrated, confident, fatigued, bored)
- **Multiple Feedback Levels**: Supports simple, detailed, and enhanced feedback generation
- **Smart Caching**: Caches similar feedback responses for improved performance
- **Improvement Suggestions**: Automatically generates actionable improvement tips
- **Score Integration**: Accepts external scores or calculates based on correctness
- **KnowledgeEnhancer Integration**: Uses enhanced generation for richer, more personalised feedback

## Feedback Types

| Type | Description | Use Case |
|------|-------------|----------|
| `simple` | Rule-based feedback with basic templates | Quick responses, fallback |
| `detailed` | LLM-generated detailed feedback | Complex answers needing thorough analysis |
| `enhanced` | KnowledgeEnhancer-powered feedback | Most personalised, context-aware feedback |
| `auto` | Automatically chooses best type based on answer length and context | Default, recommended |

## Examples

### Basic feedback request
```javascript
const result = await skill.execute({
  question: "What is the derivative of f(x) = x²?",
  studentAnswer: "2x",
  correctAnswer: "2x",
  topic: "MA-C1",
  feedbackType: "auto",
  activeSubject: "maths-advanced"
}, context);
```

### Enhanced feedback with misconception detection
```javascript
const result = await skill.execute({
  question: "Explain the concept of a derivative",
  studentAnswer: "It's the slope of the line",
  topic: "MA-C1",
  feedbackType: "enhanced",
  useEnhanced: true,
  activeSubject: "maths-advanced"
}, context);
```

### Feedback with external score
```javascript
const result = await skill.execute({
  question: "Analyse the imagery in this poem",
  studentAnswer: "The poet uses visual imagery to create atmosphere...",
  score: 0.75,
  topic: "Module A",
  feedbackType: "detailed",
  activeSubject: "english-advanced"
}, context);
```

## Changes in v1.1.0
- Added enhanced misconception detection using LLM
- Added smart caching system for performance
- Added `useEnhanced` parameter to control enhancement level
- Added `score` parameter support
- Added `improvements` array in output
- Enhanced tone adaptation with more affective states (bored, fatigued)
- Added `fromCache` flag in output
- Integrated with KnowledgeEnhancer service
- Improved feedback personalisation based on student model

## Notes
- Feedback is cached for 1 hour to improve performance
- Enhanced feedback requires KnowledgeEnhancer service
- Falls back gracefully if enhanced services are unavailable
- Tone adapts based on student's engagement level
- Used in Teacher-Led mode during 'checking' and 'practice' phases
- Can be called independently or as part of a larger teaching flow