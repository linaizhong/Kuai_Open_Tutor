# Skill: textual-evidence-builder

## Meta
- **Name**: textual-evidence-builder
- **Type**: active
- **Phase**: Phase 1 — HSC English textual evidence selection, embedding and analysis
- **Version**: 1.0.0
- **Subjects**: HSC English Advanced

## Description
Teaches students to select, embed, and analyse textual evidence at HSC Band 5/6 standard. Operates across four sub-tasks detected automatically from the student's input. Always models the contrast between weak (Band 3) and strong (Band 6) evidence sentences using annotated inline labels. Addresses the three most common evidence failures in HSC English: over-quoting, "this shows" analysis, and mismatched evidence. Personalises tone and depth using the Student Model.

## Triggers
```json
{
  "keywords": [
    "quote", "evidence", "textual evidence", "quotation",
    "which quote", "best quote", "find a quote", "choose a quote",
    "embed a quote", "how do I use a quote", "integrate a quote",
    "analyse this quote", "analyse my quote", "analysis of quote",
    "this shows", "what does this quote mean", "explain this quote",
    "technique", "what technique", "language technique",
    "effect of this quote", "how do I analyse",
    "my analysis", "improve my analysis", "weak analysis",
    "Band 6 analysis", "how to write analysis",
    "short quote", "long quote", "paraphrase",
    "how do I reference", "using evidence"
  ],
  "intent": "help a student select, embed or analyse a textual quote for HSC English"
}
```

## Inputs
- `params`: { userInput, problem, module }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: annotated model evidence sentences, weak/strong contrast, and evidence checklist
- `visualization`: null
- `evidenceTask`: detected sub-task ('select' | 'embed' | 'analyse' | 'full')
- `module`: detected or supplied HSC module

## Evidence tasks
| Task | Trigger pattern | What it produces |
|---|---|---|
| `select` | "which quote", "find a quote", "best quote" | Ranks quote options with justifications |
| `embed` | "embed", "integrate", "how do I use this quote" | Models woven embedding with grammar check |
| `analyse` | "analyse", "this shows", "technique", "effect" | Three-tier technique-effect-meaning rewrite |
| `full` | Quote + argument provided | Complete annotated evidence sentence + Band 3/6 contrast |

## Three-tier analysis model
```
Tier 1 — TECHNIQUE:  Name with precision (e.g. "extended metaphor of imprisonment")
Tier 2 — EFFECT:     Immediate literary effect ("creates a sense of claustrophobia")
Tier 3 — MEANING:    Broader argument / human experience / module lens connection
```