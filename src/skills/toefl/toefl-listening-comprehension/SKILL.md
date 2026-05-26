# Skill: toefl-listening-comprehension

## Meta
- **Name**: toefl-listening-comprehension
- **Type**: active
- **Category**: toefl
- **Phase**: TOEFL Listening practice
- **Version**: 1.0.0

## Description
Provide listening comprehension practice with questions modeled on official TOEFL listening tasks. Includes transcripts, questions, and detailed explanations with audio reference points.

## Triggers
```json
{
  "keywords": [
    "toefl listening", "listening practice", "lecture", "conversation",
    "listen to", "listening comprehension", "listening question",
    "what does the professor mean", "what can be inferred",
    "listening exercise", "academic lecture", "campus conversation",
    "listening section", "toefl listening practice"
  ],
  "intent": "practice TOEFL listening comprehension"
}
```

## Workflow

1. Identify the listening task type (lecture or conversation)
2. Retrieve appropriate listening passage and questions from knowledge base
3. Present transcript or audio summary to student
4. Evaluate student answers against correct responses
5. Provide detailed explanations with timestamp references
6. Identify listening skill gaps (main idea, details, inference, attitude)
7. Update student's progress in listening comprehension

## Tools Used

- `knowledge-query` - Access TOEFL listening passages and questions
- `syllabus-matcher` - Identify question type (main idea, detail, inference, attitude)
- `marking-guideline` - Check answer correctness
- `error-analyzer` - Identify common listening errors (mishearing, context misunderstanding)
- `velocity-tracker` - Track improvement in listening tasks
- `affective-detector` - Detect frustration with fast speech or accents
- `learning-style-detector` - Adapt explanations based on learning preferences

## Inputs

- `userInput`: student's question or answer
- `questionId`: ID from knowledge base (e.g., "TOEFL-L-001")
- `studentAnswer`: student's chosen answer (A, B, C, D)
- `passageId`: optional specific passage ID

## Outputs

- `result`: feedback with explanation and transcript references
- `isCorrect`: boolean indicating if answer was correct
- `questionData`: the question object from knowledge base
- `passageData`: the listening passage object
- `memoryUpdates`: tracks listening practice attempts

## Examples

```json
{
  "questionId": "TOEFL-L-001",
  "studentAnswer": "B",
  "userInput": "What is the main topic of the lecture?"
}
```

```json
{
  "questionId": "TOEFL-L-003",
  "studentAnswer": "C",
  "userInput": "What is the professor's attitude toward the research?"
}
```

## Notes

- Questions cover all 8 TOEFL listening types
- Transcripts are provided for review
- Explanations reference specific parts of the audio
- Strategy tips included for each question type
- Tracks performance by question type to identify weak areas
