# Skill: essay-structure-coach

## Meta
- **Name**: essay-structure-coach
- **Type**: active
- **Phase**: Phase 1 — HSC English essay structure modelling and feedback
- **Version**: 1.0.0
- **Subjects**: HSC English Advanced

## Description
Guides students in constructing a well-structured HSC English Advanced essay. Operates in two modes: **model** (generates a complete essay plan with annotated components) and **feedback** (diagnoses structural weaknesses in a student's draft and rewrites them). Automatically detects the HSC module from the question and applies module-specific structural expectations. Personalises tone and depth using the Student Model.

## Triggers
```json
{
  "keywords": [
    "essay structure", "how do I structure", "structure my essay",
    "plan my essay", "essay plan", "essay outline",
    "how to write an essay", "how to write an introduction",
    "how to write a conclusion", "how to write a body paragraph",
    "my thesis", "my topic sentence", "my paragraph",
    "check my essay", "feedback on my essay", "improve my essay",
    "mark my essay", "what's wrong with my essay",
    "TEEL", "topic sentence", "thesis statement",
    "how to start my essay", "how to end my essay",
    "my introduction", "my conclusion",
    "is my thesis good", "is my paragraph good",
    "help me plan", "how should I structure",
    "argument structure", "sustained argument",
    "fix my intro", "fix my paragraph", "rewrite my thesis"
  ],
  "intent": "help a student plan, model, or fix the structure of an HSC English essay"
}
```

## Inputs
- `params`: { userInput, problem, module }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: essay structure model or targeted structural feedback with rewrites
- `visualization`: null
- `module`: detected or supplied HSC module ('common' | 'modA' | 'modB' | 'modC' | 'general')
- `essayMode`: 'model' | 'feedback'

## Modes
| Mode | Trigger pattern | What it produces |
|---|---|---|
| `model` | Question or topic given | Full annotated essay plan + one complete model body paragraph |
| `feedback` | Student submits their own writing | Diagnosis of structural weakness + before/after rewrite + one action item |

## Module-specific behaviour
| Module | Key structural requirement enforced |
|---|---|
| Common Module | Thesis must address "human experiences"; every paragraph connects detail to broader experience |
| Module A | Both texts integrated in every paragraph; comparative language enforced |
| Module B | Critical position required; context and secondary readings integrated |
| Module C | Craft-language required ("the writer chooses..."); technique tied to writerly intention |
| General | TEEL structure; contestable thesis; synthesis conclusion |