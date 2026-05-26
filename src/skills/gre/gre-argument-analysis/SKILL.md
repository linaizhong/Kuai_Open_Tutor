# Skill: gre-argument-analysis

## Meta
- **Name**: gre-argument-analysis
- **Type**: active
- **Category**: gre
- **Phase**: GRE Analytical Writing — Analyze an Argument
- **Version**: 1.0.0

## Description
Provide feedback on GRE Argument task responses. Focus on logical analysis, identification of assumptions, and suggestions for strengthening.

## Triggers
```json
{
  "keywords": [
    "gre argument", "analyze an argument", "argument task",
    "gre writing", "analytical writing", "argument essay",
    "argument analysis", "evaluate argument", "argument feedback"
  ],
  "intent": "get feedback on GRE argument analysis"
}
```

## Inputs
- `params`: { userInput, argument, prompt }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: detailed feedback with score
- `score`: 0-6 analytical writing score
