# Skill: multi-representation

## Meta
- **Name**: multi-representation
- **Type**: active
- **Phase**: Phase 2 — Explain concepts numerically, graphically and algebraically
- **Version**: 0.1.0

## Description
Explain a concept or problem using multiple representations — numerical, graphical, and algebraic — leading with the student's preferred style as inferred from their learning profile.

## Triggers
```json
{
  "keywords": [
    "different way", "another way", "explain differently", "show me another way",
    "can you show me visually", "draw it", "visually", "graphically",
    "numerically", "algebraically", "show me with numbers", "show me with a graph",
    "I learn visually", "I'm a visual learner", "I prefer pictures",
    "show me the picture", "geometric interpretation", "what does it mean",
    "another explanation", "explain another way", "show me from a different angle",
    "I don't understand the algebra", "can you explain without algebra",
    "what does this look like", "illustrate this"
  ],
  "intent": "explain a concept using multiple representations — visual, numerical, and algebraic"
}
```

## Inputs
- `params`: { userInput, concept, dotPoint }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: multi-representation explanation leading with student's preferred style
- `visualization`: graph or diagram data
- `syllabusPoint`: relevant NESA dot-point code