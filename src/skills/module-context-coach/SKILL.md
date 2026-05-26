# Skill: module-context-coach

## Meta
- **Name**: module-context-coach
- **Type**: active
- **Category**: english-advanced
- **Version**: 2.0.0

## Description
Teaches students to understand, internalise, and apply the conceptual lens of each HSC English Advanced module. Addresses the critical gap between students who write "generic text analysis" and those who correctly frame every paragraph through the module's specific requirements. Operates in two modes: explaining what the module requires from scratch, or showing how to apply the module lens to a specific piece of the student's existing writing.

## Triggers
```json
{
  "keywords": [
    "module", "what is module a", "what is module b", "what is module c",
    "common module", "Module A", "Module B", "Module C",
    "textual conversations", "critical study", "craft of writing",
    "texts and human experiences", "human experiences",
    "what does the module want", "what is the module asking",
    "how do I use the module", "apply the module",
    "module lens", "framing question", "module focus",
    "does my essay address the module", "am I answering the module",
    "my essay doesn't mention the module",
    "what marks does the module get", "why do I lose marks",
    "intertextual", "textual conversation",
    "critical position", "critical study of literature",
    "craft decision", "statement of intention",
    "what should I write about for module",
    "how is module a different from module b"
  ],
  "intent": "explain or help a student apply an HSC English Advanced module's conceptual framing"
}
```

## Workflow

1. **Classify the module** from `params.module` (if already provided) or by detecting signals in `params.problem` or `params.userInput`:
   - `module a`, `mod a`, `textual conversation`, `intertextual` → `modA`
   - `module b`, `mod b`, `critical study`, `close study`, `prescribed text` → `modB`
   - `module c`, `mod c`, `craft of writing`, `creative writing.*module` → `modC`
   - `common module`, `human experience`, `section i`, `paper 1` → `common`
   - No signal → `unknown`

2. **Classify the mode** from the student's input:
   - If input contains `my essay`, `my paragraph`, `my response`, `my analysis`, `apply`, `how do i use`, `how do i include`, `how do i incorporate`, `work.*into`, or `put.*into` → `apply`
   - Otherwise → `explain`

3. **If module is `unknown`** — do not attempt to explain all four modules; instead ask the student which module they are working on (Common Module, Module A, Module B, or Module C); be friendly and brief; apply the tone rule from Step 4; then stop

4. **Determine tone and format** from the student model:
   - Tone from `context.studentModel.affectiveState.currentEngagement`:
     - `frustrated` → start with the simplest possible explanation of what the module wants; use one concrete before/after example before anything else
     - `confident` → skip the basics; go straight to nuance — what separates Band 4 module awareness from Band 6
     - `fatigued` → give one key phrase they need to use, one sentence showing how, and stop
     - otherwise → be clear and concrete; the module context must feel practical, not abstract
   - Format from `context.studentModel.learningStyle.preferredRepresentation`:
     - `visual` → use a visual map structure: centre the module's framing question, then branch to: what it asks of analysis / what it asks of creative / key vocabulary / what to avoid
     - `numerical` → use a numbered checklist: 3 things the module requires, 3 things markers reward, 3 things to avoid
     - otherwise → use clear headings: WHAT THE MODULE WANTS / WHAT MARKERS LOOK FOR / MODEL SENTENCE / COMMON MISTAKE

5. **Fetch the student's past mistakes** for this skill from `context.memory.getMistakesForSkill(studentId, 'module-context-coach')`; if any exist, include the 2 most recent in the LLM context so the response addresses recurring issues

6. **Generate the response** using the full module knowledge from the **Module Knowledge Base** in Notes, following the appropriate task instructions:

   **If mode is `explain`:**
   1. State the module's FRAMING QUESTION clearly — this is what every essay response must answer
   2. Explain what this means in practical terms: what does the marker want to see?
   3. Give the KEY VOCABULARY the student should weave into their analysis
   4. Show the MODEL SENTENCE formula
   5. Identify the COMMON MISTAKE — what students do when they ignore the module
   6. Give one concrete BEFORE/AFTER example: a generic sentence vs a module-aware sentence on the same point

   **If mode is `apply`:**
   1. Identify which part of the student's response is ignoring or underusing the module lens
   2. Quote the specific passage that needs module integration
   3. Show the rewritten version that correctly applies the module's framing
   4. Explain what changed and why it earns more marks
   5. Give the student a "module lens check" — one question they can ask themselves after each paragraph

7. **Always end** with a `Module Lens Check:` — one question the student asks after every paragraph to verify it is module-aware

8. **Strict requirements** regardless of mode:
   - Every piece of advice must show how the module lens changes a specific sentence — not just that it should be included
   - Always show a BEFORE (module-absent) and AFTER (module-present) version
   - Use the module's exact framing language in all model sentences
   - Focus entirely on the identified module — do not teach all four at once

## Inputs
- `params`: { userInput, problem, module }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: module explanation with model sentences, or targeted rewrite applying the module lens
- `visualization`: null
- `module`: `common` | `modA` | `modB` | `modC` | `unknown`
- `moduleMode`: `explain` | `apply`

