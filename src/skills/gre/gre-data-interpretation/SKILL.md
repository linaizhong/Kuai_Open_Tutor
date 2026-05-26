# Skill: gre-data-interpretation

## Meta
- **Name**: gre-data-interpretation
- **Type**: active
- **Category**: gre
- **Phase**: GRE Quantitative — Data Interpretation
- **Version**: 1.0.0

## Description
Provide practice for GRE Data Interpretation questions involving graphs, charts, and tables. Focus on reading data accurately and performing calculations based on visual information.

## Triggers
```json
{
  "keywords": [
    "gre data", "data interpretation", "graph", "chart", "table",
    "bar graph", "line graph", "pie chart", "data analysis",
    "gre quantitative", "interpret the data", "from the graph"
  ],
  "intent": "practice GRE data interpretation questions"
}
```

## Inputs
- `params`: { userInput, questionData, studentAnswer, graphDescription }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: step-by-step explanation
- `isCorrect`: boolean
- `visualization`: graph data for frontend rendering
