# Skill: toefl-reading-comprehension

## Meta
- **Name**: toefl-reading-comprehension
- **Type**: active
- **Category**: toefl
- **Phase**: TOEFL Reading practice
- **Version**: 1.0.0

## Description
Provide reading comprehension practice with all 10 TOEFL question types. Includes academic passages, questions, and detailed explanations with passage references and vocabulary support.

## Triggers
```json
{
  "keywords": [
    "toefl reading", "reading practice", "reading passage",
    "reading comprehension", "vocabulary question", "reference question",
    "factual information", "negative fact", "inference",
    "rhetorical purpose", "sentence simplification", "insert text",
    "prose summary", "fill in table", "reading exercise",
    "toefl reading practice", "academic reading",
    "quiz me", "test me", "quiz", "test my knowledge",
    "comprehension question", "question about the passage",
    "test my reading", "reading question"
  ],
  "intent": "practice TOEFL reading comprehension or quiz on a reading passage"
}
```

## Workflow

1. Identify reading passage and question type from user request
2. Retrieve passage and questions from knowledge base
3. Present passage and questions to student
4. Evaluate student answers against correct responses
5. Provide detailed explanations with line references to passage
6. Explain vocabulary in context
7. Identify reading skill gaps (vocabulary, inference, purpose, etc.)
8. Update student's progress in reading comprehension

## Tools Used

- `knowledge-query` - Access TOEFL reading passages and questions
- `syllabus-matcher` - Identify question type (vocabulary, inference, purpose, etc.)
- `marking-guideline` - Check answer correctness
- `error-analyzer` - Identify common reading errors (misreading, outside knowledge)
- `calculator` - For any numerical data interpretation questions
- `velocity-tracker` - Track improvement in reading tasks by question type
- `affective-detector` - Detect frustration with passage difficulty
- `learning-style-detector` - Adapt explanations based on learning preferences

## Inputs

- `userInput`: student's question or answer
- `questionId`: ID from knowledge base (e.g., "TOEFL-R-001")
- `studentAnswer`: student's chosen answer (A, B, C, D)
- `passageId`: optional specific passage ID

## Outputs

- `result`: feedback with explanation and passage references
- `isCorrect`: boolean indicating if answer was correct
- `questionData`: the question object from knowledge base
- `passageData`: the reading passage object
- `memoryUpdates`: tracks reading practice attempts

## Examples

```json
{
  "questionId": "TOEFL-R-001",
  "studentAnswer": "B",
  "userInput": "The word 'consolidated' in the passage is closest in meaning to:"
}
```

```json
{
  "questionId": "TOEFL-R-004",
  "studentAnswer": "B",
  "userInput": "What can be inferred about small farmers mentioned in paragraph 1?"
}
```

## Notes

- Covers all 10 TOEFL reading question types
- Passages are academic-style (100-700 words)
- Vocabulary questions focus on words in context
- Prose summary and table questions include partial credit
- Tracks performance by question type to identify weak areas
- Provides vocabulary building suggestions based on missed words
