# Skill: calculus-applications

## Meta
- **Name**: calculus-applications
- **Type**: active
- **Phase**: Phase 1 — Applied calculus problems in HSC examiner format
- **Version**: 1.0.0
- **Subjects**: HSC Maths Extension 1, HSC Maths Extension 2

## Description
Handles the harder applied calculus problems in Ext 1 and Ext 2 where setting up the equation is as important as solving it. Automatically detects the problem type and enforces the two-phase approach HSC markers expect — Phase 1: Setup (define variables, diagram, governing equation), Phase 2: Calculus and answer. Covers related rates, optimisation, volumes of revolution, integration by parts, substitution (harder cases), differential equations, and motion/kinematics. Personalises tone and depth using the Student Model.

## Triggers
```json
{
  "keywords": [
    "related rate", "rate of change", "dv/dt", "dr/dt", "dh/dt",
    "volume of revolution", "solid of revolution", "revolve", "rotate about",
    "disk method", "shell method", "washer method",
    "integration by parts", "by parts", "integrate by parts",
    "differential equation", "general solution", "particular solution",
    "separable", "first order differential",
    "dy/dx =", "dv/dt =", "solve the equation",
    "related rates", "rate at which", "how fast", "how quickly",
    "motion", "velocity", "acceleration", "displacement", "particle",
    "kinematics", "at rest", "changes direction", "total distance",
    "optimise", "optimise the", "maximise", "minimise",
    "maximum volume", "minimum area", "minimum cost", "maximum profit",
    "hardest integral", "harder integration",
    "substitution", "let u =", "u-substitution", "t-substitution",
    "volumes", "area between curves", "harder calculus",
    "find the volume", "find the area", "find the rate"
  ],
  "intent": "solve a harder applied calculus problem requiring setup before differentiation or integration"
}
```

## Inputs
- `params`: { userInput, problem, dotPoint }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: complete two-phase worked solution in HSC examiner format, with Common Mistake note
- `visualization`: null
- `syllabusPoint`: relevant NESA dot-point code

## Problem types handled
| Type | Detection keywords | Ext 1 | Ext 2 |
|---|---|---|---|
| Related rates | rate of change, dV/dt, dr/dt | ✅ | ✅ |
| Harder optimisation | optimise, maximise, minimise | ✅ | ✅ |
| Volumes of revolution | revolve, disk method, shell | ✅ | ✅ |
| Integration by parts | by parts | — | ✅ |
| Harder substitution | let u =, t-substitution | ✅ | ✅ |
| Differential equations | dy/dx =, separable, general solution | ✅ | ✅ |
| Motion / kinematics | velocity, acceleration, particle | ✅ | ✅ |

## Notes
- This skill complements `hsc-worked-example` — it activates specifically for the applied/contextual calculus problem types that require a setup phase before any calculus is done.
- The two-phase structure (Setup → Solve) mirrors what HSC marking guidelines award marks for separately.