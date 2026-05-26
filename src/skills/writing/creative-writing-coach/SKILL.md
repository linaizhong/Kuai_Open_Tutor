# Skill: creative-writing-coach

## Meta
- **Name**: creative-writing-coach
- **Type**: active
- **Phase**: Phase 1 — HSC English creative writing guidance and feedback
- **Version**: 1.0.0
- **Subjects**: HSC English Advanced (Paper 1 Section III, Module C)

## Description
Supports students with the creative writing component of HSC English Advanced. Automatically detects whether the student wants a model piece generated, feedback on their own draft, or instruction in a specific craft technique. Applies form-specific craft requirements for short story, memoir, speech, poetry, and hybrid forms. Always models targeted components (opening, turn, ending) rather than writing full pieces — keeping the student's creative ownership intact. Personalises tone and depth using the Student Model.

## Triggers
```json
{
  "keywords": [
    "creative writing", "my story", "my creative", "my draft",
    "write a story", "write a poem", "write a creative piece",
    "creative piece", "short story", "narrative", "memoir",
    "personal narrative", "creative response",
    "Module C", "craft of writing", "stimulus",
    "how do I start my story", "how to write creatively",
    "opening line", "hook", "in medias res",
    "my writing is boring", "my writing is generic",
    "feedback on my creative", "improve my creative",
    "mark my creative", "is my story good",
    "statement of intention", "craft choices",
    "show don't tell", "voice", "narrative voice",
    "creative technique", "how to write a good ending",
    "how to write a good opening", "how to describe",
    "imagery in creative writing", "sensory detail",
    "can you write me an example", "write me a model"
  ],
  "intent": "help a student plan, write, or improve an HSC English creative piece"
}
```

## Inputs
- `params`: { userInput, problem, creativeForm }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: model opening + craft annotation, or targeted draft feedback, or technique instruction
- `visualization`: null
- `creativeMode`: 'generate' | 'feedback' | 'technique'
- `creativeForm`: detected or supplied form

## Modes
| Mode | Trigger pattern | What it produces |
|---|---|---|
| `generate` | Stimulus or topic given | Model opening (150-200 words) + craft annotation + piece arc + 2 alternative approaches |
| `feedback` | Student submits their draft | Strength quote + highest-priority weakness rewrite + craft checklist + stretch challenge |
| `technique` | "How do I...", "teach me..." | Definition + weak/strong contrast + practical exercise + author reference |

## Creative forms supported
| Form | Key craft requirements enforced |
|---|---|
| Short story | Compelling opening, clear turn, restrained ending, no padding |
| Memoir | Specific memory, double perspective (then/now), sensory anchoring, earned insight |
| Speech | Consistent voice, rhetorical devices, structural build, memorable close |
| Poetry | Deliberate word choice, meaningful line breaks, concrete image, sound texture |
| Hybrid | Motivated form mixing, Statement of Intention coherence, thematic thread |

## Temperature note
This skill uses `temperature: 0.7` — higher than analytical skills — to ensure model creative text demonstrates genuine imaginative range rather than generic prose.