# Skill: gre-issue-analysis

## Meta
- **Name**: gre-issue-analysis
- **Type**: active
- **Category**: gre
- **Phase**: GRE Analytical Writing — Analyze an Issue
- **Version**: 1.0.0

## Description
Provide feedback on GRE Issue task responses. Focus on thesis development, reasoning, examples, and consideration of complexity.

## Triggers
```json
{
  "keywords": [
    "gre issue", "analyze an issue", "issue task",
    "gre writing", "analytical writing", "issue essay",
    "opinion essay", "agree or disagree", "issue analysis",
    "issue feedback"
  ],
  "intent": "get feedback on GRE issue analysis"
}
```

## Inputs
- `params`: { userInput, prompt }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: detailed feedback with score
- `score`: 0-6 analytical writing score
