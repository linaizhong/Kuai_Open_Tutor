# Skill: gre-text-completion

## Meta
- **Name**: gre-text-completion
- **Type**: active
- **Category**: gre
- **Phase**: GRE Verbal — Text Completion
- **Version**: 1.0.0

## Description
Provide practice and detailed explanations for GRE Text Completion questions. Focus on vocabulary in context, logical relationships, and sentence structure.

## Triggers
```json
{
  "keywords": [
    "gre text completion", "text completion", "sentence completion",
    "gre verbal", "fill in the blank", "single blank", "double blank",
    "triple blank", "gre vocabulary", "sentence logic"
  ],
  "intent": "practice GRE text completion questions"
}
```

## Inputs
- `params`: { userInput, questionId, studentAnswers, blankCount }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: detailed explanation
- `isCorrect`: boolean
- `questionData`: question object
