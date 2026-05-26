# Skill: hsc-worked-example

## Meta
- **Name**: hsc-worked-example
- **Type**: active
- **Category**: core
- **Version**: 2.0.0

## Description
Provide a complete step-by-step worked solution in authentic HSC examiner format, showing all working and reasoning as required in the exam.

## Triggers
```json
{
  "keywords": [
    "worked example", "show me how", "step by step", "how do I", "how to",
    "explain how", "walk me through", "work out", "work through",
    "show working", "demonstrate", "show me the steps", "how would I",
    "what are the steps", "how do you", "can you show me",
    "show me how to solve", "show me how to find", "show me how to calculate",
    "show me how to differentiate", "show me how to integrate",
    "show me how to sketch", "example of", "can you do an example"
  ],
  "intent": "show a complete worked solution with all steps to a maths problem"
}
```

## Workflow

1. **Identify the syllabus dot-point** — use the first that applies:
   - `params.dotPoint` if already provided
   - Infer from `params.problem` or `params.userInput` by keyword-matching against `context.knowledgeBase.dotPoints[code].keywords` (pick the code with the most keyword hits; ignore if score is 0)

2. **Fetch dot-point data** from `context.knowledgeBase.dotPoints[code]` if a code was identified — extract: name, up to 3 key concepts, and `workedExampleTemplate.steps` if present

3. **Fetch past mistakes** for the identified dot-point from `context.memory.getMistakesForDotPoint(studentId, dotPointCode)` — use the 2 most recent; proceed without if memory is unavailable

4. **Apply tone** from `context.studentModel.affectiveState.currentEngagement`:
   - `frustrated` → warm and patient; start with a brief reassurance before the solution
   - `confident` → slightly more concise; add a follow-up challenge at the end
   - `fatigued` → clean and concise — avoid information overload
   - otherwise → clear, encouraging tutor tone

5. **Apply format** from `context.studentModel.learningStyle.preferredRepresentation`:
   - `visual` → begin with a brief geometric or graphical interpretation before the algebraic steps; mention what a sketch would show
   - `numerical` → after each algebraic step, briefly show it with specific numbers if applicable
   - otherwise → present the solution algebraically with a brief conceptual explanation of each step

6. **Generate the worked solution** using all of the above context, following these strict requirements:
   - Show ALL working — never skip steps; HSC markers award marks for intermediate working
   - Label each step clearly: Step 1, Step 2, etc.
   - State the mathematical rule or law being applied at each step (e.g. "Using the product rule:", "By the quadratic formula:")
   - Write the FINAL ANSWER on its own clearly labelled line at the end
   - Use plain text maths notation: fractions as `a/b`, powers as `x^n`, roots as `sqrt(x)`, derivatives as `dy/dx` — no LaTeX backslash commands
   - If the question involves geometry or graphs, describe what a diagram would show
   - Keep accurate to NESA HSC Mathematics Advanced (2017 syllabus)
   - If dot-point data includes `workedExampleTemplate.steps`, follow that step sequence
   - If the student has past mistakes on this topic, specifically address those errors in the solution
   - Do NOT restate the student's question — go straight into the worked solution
   - End with a single `Common Mistake to Avoid:` line naming the most frequent error students make on this type of problem

## Inputs
- `params`: { userInput, problem, dotPoint }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: full worked solution in HSC examiner format
- `visualization`: null
- `syllabusPoint`: the identified NESA dot-point code, or null
