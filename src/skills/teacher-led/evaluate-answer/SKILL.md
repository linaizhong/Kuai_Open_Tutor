# Skill: evaluate-answer

## Meta
- **Name**: evaluate-answer
- **Type**: active
- **Category**: core
- **Phase**: Teacher-Led mode - Evaluate student answers with detailed assessment
- **Version**: 1.1.0

## Description
Evaluate student answers against expected responses or rubrics. Provides detailed assessment including correctness score, partial credit, specific feedback on each component, and suggestions for improvement. Supports both objective (maths) and subjective (English) evaluations with subject-specific criteria. Uses dynamic criteria generation for personalised, context-aware assessment.

## Triggers
```json
{
  "keywords": [
    "evaluate", "mark", "grade", "score", "assess",
    "how many marks", "what score", "check my work",
    "mark my answer", "grade my response", "assess my answer",
    "how did I do", "what would I get", "mark this"
  ],
  "intent": "evaluate and score a student's answer"
}
```

## Inputs
- `params`: {
  question: object|string,      // the question asked
  studentAnswer: string,         // student's response
  expectedAnswer?: string,       // expected correct answer (optional)
  topic: string,                 // topic code
  subject?: string,              // subject (from activeSubject)
  evaluationType?: 'simple' | 'detailed' | 'enhanced' | 'auto',
  provideFeedback?: boolean,      // whether to include feedback text
  useEnhanced?: boolean,          // whether to use enhanced criteria generation
  criteria?: object,              // optional pre-defined criteria
  activeSubject: string
  }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
```json
{
  "result": "feedback text",
  "score": 0.5,
  "totalScore": 10,
  "maxScore": 10,
  "percentage": 100,
  "scores": {
    "criterion1": 5,
    "criterion2": 5
  },
  "criteria": {
    "type": "maths|english|generic",
    "criteria": [],
    "totalScore": 10
  },
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "feedback": "detailed feedback text",
  "method": "auto",
  "enhanced": true,
  "fromCache": false,
  "syllabusPoint": "topic-code"
}
```

## Evaluation Criteria Examples

### Maths Criteria
```json
{
  "type": "maths",
  "criteria": [
    {
      "name": "Correctness",
      "weight": 0.5,
      "description": "Answer is mathematically correct",
      "maxScore": 5
    },
    {
      "name": "Working",
      "weight": 0.3,
      "description": "Shows clear step-by-step working",
      "maxScore": 3
    },
    {
      "name": "Notation",
      "weight": 0.2,
      "description": "Uses correct mathematical notation",
      "maxScore": 2
    }
  ],
  "totalScore": 10
}
```

### English Criteria
```json
{
  "type": "english",
  "criteria": [
    {
      "name": "Understanding",
      "weight": 0.3,
      "description": "Demonstrates understanding of the concept",
      "maxScore": 3
    },
    {
      "name": "Analysis",
      "weight": 0.3,
      "description": "Provides thoughtful analysis",
      "maxScore": 3
    },
    {
      "name": "Evidence",
      "weight": 0.2,
      "description": "Uses relevant textual evidence",
      "maxScore": 2
    },
    {
      "name": "Structure",
      "weight": 0.2,
      "description": "Answer is well-structured and clear",
      "maxScore": 2
    }
  ],
  "totalScore": 10
}
```

## Features
- **Dynamic Criteria Generation**: Uses KnowledgeEnhancer to create personalised evaluation criteria
- **Multiple Evaluation Methods**: Supports rule-based, LLM-based, and enhanced evaluation
- **Criterion-Based Scoring**: Detailed breakdown of scores per criterion
- **Smart Caching**: Caches evaluation results for improved performance
- **Strengths & Improvements**: Automatically identifies specific strengths and areas for growth
- **Subject-Specific Logic**: Tailored evaluation for maths, English, and generic subjects
- **Partial Credit**: Recognises partially correct answers and awards appropriate scores
- **External Criteria Support**: Accepts pre-defined criteria for custom evaluation

## Evaluation Types

| Type | Description | Use Case |
|------|-------------|----------|
| `simple` | Basic rule-based evaluation | Quick checks, simple answers |
| `detailed` | LLM-based detailed evaluation | Complex answers needing thorough analysis |
| `enhanced` | Dynamic criteria + detailed evaluation | Most comprehensive assessment |
| `auto` | Automatically chooses best type | Default, recommended |

## Examples

### Basic maths evaluation
```javascript
const result = await skill.execute({
  question: "Find the derivative of f(x) = x³ + 2x",
  studentAnswer: "f'(x) = 3x² + 2",
  expectedAnswer: "3x² + 2",
  topic: "MA-C1",
  evaluationType: "auto",
  activeSubject: "maths-advanced"
}, context);
```

### Enhanced English evaluation with dynamic criteria
```javascript
const result = await skill.execute({
  question: "Explain how imagery is used in the poem",
  studentAnswer: "The poet uses visual imagery to create a sense of atmosphere...",
  topic: "Module A",
  evaluationType: "enhanced",
  useEnhanced: true,
  activeSubject: "english-advanced"
}, context);
```

### Using custom criteria
```javascript
const result = await skill.execute({
  question: "Analyse the argument",
  studentAnswer: "The author argues that...",
  criteria: customRubric,
  topic: "Critical Analysis",
  evaluationType: "detailed",
  activeSubject: "english-advanced"
}, context);
```

## Changes in v1.1.0
- Added dynamic criteria generation using KnowledgeEnhancer
- Added smart caching system for performance
- Added `useEnhanced` parameter to control enhancement level
- Added `criteria` parameter for external rubrics
- Enhanced scoring with per-criterion breakdown
- Added `maxScore` and `totalScore` to output
- Added `method` field to indicate evaluation method used
- Added `fromCache` flag in output
- Improved partial credit calculation
- Enhanced subject-specific evaluation logic
- Added support for custom evaluation criteria

## Notes
- Results are cached for 30 minutes to improve performance
- Enhanced evaluation requires KnowledgeEnhancer service
- Falls back gracefully if enhanced services are unavailable
- Criteria can be dynamically generated or pre-defined
- Used in Teacher-Led mode during 'assessment' phase
- Scores can be used to update student mastery levels