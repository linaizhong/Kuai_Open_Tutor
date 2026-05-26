# Skill: spaced-review

## Meta
- **Name**: spaced-review
- **Type**: active
- **Category**: core
- **Version**: 2.0.0

## Description
Identify topics the student learned previously that are now due for review based on spaced repetition principles, and serve a targeted review question to reinforce retention.

## Triggers
```json
{
  "keywords": [
    "review", "revise", "revision", "spaced repetition", "I haven't done this in a while",
    "remind me", "refresh my memory", "go back to", "revisit",
    "I forgot how to", "I used to know this", "remind me how",
    "haven't practised", "need to review", "review session",
    "what should I review", "what do I need to go back over",
    "forgotten", "I think I've forgotten", "let's review",
    "recap", "recap on", "review my weak spots"
  ],
  "intent": "review previously learned material that is due for spaced repetition"
}
```

## Workflow

1. **Select dot-points due for review** from `context.studentModel.masteryProfile` and `context.memory.lastPractisedDates`:
   - If `params.topic` is provided, filter to dot-points whose code starts with that topic prefix (uppercased, first 4 chars — e.g. `MA-C`)
   - For each dot-point with a mastery score > 0, calculate its review interval using the **Spaced Repetition Intervals** table in Notes
   - Calculate `daysSince` = days elapsed since `memory.lastPractisedDates[dp]` (if never practised, treat as 9999 days)
   - A dot-point is **due** if `daysSince >= interval`
   - Sort due dot-points by: most overdue first → lowest mastery → highest exam weight (see **Topic Exam Weights** in Notes)
   - Take the top 5

2. **Handle empty results** — if no dot-points are due:
   - If `studentModel.masteryProfile` is empty or missing → return: *"You haven't practised enough material yet to start spaced review — let's do some new content first, and I'll remind you when topics are due for reinforcement."*
   - Otherwise → return: *"Nothing is due for review right now — all your practised topics are still within their review window. Come back in a day or two, or ask me to cover something new."*

3. **Select the top-priority dot-point** — the first item from the sorted due list

4. **Look up dot-point info** from `context.knowledgeBase.dotPoints[code]` — extract: name, summary, up to 3 key concepts, up to 2 common errors

5. **Determine question difficulty** from the dot-point's mastery score:
   - mastery < 0.50 or unknown → `straightforward`: direct application of the core rule or concept, no multi-step reasoning needed
   - mastery 0.50–0.75 → `moderate`: 2–3 step problem applying the concept in a slightly unfamiliar context
   - mastery > 0.75 → `challenging`: multi-step or extended problem that could appear in Section II of the HSC exam

6. **Generate the review question** using the LLM with all of the following context:
   - Student's name (from `context.studentModel.name`) if available
   - Weeks until HSC exam (from `context.studentModel.weeksRemaining`) if available
   - The selected dot-point code, name, summary, key concepts, and common errors
   - The student's current mastery percentage on that dot-point
   - The names of any other dot-points also due for review (from the remaining top-5 list), as a brief note
   - The difficulty level and its corresponding question style (from Step 5)
   - Follow the **Output Rules** in Notes exactly

7. **Return** the result in the standard output shape (see Outputs)

## Inputs
- `params`: { userInput, topic }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: one-sentence topic intro followed by a single review question
- `visualization`: null
- `syllabusPoint`: the dot-point code selected for review

## Notes

### Spaced Repetition Intervals
Based on the Ebbinghaus forgetting curve:

| Mastery Score | Label | Review Interval |
|---|---|---|
| ≥ 0.85 | Mastered | 14 days |
| ≥ 0.65 | Proficient | 7 days |
| ≥ 0.40 | Developing | 3 days |
| ≥ 0.00 | Needs work | 1 day |

### Topic Exam Weights
Used as a tiebreaker when sorting due dot-points (higher weight = higher priority):

| Topic Prefix | Topic Name | Exam Weight |
|---|---|---|
| `MA-C` | Calculus | 30 |
| `MA-F` | Functions | 20 |
| `MA-T` | Trigonometry | 15 |
| `MA-S` | Statistics | 15 |
| `MA-E` | Exponential & Logs | 10 |
| `MA-M` | Financial Maths | 10 |
| (other) | — | 10 |

### Output Rules
- Open with **ONE brief sentence** reminding the student what this dot-point is about and why it is worth revisiting now
- Pose **ONE review question** at the appropriate difficulty — fully self-contained, no external references, correct HSC-style mathematical notation
- Do **NOT** give the answer — wait for the student's response
- End with exactly: *"Take your time — let me know your answer when you're ready."*
- Write as natural flowing text — no bullet points or headers
- Keep the intro brief — get to the question quickly
- Warm, encouraging tone — this is revision, not a test
