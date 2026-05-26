# Skill: plot-function

## Meta
- **Name**: plot-function
- **Type**: active
- **Phase**: Phase 1 — Original
- **Version**: 0.1.0

## Description
Sketch and analyse function graphs, identifying key features such as intercepts, asymptotes, turning points and transformations.

## Triggers
```json
{
  "keywords": [
    "sketch", "draw", "graph", "plot", "draw the graph", "sketch the curve",
    "sketch the function", "draw the function", "plot the function",
    "what does the graph look like", "shape of the graph", "graph of",
    "key features", "x-intercept", "y-intercept", "turning point",
    "asymptote", "intercepts", "sketch y =", "draw y =", "graph y ="
  ],
  "intent": "sketch or analyse the graph of a mathematical function"
}
```

## Inputs
- `params`: { userInput, function }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: graph description with key features
- `visualization`: graph data for the frontend renderer
- `syllabusPoint`: relevant NESA dot-point code if applicable