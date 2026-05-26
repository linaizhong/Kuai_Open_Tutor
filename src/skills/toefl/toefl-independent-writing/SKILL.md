# Skill: toefl-independent-writing

## Meta
- **Name**: toefl-independent-writing
- **Type**: active
- **Category**: toefl
- **Phase**: TOEFL Writing — Independent task
- **Version**: 1.0.0

## Description
Evaluate independent writing responses against official TOEFL rubrics. Focus on thesis development, organization, specific examples, and language use. Helps students develop well-reasoned opinion essays on familiar topics.

## Triggers
```json
{
  "keywords": [
    "independent writing", "toefl writing", "writing task 2",
    "opinion essay", "agree or disagree", "which do you prefer",
    "independent essay", "writing feedback", "evaluate my essay",
    "toefl independent", "essay feedback", "toefl opinion essay"
  ],
  "intent": "get feedback on TOEFL independent writing"
}
```

## Workflow

1. Identify the independent writing prompt
2. Analyze student's thesis statement and position clarity
3. Evaluate development of reasons with specific examples
4. Assess organization (introduction, body paragraphs, conclusion, transitions)
5. Review language use (grammar, vocabulary, sentence variety)
6. Check for acknowledgment of complexity or counterarguments
7. Generate score (0-5) with specific feedback on each criterion
8. Provide model essay or paragraph for comparison
9. Update student's progress in independent writing

## Tools Used

- `knowledge-query` - Access TOEFL writing prompts and sample essays
- `syllabus-matcher` - Identify the independent writing task type
- `marking-guideline` - Score response against TOEFL independent writing rubric
- `error-analyzer` - Identify common writing errors (vague examples, off-topic, grammar)
- `velocity-tracker` - Track improvement in writing tasks over time
- `affective-detector` - Detect frustration or confidence from response patterns
- `learning-style-detector` - Adapt feedback delivery based on learning preferences

## Inputs

- `userInput`: student's essay response
- `prompt`: the writing prompt
- `targetScore`: optional target score for personalized feedback

## Outputs

- `result`: detailed feedback with score and improvement suggestions
- `score`: 0-5 writing score
- `thesis`: feedback on thesis clarity
- `development`: assessment of reason and example development
- `organization`: feedback on essay structure
- `languageUse`: feedback on grammar and vocabulary
- `memoryUpdates`: tracks writing practice attempts

## Examples

```json
{
  "userInput": "In today's interconnected world, both teamwork and independent work are valuable skills. However, I believe the ability to work with a group is ultimately more important for two main reasons. First, most significant achievements in the modern workplace are collaborative. When I worked on a marketing project at my previous job, our team of five people brought different strengths...",
  "prompt": "Do you agree or disagree with the following statement? It is more important to be able to work with a group of people than to work independently. Use specific reasons and examples to support your answer."
}
```

```json
{
  "userInput": "I prefer to live in a big city because there are more job opportunities. For example, my cousin found a job easily in Sydney. Also, cities have better entertainment like restaurants and cinemas. Small towns are boring.",
  "prompt": "Some people prefer to live in a small town. Others prefer to live in a big city. Which do you prefer and why? Use specific reasons and examples to support your answer."
}
```

## Notes

- Follows official ETS independent writing rubric
- Score 5: well-developed with specific examples, clear progression, varied sentences
- Score 4: adequate development, some specifics, generally clear
- Score 3: limited development, vague examples, some organization
- Score 2: underdeveloped, poor organization, frequent errors
- Score 1: minimal or no development, severe errors
- Critical elements: clear thesis, specific examples, logical organization
- Word count target: 300-350 words
- Higher scores acknowledge complexity or counterarguments
