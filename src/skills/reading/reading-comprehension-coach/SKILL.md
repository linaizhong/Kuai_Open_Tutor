# Skill: reading-comprehension-coach

## Meta
- **Name**: reading-comprehension-coach
- **Type**: active
- **Phase**: Phase 1 — HSC English unseen text comprehension and close reading
- **Version**: 1.0.0
- **Subjects**: HSC English Advanced (Paper 1 Section I)

## Description
Builds students' ability to read and respond to unseen texts — the critical skill tested in Paper 1 Section I. Unlike other English skills that work with studied texts, this skill teaches transferable close reading strategies applicable to any unfamiliar passage. Automatically detects the text type (poetry, prose, nonfiction, visual) and the task (close-read, annotate, respond, strategy). Models the reading process in real time and teaches annotation systems. Has embedded 6-step close reading framework and text-type-specific annotation strategies.

## Triggers
```json
{
  "keywords": [
    "unseen text", "unfamiliar text", "unseen passage",
    "how do I read this", "I don't understand this text",
    "close reading", "close read", "annotate", "annotation",
    "how to annotate", "what to look for", "reading strategy",
    "Paper 1", "Section I", "section 1",
    "short answer", "how to answer unseen",
    "how much time", "exam reading strategy",
    "how to approach an unseen text",
    "I don't know what this poem means",
    "help me understand this passage",
    "what is this text saying",
    "how do I start reading",
    "first read", "second read",
    "how to read a poem", "how to read a speech",
    "how to read a visual text", "multimodal text",
    "what do I notice first", "reading under time pressure",
    "I can't find any techniques",
    "the text is confusing"
  ],
  "intent": "help a student close read, annotate, or respond to an HSC English unseen text"
}
```

## Inputs
- `params`: { userInput, problem, textType }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: modelled close reading, annotation guide, or short-answer response template
- `visualization`: null
- `comprehensionTask`: 'close-read' | 'annotate' | 'respond' | 'strategy'
- `textType`: 'poetry' | 'prose' | 'nonfiction' | 'visual' | 'multimodal' | 'general'

## The 6-step close reading framework
1. **First impression** — overall tone and surface meaning
2. **Title and context clues** — framing signals
3. **First and last sentences** — the text's frame
4. **Technique scan** — second pass for language choices
5. **Effect and meaning** — what do the techniques achieve?
6. **Purpose and audience** — what is the text doing to the reader?

## Comprehension tasks
| Task | Trigger pattern | What it produces |
|---|---|---|
| `close-read` | Text provided, needs interpretation | 6-step modelled reading + analysis sentence for strongest moment |
| `annotate` | "How to annotate", "what to mark" | Text-type-specific annotation system with exam timing guide |
| `respond` | "Write a response", "answer the question" | Model short-answer paragraph with sentence-function annotations |
| `strategy` | "Exam strategy", "time management" | Time allocation + reading order + time-wasting habits to eliminate |