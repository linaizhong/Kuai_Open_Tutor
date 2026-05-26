# Skill: knowledge-gap-mapping

## Meta
- **Name**: knowledge-gap-mapping
- **Type**: active
- **Category**: core
- **Version**: 2.0.0

## Description
Analyse the student's mistake patterns and mastery data to identify prerequisite knowledge gaps — topics they need to master before they can progress with the current topic.

## Triggers
```json
{
  "keywords": [
    "knowledge gap", "gaps", "what am I missing", "what do I need to know first",
    "prerequisites", "what should I learn first", "I keep making the same mistake",
    "why do I keep getting this wrong", "what's holding me back",
    "foundational gaps", "what foundations do I need",
    "what topic do I need before this", "I don't have the background",
    "what is the prerequisite", "what do I need to know to understand this",
    "building blocks", "what do I need to review first",
    "where are my gaps", "my weakest areas", "analyse my mistakes",
    "pattern in my mistakes", "what keeps going wrong"
  ],
  "intent": "identify prerequisite knowledge gaps from student mistake patterns"
}
```

## Workflow

1. **Identify the current dot-point / topic** — use the first that applies:
   - `params.dotPoint` if explicitly provided
   - Infer from `params.topic` or `params.userInput` by keyword-matching against `context.knowledgeBase.dotPoints[code].keywords` (pick the code with the most keyword hits)
   - If nothing matches, proceed without a specific dot-point — the LLM will infer the topic from the student's message

2. **Get prerequisite dot-points** for the identified dot-point — check in this order:
   - If `knowledgeBase.dotPoints[code].prerequisites` exists and is non-empty, use that list directly
   - Otherwise, infer from the syllabus: extract the topic prefix (e.g. `MA-C` from `MA-C3.1`) and collect all dot-point codes with the same prefix whose sequence number is lower (e.g. `MA-C1.x`, `MA-C2.x` precede `MA-C3.1`); sort them ascending
   - If no dot-point was identified, pass an empty prerequisites list and let the LLM infer typical prerequisites for the topic

3. **Build the gap list** by cross-referencing each prerequisite code against the student model:
   - For each prerequisite code, read `context.studentModel.masteryProfile[code]` (mastery score 0–1) and `context.studentModel.mistakeSummary[code]` (mistake count)
   - Classify each prerequisite:
     - mastery < 0.40 → **critical**
     - mastery 0.40–0.65 OR mistakeCount ≥ 2 → **at-risk**
     - mastery is null (never assessed) → **watch**
     - mastery ≥ 0.65 AND mistakeCount < 2 → skip (not a gap)
   - Sort the gap list: critical first, then at-risk, then watch; within each tier sort by mastery ascending (lowest mastery first); null mastery sorts last within its tier

4. **Identify the student's top recurring mistake topics** from `context.studentModel.mistakeSummary` — find up to 3 dot-point codes with mistakeCount ≥ 2, sorted by count descending; include these in the LLM context

5. **Adjust tone** based on `context.studentModel.affectiveState.currentEngagement`:
   - `frustrated` → acknowledge that discovering gaps can feel discouraging; emphasise that identifying them is the first step to fixing them; keep tone warm and solution-focused
   - `confident` → be direct and efficient; they want to know what to work on, not reassurance
   - otherwise → be honest and clear; frame gaps as opportunities, not failures; give a concrete actionable path forward

6. **Generate the gap map and action plan** using the LLM with the following context:
   - The current topic (dot-point code, name, and description if available from KB; or the student's message if no dot-point was identified)
   - The student's current mastery percentage on the current topic (if known)
   - The full gap list from Step 3 — for each gap: priority label, code, name, mastery %, and mistake count
   - If the gap list is empty, instruct the LLM to infer likely prerequisite gaps based on the topic and typical HSC student weaknesses
   - The top recurring mistake topics from Step 4
   - Use the **Required Output Format** from Notes

7. **Return** the result in the standard output shape (see Outputs)

## Inputs
- `params`: { userInput, topic, dotPoint }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: gap map with prioritised action plan (see Required Output Format in Notes)
- `visualization`: null
- `syllabusPoint`: null

## Notes

### Required Output Format
The LLM must respond with **exactly** these five sections in this order:

```
**Current Topic:** [Topic name]

**Prerequisite Gaps Found:** [Number]

**Gap Analysis:**
[For each gap, one bullet: dot-point code — name — mastery level (if known) — why it matters for the current topic]

**Priority Action Plan:**
[Numbered list: what to study first, what to study next, and why. Be specific — name the dot-points.]

**Estimated Recovery Time:** [Honest estimate, e.g. "2–3 focused sessions"]
```

### Output Principles
- Only list genuine gaps — do not pad with topics the student already knows
- Be specific: name exact dot-point codes and concepts, not vague subject areas
- Frame recommendations positively — what to DO, not what is wrong
- Keep the total response under 300 words — clear and actionable

### Priority Labels
When presenting gaps to the LLM, use these labels so it can calibrate its language:
- **CRITICAL** — mastery < 40%; student will struggle to make progress without addressing this first
- **AT-RISK** — mastery 40–65% or repeated mistakes; worth addressing soon
- **WATCH** — never assessed; could be fine or could be a hidden gap worth checking
