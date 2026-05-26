# Skill: gre-quantitative-comparison

## Meta
- **Name**: gre-quantitative-comparison
- **Type**: active
- **Category**: gre
- **Phase**: GRE Quantitative — Quantitative Comparison
- **Version**: 1.0.0

## Description
Provide practice for GRE Quantitative Comparison questions. Focus on strategies for comparing quantities without fully calculating.

## Triggers
```json
{
  "keywords": [
    "gre quantitative", "quantitative comparison",
    "quantity a", "quantity b", "compare quantities",
    "greater than", "less than", "equal to", "cannot be determined",
    "gre math", "math comparison"
  ],
  "intent": "practice GRE quantitative comparison questions"
}
```

## Inputs
- `params`: { userInput, questionId, studentAnswer }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: step-by-step explanation
- `isCorrect`: boolean
- `questionData`: question object
