# Skill: rubric-decoder

## Meta
- **Name**: rubric-decoder
- **Type**: active
- **Phase**: Phase 1 — HSC English Advanced marking rubric interpretation
- **Version**: 1.0.0
- **Subjects**: HSC English Advanced

## Description
Translates the abstract language of the HSC English Advanced marking rubric into concrete, actionable writing behaviours. Rubric descriptors like "sustained", "nuanced", "perceptive", "sophisticated", and "evaluative" are meaningless to most students without explicit translation. This skill explains what each descriptor requires at the sentence level, shows weak/strong examples side by side, and helps students self-assess and band-map their own responses. Has a built-in translation database for the most common HSC English marking terms.

## Triggers
```json
{
  "keywords": [
    "what does sustained mean", "what does nuanced mean",
    "what does perceptive mean", "what does sophisticated mean",
    "what does evaluative mean", "what does insightful mean",
    "what does integrated mean", "rubric", "marking criteria",
    "marking rubric", "what is the rubric", "band descriptors",
    "what band am I", "what band is this", "am I band 6",
    "how do I get band 6", "how do I reach band 6",
    "what do I need for band 6", "move up a band",
    "difference between band 4 and band 6",
    "band 3 vs band 6", "what separates band 5 from band 6",
    "why am I losing marks", "why is this not band 6",
    "what does the marker want", "what markers look for",
    "how am I being marked", "how is this assessed",
    "self assess my response", "rate my essay",
    "how many marks would I get", "mark my response",
    "is this good enough for band 6",
    "what's wrong with my analysis", "why is my analysis weak"
  ],
  "intent": "decode HSC English rubric language or help a student self-assess against band descriptors"
}
```

## Inputs
- `params`: { userInput, problem, module }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: rubric term translations with weak/strong examples, or band-level feedback
- `visualization`: null
- `rubricTask`: 'decode' | 'self-assess' | 'band-map' | 'compare'
- `module`: detected or supplied HSC module
- `currentBand`: detected band number (1-6) or null

## Rubric term translation database
| Term | What it means in practice |
|---|---|
| **sustained** | Every paragraph is as analytically strong as your best paragraph — no drifting into summary |
| **nuanced** | Acknowledges complexity and tension — does not reduce the text to one simple idea |
| **perceptive** | Notices what most students miss; draws non-obvious conclusions |
| **sophisticated** | Complex concepts handled with precision; argument builds rather than repeats |
| **insightful** | Connects the specific to the universal — reaches beyond the text |
| **integrated** | Quotes woven into analysis sentences — not dropped then explained |
| **evaluative** | Makes judgements about effectiveness/significance — not just description |

## Band tasks
| Task | Trigger pattern | What it produces |
|---|---|---|
| `decode` | "What does X mean", "explain rubric" | Term translation + weak/strong example + self-check question |
| `self-assess` | "What band am I", "rate my response" | Criterion-by-criterion assessment with specific line quotes |
| `band-map` | "How do I get Band 6", "what do I need" | Gap analysis between current and target band with concrete rewrites |
| `compare` | "Band 3 vs Band 6", "show me the difference" | Same analytical point written at Band 3 / 5 / 6 with annotations |