# Skill: gre-reading-comprehension

## Meta
- **Name**: gre-reading-comprehension
- **Type**: active
- **Category**: gre
- **Phase**: GRE Verbal — Reading Comprehension
- **Version**: 1.0.0

## Description
Provide practice for GRE Reading Comprehension questions across all subtypes: main idea, detail, inference, function, multiple-answer, select-in-passage.

## Triggers
```json
{
  "keywords": [
    "gre reading", "reading comprehension", "gre verbal",
    "reading passage", "main idea", "inference", "detail question",
    "function", "critical reasoning", "select in passage"
  ],
  "intent": "practice GRE reading comprehension"
}
```

## Inputs
- `params`: { userInput, questionId, studentAnswer, passageId, questionSubtype }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: detailed explanation
- `isCorrect`: boolean
- `questionData`: question object
- `passageData`: passage object
