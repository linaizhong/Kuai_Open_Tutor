# Skill: toefl-integrated-writing

## Meta
- **Name**: toefl-integrated-writing
- **Type**: active
- **Category**: toefl
- **Phase**: TOEFL Writing — Integrated task
- **Version**: 1.0.0

## Description
Evaluate integrated writing responses against official TOEFL rubrics. Provide detailed feedback on content accuracy, organization, and language use. Helps students summarize and synthesize information from reading and listening sources.

## Triggers
```json
{
  "keywords": [
    "integrated writing", "toefl writing", "writing task 1",
    "reading and listening", "summarize the lecture", "writing integrated",
    "integrated essay", "writing feedback", "evaluate my writing",
    "toefl essay", "integrated writing task", "reading listening writing"
  ],
  "intent": "get feedback on TOEFL integrated writing"
}
```

## Workflow

1. Identify the integrated writing prompt and source materials
2. Retrieve reading passage and lecture summary from knowledge base or user input
3. Analyze student's response for accurate representation of both sources
4. Check if all three lecture points are addressed and connected to reading
5. Evaluate organization (introduction, body paragraphs, transitions)
6. Assess language use (grammar, vocabulary, sentence variety)
7. Generate score (0-5) with specific feedback on content, organization, language
8. Provide model response for comparison
9. Update student's progress in integrated writing

## Tools Used

- `knowledge-query` - Access TOEFL writing prompts and sample responses
- `syllabus-matcher` - Identify the integrated writing task type
- `marking-guideline` - Score response against TOEFL integrated writing rubric
- `error-analyzer` - Identify common writing errors (content omission, personal opinion, language)
- `velocity-tracker` - Track improvement in writing tasks
- `affective-detector` - Detect frustration with time pressure or source integration
- `learning-style-detector` - Adapt feedback delivery based on learning preferences

## Inputs

- `userInput`: student's writing response
- `prompt`: the writing prompt
- `readingText`: the reading passage
- `listeningSummary`: summary of lecture (what the student heard)
- `targetScore`: optional target score for personalized feedback

## Outputs

- `result`: detailed feedback with score and improvement suggestions
- `score`: 0-5 writing score
- `contentAccuracy`: assessment of how well sources were represented
- `organization`: feedback on essay structure
- `languageUse`: feedback on grammar and vocabulary
- `memoryUpdates`: tracks writing practice attempts

## Examples

```json
{
  "userInput": "The reading passage discusses three benefits of urban community gardens: food security, social connections, and environmental benefits. However, the lecture challenges each point. First, the professor argues that the amount of food produced is minimal...",
  "prompt": "Summarize the points made in the lecture, being sure to explain how they cast doubt on the specific points made in the reading passage.",
  "readingText": "Urban community gardens provide numerous benefits to cities and their residents. First, they improve food security...",
  "listeningSummary": "Professor: While community gardens sound wonderful in theory, the reality is often more complicated. The amount of food produced is actually quite small..."
}
```

## Notes

- Follows official ETS integrated writing rubric
- Score 5: accurately represents all three points from both sources
- Score 4: good representation with minor omission
- Score 3: misses one point or misrepresents relationship
- Score 2: seriously misrepresents sources
- Score 1: minimal relevant content
- Critical elements: NO personal opinion, clear point-by-point contrast, accurate source representation
- Word count target: 150-225 words
