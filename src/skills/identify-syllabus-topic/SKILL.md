# Skill: identify-syllabus-topic

## Meta
- **Name**: identify-syllabus-topic
- **Type**: active
- **Category**: core
- **Version**: 2.0.0

## Description
Given any student question or problem, identify the most relevant NESA HSC Mathematics Advanced syllabus dot-point, topic, and subtopic. Uses a two-pass approach: fast keyword matching first, then LLM confirmation for ambiguous cases.

## Triggers
```json
{
  "keywords": [
    "which topic", "what topic", "what syllabus", "which dot-point", "what dot-point",
    "which part of the syllabus", "what area of maths", "what concept is this",
    "what is this testing", "which module", "which unit", "syllabus point",
    "identify the topic", "map to syllabus", "which syllabus dot-point"
  ],
  "intent": "identify which NESA HSC Mathematics Advanced syllabus dot-point a question belongs to"
}
```

## Workflow

1. **Keyword scoring pass** — score every dot-point in `context.knowledgeBase.dotPoints` against `params.userInput`:
   - For each keyword in `dp.keywords`: if found in the input (case-insensitive), add `1 + floor(wordCount / 2)` points (longer keywords score higher)
   - If `dp.name` appears in the input: add 3 bonus points
   - For each word in `dp.description` longer than 5 characters: if found in the input, add 0.5 points
   - Collect all dot-points with score > 0, sorted by score descending
   - Take the top match (`topMatch`) and the top 3 for context

2. **Assess confidence** from the scored results:
   - No matches → `low`
   - Top score ≥ 4 AND (only one match OR top score ≥ 2× the second score) → `high`
   - Top score ≥ 4 but multiple close matches → `medium`
   - Top score ≥ 2 → `medium`
   - Top score < 2 → `low`

3. **If confidence is `high`** — answer directly from the KB data without calling the LLM:
   - Format the response using the **Direct Answer Format** in Notes
   - Set `syllabusPoint` to `topMatch.code`
   - Return immediately (skip Steps 4 and 5)

4. **If confidence is `medium` or `low`** — confirm with the LLM:
   - Build the system prompt from the **LLM System Prompt** in Notes
   - Build the user message as follows:
     - Open with: `Identify the NESA HSC Mathematics Advanced syllabus dot-point for this question: "[userInput]"`
     - If keyword matches exist, list the top 3 candidates with their code, name, score, and first 100 characters of description
     - If topic data is available for the top match from `context.knowledgeBase.syllabusMap.topics`, include the topic name, code, and exam weight %
     - Close with: `Please confirm the correct dot-point using the required format.`
   - Call the LLM with temperature 0.2 (identification must be precise)
   - Extract the dot-point code from the LLM response by looking for a pattern matching `MA-[A-Z][digit].[digit]` (e.g. `MA-C1.3`); fall back to `topMatch.code` if none found

5. **Return** the result in the standard output shape (see Outputs)

## Inputs
- `params`: { userInput }
- `context`: { studentId, studentModel, model, knowledgeBase }

## Outputs
- `result`: structured syllabus identification (see formats in Notes)
- `visualization`: null
- `syllabusPoint`: the identified NESA dot-point code (e.g. `MA-C1.3`), or null
- `confidence`: `high`, `medium`, or `low` — useful for the Coordinator to log

## Notes

### Direct Answer Format
Used when confidence is `high` — assemble this from KB data directly, no LLM needed:

```
**Topic:** [topicData.name (match.topic)] OR [match.topic if no topicData]
**Subtopic:** [match.subtopic] OR [—]
**Dot-point:** [match.code] — [match.name]
**Year:** Year [match.year] OR [—]
**Exam Weight:** [match.difficulty] OR [—]

**Why this dot-point:**
[match.description] OR ["This question directly tests the concepts in this dot-point."]

**What the syllabus requires:**
- [match.keyConcepts[0]]
- [match.keyConcepts[1]]
- [match.keyConcepts[2]]
```

Include up to 3 key concepts. Omit the "What the syllabus requires" section entirely if `keyConcepts` is empty.

### LLM System Prompt
Use this verbatim as the system prompt for medium/low confidence cases:

---
You are OpenTutor — an expert on the NESA HSC Mathematics Advanced syllabus (2017, for HSC examinations 2020–2026).

Your task is to IDENTIFY which NESA syllabus dot-point a student's question belongs to.

REQUIRED OUTPUT FORMAT:

**Topic:** [Topic name and code, e.g. "Calculus (MA-C)"]
**Subtopic:** [Subtopic name and code, e.g. "Differential Calculus (MA-C1)"]
**Dot-point:** [Dot-point code and name, e.g. "MA-C1.3 — Differentiation rules"]
**Year:** [Year 11 or Year 12]
**Exam Weight:** [low / medium / high]

**Why this dot-point:**
[One or two sentences explaining why this topic matches the question]

**What the syllabus requires:**
[2–3 bullet points describing what students must be able to do for this dot-point]

**Related dot-points:**
[List 1–2 related dot-point codes the student may also need]

HSC MATHS ADVANCED TOPIC CODES:
- MA-F: Functions (Year 11–12, 20% exam weight)
- MA-T: Trigonometric Functions (Year 11–12, 15%)
- MA-C: Calculus (Year 11–12, 30% — highest weight)
- MA-E: Exponential and Logarithmic Functions (Year 11–12, 10%)
- MA-S: Statistical Analysis (Year 11–12, 15%)
- MA-M: Financial Mathematics (Year 12, 10%)

Be precise. If the question spans multiple dot-points, identify the primary one.

---

### Scoring Rules Summary
| Signal | Points Added |
|---|---|
| Keyword match (1 word) | +1 |
| Keyword match (2–3 words) | +2 |
| Keyword match (4+ words) | +3 |
| Dot-point name appears in input | +3 |
| Description word (>5 chars) found in input | +0.5 each |

### Confidence Thresholds
| Condition | Confidence |
|---|---|
| No matches | low |
| Top score ≥ 4 AND top score ≥ 2× second score | high |
| Top score ≥ 4 but close second match | medium |
| Top score ≥ 2 | medium |
| Top score < 2 | low |
