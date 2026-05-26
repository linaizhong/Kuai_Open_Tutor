# Skill: language-technique-identifier

## Meta
- **Name**: language-technique-identifier
- **Type**: active
- **Phase**: Phase 1 — HSC English language technique identification and effect analysis
- **Version**: 1.0.0
- **Subjects**: HSC English Advanced

## Description
Helps students correctly identify, name, and analyse language techniques in HSC English texts across all text types: prose, poetry, drama, film, and nonfiction. Automatically detects both the task (identify / name / effect / explain / distinguish) and the text type from the student's input. Always models the three-tier technique-effect-meaning analysis chain. Enforces the HSC distinction between technique identification (low marks) and effect + meaning analysis (Band 5/6). Personalises tone and depth using the Student Model.

## Triggers
```json
{
  "keywords": [
    "technique", "language technique", "literary technique", "literary device",
    "what technique", "find the technique", "identify technique",
    "what is this technique", "what do you call this",
    "metaphor", "simile", "personification", "symbolism", "imagery",
    "alliteration", "assonance", "onomatopoeia", "sibilance",
    "juxtaposition", "contrast", "repetition", "anaphora",
    "irony", "sarcasm", "hyperbole", "understatement", "satire",
    "enjambment", "caesura", "rhyme scheme", "rhythm",
    "foreshadowing", "flashback", "unreliable narrator",
    "camera angle", "close up", "wide shot", "montage",
    "what effect", "effect of this", "why did the author use",
    "what does this technique do", "explain this technique",
    "difference between metaphor and simile",
    "is this a metaphor", "is this an example of",
    "how do I analyse", "how to analyse a technique",
    "symbol or motif", "tone of this passage"
  ],
  "intent": "identify, name, or analyse a language technique in an HSC English text"
}
```

## Inputs
- `params`: { userInput, problem, textType }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: technique identification and/or three-tier analysis with annotated model sentences
- `visualization`: null
- `techniqueTask`: 'identify' | 'name' | 'effect' | 'explain' | 'distinguish'
- `textType`: 'poetry' | 'prose' | 'drama' | 'film' | 'nonfiction' | 'general'

## Technique tasks
| Task | Trigger pattern | What it produces |
|---|---|---|
| `identify` | Passage provided, no specific technique asked | Ranked list of 3-4 significant techniques with analysis |
| `name` | "What do I call this", "is this a..." | Precise technique name + definition + examples |
| `effect` | "What effect does this have", "why did author use" | Three-tier effect-meaning chain + model sentence |
| `explain` | "What is a metaphor", "explain this technique" | Definition + examples + model analysis sentence |
| `distinguish` | "Difference between X and Y", "is this X or Y" | Side-by-side comparison + decision rule |

## Technique taxonomy (by category)
| Category | Techniques covered |
|---|---|
| Figurative language | metaphor, extended metaphor, simile, personification, symbolism, motif, allegory, synecdoche, metonymy |
| Sound devices | alliteration, assonance, consonance, onomatopoeia, sibilance, rhyme, rhythm, metre |
| Structural | enjambment, caesura, repetition, anaphora, parallelism, juxtaposition, chiasmus |
| Syntax | short/long sentences, fragments, rhetorical questions, imperatives, ellipsis |
| Imagery | visual, tactile, auditory, olfactory, gustatory, kinaesthetic |
| Tone | irony, sarcasm, satire, hyperbole, understatement, euphemism, pathos, ethos, logos |
| Narrative | first person narration, unreliable narrator, free indirect discourse, foreshadowing, flashback |
| Film | close-up, wide shot, tracking shot, high/low angle, montage, diegetic/non-diegetic sound, mise en scène |