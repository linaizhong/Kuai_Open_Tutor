# Skill: vocabulary-and-register

## Meta
- **Name**: vocabulary-and-register
- **Type**: active
- **Phase**: Phase 1 — HSC English academic register, vocabulary precision, and word choice
- **Version**: 1.0.0
- **Subjects**: HSC English Advanced

## Description
Develops students' control over academic register and precise vocabulary — a consistent marker of Band 5/6 English responses. Targets the most common vocabulary failure in HSC English: over-reliance on a small set of weak analytical verbs ("shows", "uses", "demonstrates") and register drift (too casual or too inflated). Operates across four tasks detected automatically from the student's input. Always shows BEFORE/AFTER rewrites and caps vocabulary output at 10 items to avoid overwhelm. Personalises tone and depth using the Student Model.

## Triggers
```json
{
  "keywords": [
    "better word", "different word", "instead of shows",
    "instead of uses", "instead of demonstrates",
    "word choice", "vocabulary", "academic language",
    "analytical verbs", "more verbs", "upgrade my language",
    "improve my word choice", "my writing sounds casual",
    "my writing sounds informal", "not academic enough",
    "too simple", "sounds conversational",
    "too flowery", "purple prose", "trying too hard",
    "sounds unnatural", "overdone writing",
    "how do I sound more sophisticated",
    "how do I sound more academic",
    "what's a better way to say",
    "how to vary my language",
    "my essay uses shows too much",
    "I keep writing shows",
    "repetitive language", "same word",
    "register", "academic register",
    "formal language", "informal writing",
    "how do I write more precisely",
    "precise vocabulary", "vague language",
    "what does constructs mean", "what does positions mean",
    "analytical language HSC"
  ],
  "intent": "improve vocabulary precision, analytical verb range, or academic register in HSC English writing"
}
```

## Inputs
- `params`: { userInput, problem, vocabContext }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: targeted vocabulary upgrades with before/after rewrites, or register diagnosis and fix
- `visualization`: null
- `vocabTask`: 'upgrade' | 'register' | 'vocabulary' | 'verbs'
- `vocabContext`: 'analysis' | 'thesis' | 'topic-sentence' | 'creative' | 'general'

## Vocabulary tasks
| Task | Trigger pattern | What it produces |
|---|---|---|
| `upgrade` | Student submits writing sample | Top 3-5 weak words identified, 3 alternatives each, best-choice rewrite |
| `register` | "Too casual", "too flowery", "not academic" | Register problem diagnosed (informal / inflated / repetitive) + targeted rewrites |
| `vocabulary` | General vocabulary help | Function-based verb sets taught with model sentences + acquisition exercise |
| `verbs` | "Instead of shows", "more analytical verbs" | Verb-selection-by-function model + personalised 8-verb target list |

## Analytical verb sets (by function)
| Function | Verbs |
|---|---|
| Construction | constructs, positions, frames, situates, renders, casts, depicts, establishes |
| Effect | evokes, generates, produces, elicits, engenders, cultivates, amplifies, intensifies |
| Reader positioning | invites, compels, challenges, unsettles, implicates, positions the reader to, confronts the reader with |
| Argument | reveals, exposes, illuminates, foregrounds, interrogates, subverts, dismantles, reframes |
| Textual relationship | echoes, mirrors, responds to, extends, subverts, reimagines, recontextualises, deepens |

## Register problems addressed
| Problem type | Markers | Fix |
|---|---|---|
| Too informal | "you can see", "kind of", "a lot", "things", "stuff", "basically" | Replace with precise academic equivalents; remove second person |
| Too inflated | "ineffable", "quintessentially", "paradigmatic", "ontological" | Choose the most precise word, not the most impressive-sounding |
| Too repetitive | "shows" × 5, "uses" × 4, "demonstrates" × 3 | Expand verb range using function-based selection |

## Design note
Maximum of 10 vocabulary items per response — research on vocabulary acquisition shows that offering more choices leads to decision paralysis rather than uptake. The "Weekly Vocabulary Target" ending ensures at least one new word is selected for deliberate practice.