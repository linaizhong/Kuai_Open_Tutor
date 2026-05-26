# Skill: thesis-refinement

## Meta
- **Name**: thesis-refinement
- **Type**: active
- **Phase**: Phase 1 — HSC English thesis construction and refinement
- **Version**: 1.0.0
- **Subjects**: HSC English Advanced

## Description
Isolates the single highest-leverage skill in HSC English: writing a sophisticated, contestable thesis. Operates across four tasks — assessing a student's existing thesis, building one from scratch, elevating an adequate thesis to Band 6, or teaching the concept. Automatically detects the module context and pre-classifies the weakness type in submitted theses (descriptive, vague, no-technique, no-module-lens). Always shows Band 3 / Band 5 / Band 6 versions side by side with full annotation. Personalises tone and depth using the Student Model.

## Triggers
```json
{
  "keywords": [
    "thesis", "my thesis", "is my thesis good", "check my thesis",
    "how do I write a thesis", "what is a thesis", "thesis statement",
    "improve my thesis", "better thesis", "Band 6 thesis",
    "elevate my thesis", "make my thesis more sophisticated",
    "thesis too vague", "thesis too descriptive",
    "what's wrong with my thesis", "fix my thesis",
    "how to start an essay", "how to write an introduction",
    "my introduction is weak", "my intro",
    "contestable thesis", "argumentative thesis",
    "does my thesis have a technique", "thesis for module a",
    "thesis for module b", "thesis for common module",
    "write me a thesis", "build me a thesis",
    "how to argue", "argument for my essay"
  ],
  "intent": "assess, build, or refine an HSC English essay thesis"
}
```

## Inputs
- `params`: { userInput, problem, module }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: model thesis/theses with annotation, diagnosis, or instruction
- `visualization`: null
- `thesisTask`: 'assess' | 'build' | 'elevate' | 'teach'
- `module`: detected or supplied HSC module
- `weaknessType`: 'descriptive' | 'vague' | 'no-technique' | 'no-module-lens' | 'adequate' | null

## Four thesis quality criteria
| Criterion | What it checks | Common failure |
|---|---|---|
| Contestability | Is the claim debatable? | States an obvious fact ("the text explores loss") |
| Specificity | Does it name technique + effect? | Uses only abstract theme language |
| Module awareness | Does it use the module's conceptual lens? | Ignores the framing question entirely |
| Argument direction | Does it signal the essay's line of reasoning? | States a topic but not an argument |

## Module-specific thesis formulas
| Module | Formula |
|---|---|
| Common | `[Author] constructs [human experience] through [technique], positioning the reader to understand [insight].` |
| Module A | `Where [Text 1] constructs [idea] as [X], [Text 2] reframes it as [Y], together revealing [insight].` |
| Module B | `[Author]'s [text] [critical claim], [contextual grounding], revealing [broader cultural insight].` |
| Module C | `Through the deliberate choice of [technique/form], [Author] achieves [effect], demonstrating that [insight about craft].` |