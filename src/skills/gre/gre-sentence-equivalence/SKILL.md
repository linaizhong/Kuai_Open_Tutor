# Skill: gre-sentence-equivalence

## Meta
- **Name**: gre-sentence-equivalence
- **Type**: active
- **Category**: gre
- **Phase**: GRE Verbal — Sentence Equivalence
- **Version**: 1.0.0

## Description
Provide practice for GRE Sentence Equivalence questions. Focus on finding two words that produce equivalent sentences with the same meaning.

## Triggers
```json
{
  "keywords": [
    "gre sentence equivalence", "sentence equivalence",
    "select two", "choose two", "equivalent sentences",
    "gre verbal", "synonyms in context"
  ],
  "intent": "practice GRE sentence equivalence questions"
}
```

## Inputs
- `params`: { userInput, questionId, studentAnswers }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: detailed explanation
- `isCorrect`: boolean
- `questionData`: question object
