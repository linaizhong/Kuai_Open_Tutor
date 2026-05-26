# Skill: toefl-speaking-coach

## Meta
- **Name**: toefl-speaking-coach
- **Type**: active
- **Category**: toefl
- **Phase**: TOEFL Speaking preparation
- **Version**: 1.0.0

## Description
Provide personalized feedback on TOEFL Speaking responses using official ETS rubrics. Handles both independent and integrated tasks with detailed scoring and improvement suggestions.

## Triggers
```json
{
  "keywords": [
    "toefl speaking", "speaking practice", "speaking task", 
    "independent speaking", "integrated speaking", "speak about",
    "speaking response", "evaluate my speaking", "speaking feedback",
    "task 1", "task 2", "task 3", "task 4", "campus announcement",
    "academic lecture", "personal preference", "choose between"
  ],
  "intent": "get feedback on TOEFL speaking response"
}
```

## Workflow

1. Identify the speaking task type (independent, integrated-campus, integrated-lecture)
2. Retrieve the appropriate ETS speaking rubric from knowledge base
3. Analyze student's response against rubric criteria
4. Generate a score (0-4) with specific feedback
5. Provide a sample high-scoring response for comparison
6. Update student's progress and identify areas for improvement

## Tools Used

- `syllabus-matcher` - Identify the specific speaking task type
- `knowledge-query` - Access TOEFL speaking rubrics and sample responses
- `marking-guideline` - Score response against ETS rubric criteria
- `error-analyzer` - Identify common speaking errors (fluency, pronunciation, grammar)
- `velocity-tracker` - Track improvement in speaking tasks over time
- `affective-detector` - Detect frustration or confidence from response patterns
- `learning-style-detector` - Adapt feedback delivery based on learning preferences

## Inputs

- `userInput`: student's speaking response text
- `taskType`: 'independent' | 'integrated-campus' | 'integrated-lecture'
- `prompt`: the speaking prompt
- `readingText`: for integrated tasks, the reading passage
- `listeningSummary`: summary of what they heard

## Outputs

- `result`: detailed feedback with score and improvement tips
- `score`: 0-4 speaking score
- `memoryUpdates`: tracks speaking practice attempts

## Examples

```json
{
  "userInput": "I prefer to study alone because I can focus better without distractions. For example, when I was preparing for my biology exam, studying alone in the library helped me memorize all the terms much faster.",
  "taskType": "independent",
  "prompt": "Some people prefer to study alone. Others prefer to study in groups. Which do you prefer and why?"
}
```

```json
{
  "userInput": "The woman supports the proposal. She thinks the library should stay open later during finals because her dorm is too noisy.",
  "taskType": "integrated-campus",
  "prompt": "The woman expresses her opinion about the library proposal. State her opinion and explain the reasons she gives.",
  "readingText": "The university is considering extending library hours during final exams week from 10 PM to 2 AM.",
  "listeningSummary": "Student: I totally support this. Last semester I had to leave at 10 PM when I really needed to study."
}
```

## Notes

- Uses the TOEFL knowledge base for scoring rubrics
- Scores follow official ETS 0-4 scale
- Feedback addresses delivery, language use, and topic development
- Independent tasks focus on personal experience and opinion
- Integrated tasks require accurate summary of reading/listening content
