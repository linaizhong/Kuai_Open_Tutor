# Skill: comparative-analysis

## Meta
- **Name**: comparative-analysis
- **Type**: active
- **Phase**: Phase 1 — HSC English comparative analysis across paired texts
- **Version**: 1.0.0
- **Subjects**: HSC English Advanced

## Description
Guides students in constructing comparative analysis for HSC English Advanced. Applies primarily to Module A (Textual Conversations) and the Common Module. Automatically detects text titles, the comparison task type, and the module context. Targets the most common comparative failure — the "tennis match" paragraph structure — and trains students toward integrated, argument-driven comparison. Always shows before/after rewrites with annotated model sentences. Personalises tone and depth using the Student Model.

## Triggers
```json
{
  "keywords": [
    "compare", "comparison", "comparative", "compare the two texts",
    "both texts", "text 1 and text 2", "similarly", "in contrast",
    "how are they similar", "how are they different",
    "Module A", "textual conversations", "intertextual",
    "how do I compare", "how to compare two texts",
    "compare my texts", "comparing texts",
    "my comparative paragraph", "my comparison",
    "tennis match", "alternating paragraphs",
    "integrate both texts", "weave both texts",
    "how do I link the texts", "how do I connect",
    "comparative thesis", "thesis for both texts",
    "whereas", "however the second text",
    "what does comparing reveal", "what does the comparison show",
    "how does text 2 respond to text 1",
    "in conversation with",
    "relationship between the texts",
    "point of comparison", "point of difference"
  ],
  "intent": "help a student construct integrated comparative analysis across two HSC English texts"
}
```

## Inputs
- `params`: { userInput, problem, context, texts }
- `context` (execution): { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: annotated model comparative paragraph(s) or targeted rewrite with before/after contrast
- `visualization`: null
- `comparativeTask`: detected task type
- `comparisonContext`: 'modA' | 'common' | 'general'
- `texts`: [text1, text2] extracted or supplied

## Comparative tasks
| Task | Trigger pattern | What it produces |
|---|---|---|
| `thesis` | "comparative thesis", "how do I argue both texts" | Weak vs strong comparative thesis with annotation |
| `compare` | "similar", "both texts", "same" | Full model similarity paragraph with 5-step formula |
| `contrast` | "contrast", "differ", "unlike", "whereas" | Full model contrast paragraph with link language |
| `integrate` | Student submits draft paragraph | Before/after rewrite: tennis match → integrated |
| `link` | "how do I connect", "how do I link" | Model topic sentences at three levels of sophistication |
| `full` | General comparative question | Complete annotated Band 6 paragraph + Band 3 contrast |

## The integration principle
Every model this skill produces follows the integration rule:
> Both texts must appear in **every paragraph**. Evidence from each text is woven around a single analytical claim about the **relationship** between them — not described separately.

## Comparative language bank
- **Similarity**: similarly, likewise, both texts, echoes, parallels, reflects, mirrors, reinforces
- **Difference**: whereas, in contrast, however, while, unlike, conversely, subverts, diverges from
- **Relationship**: in conversation with, responds to, extends the exploration of, recontextualises, illuminates