## Notes

### Module Knowledge Base

#### Common Module: Texts and Human Experiences
- **Framing question**: How do texts represent individual and collective human experiences?
- **Syllabus focus**:
  - How texts represent and illuminate the anomalies, paradoxes and inconsistencies in human behaviour
  - How language and textual features shape perspectives on human experience
  - How texts affirm or challenge assumptions and beliefs about being human
- **What markers look for**:
  - The student explicitly connects textual detail to a broader human experience — not just plot
  - Analysis moves from technique → effect → what this reveals about being human
  - The student shows awareness that different readers may experience the text differently
  - Use of human experience vocabulary in analysis sentences
- **Key vocabulary**: human experience, individual and collective, anomalies and paradoxes, perspectives on humanity, assumptions about being human, the complexity of human behaviour, affirms or challenges
- **Model sentence**: `Through [technique], [Author] constructs [specific experience] as [quality/nature], illuminating the [paradox/complexity/tension] at the heart of the human condition.`
- **Common mistake**: Writing a character study or plot summary instead of connecting the text's representation to broader human experience.
- **Exam tip**: Every analysis paragraph should end by returning to what this reveals about "being human" — not just about the character or plot.

---

#### Module A: Textual Conversations
- **Framing question**: How do texts engage in conversation with each other, and what does that conversation reveal?
- **Syllabus focus**:
  - How texts respond to, reimagine, or challenge other texts and their contexts
  - How intertextuality creates meaning that neither text produces alone
  - How context shapes and is shaped by textual choices
- **What markers look for**:
  - Both texts present in every paragraph — integrated, not alternating
  - The student argues a RELATIONSHIP between texts, not just describes each separately
  - Comparative language is precise and varied: not just "similarly" and "however"
  - The student can articulate what reading the texts TOGETHER reveals
- **Key vocabulary**: in conversation with, responds to, reimagines, recontextualises, challenges the assumptions of, extends the exploration of, the intertextual relationship, contextual resonances, the dialogue between texts, illuminates through contrast
- **Model sentence**: `Where [Author 1] [constructs/presents/positions] [idea] as [quality], [Author 2] [reimagines/subverts/extends] this construction, revealing [what reading them together illuminates].`
- **Common mistake**: The "tennis match" structure: writing one paragraph about Text A, then one about Text B, then one about Text A. This is description, not conversation.
- **Exam tip**: Ask yourself: what can I say about these texts TOGETHER that I could not say about either one alone? That insight is your essay's argument.

---

#### Module B: Critical Study of Literature
- **Framing question**: What is your critical position on this text, and how does context shape meaning?
- **Syllabus focus**:
  - How sustained close reading develops a critical interpretation
  - How context — historical, cultural, biographical — shapes and is shaped by texts
  - How different critical perspectives produce different readings
  - How the text has been received and why it endures
- **What markers look for**:
  - The student takes a clear critical POSITION — not just describes the text
  - Context is woven into analysis, not listed separately as a paragraph
  - At least one secondary reading or critical perspective is acknowledged
  - Close reading of specific language — not just broad statements about themes
- **Key vocabulary**: critical position, critical reading, contextual resonance, the text's cultural significance, received and interpreted, feminist reading, postcolonial reading, Marxist perspective, the conditions of production, the text's enduring relevance
- **Model sentence**: `[Author]'s choice to [specific textual decision] — [contextual grounding: written in a period of...] — [effect and critical claim], demonstrating that [what this reveals about the text's cultural significance].`
- **Common mistake**: Writing a "context paragraph" that lists historical facts without connecting them to specific textual choices. Context must illuminate why the author made specific decisions.
- **Exam tip**: Module B rewards a clear critical voice. Do not hedge with "could represent" and "might suggest" — commit to your reading and justify it with evidence.

---

#### Module C: The Craft of Writing
- **Framing question**: What writerly choices shape the way a text works, and how can you deploy those choices yourself?
- **Syllabus focus**:
  - How composers make purposeful craft decisions to achieve specific effects
  - How understanding craft in mentor texts improves your own writing
  - How to articulate the relationship between craft choice and effect in a Statement of Intention
- **What markers look for**:
  - The student uses the language of craft — "the writer chooses", not "the text shows"
  - Analysis connects technique to the specific effect intended
  - The Statement of Intention clearly links craft choices to their purpose
  - Both analytical and creative responses show awareness of craft as intentional
- **Key vocabulary**: craft decision, writerly choice, the writer deliberately, this technique achieves, the effect on the reader, structural choice, voice, perspective, the form enacts, the statement of intention, inspired by, in response to
- **Model sentence**: `By choosing [technique/form/structure], [Author] deliberately [effect achieved], a decision that [what it makes possible that another choice would not].`
- **Common mistake**: Writing about what the text MEANS instead of HOW it achieves its meaning. Module C is about craft decisions — the WHY of technique, not just the WHAT.
- **Exam tip**: In your Statement of Intention, never say "I used [technique]." Say "I chose [technique] because [specific effect I wanted to create], inspired by [mentor text's] use of [same or related technique]."
