# OpenTutor

**An AI-powered desktop tutoring application for HSC Mathematics Advanced students.**

OpenTutor replicates the behaviour of a skilled human tutor — not just remembering what a student got wrong, but deeply understanding *how* they learn. It runs entirely offline using a local Ollama model, with optional cloud model support for students who want it.

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Skill System](#skill-system)
- [Data & Privacy](#data--privacy)
- [Running the Tests](#running-the-tests)
- [Building a Distributable](#building-a-distributable)
- [Adding a New Skill](#adding-a-new-skill)
- [Tech Stack](#tech-stack)

---

## Features

### For Students

- **Worked examples** — step-by-step HSC-style solutions that match the way NESA examiners write
- **Socratic questioning** — guided hints that help you find the answer yourself instead of just being told it
- **Progressive scaffolding** — tiered hints (orientation → method → first step → near-complete) that escalate only as needed
- **Error analysis** — precise diagnosis of whether a mistake is conceptual, computational, or a misread
- **Past paper practice** — authentic HSC past paper questions served from a built-in knowledge base, with optional timed mode
- **Adaptive drill** — difficulty adjusts automatically up or down based on your live accuracy
- **Marking guideline feedback** — answers marked against official NESA criteria with partial credit
- **Multi-representation explanations** — the same concept shown algebraically, numerically, and visually, leading with your preferred style
- **Knowledge gap mapping** — identifies the prerequisite concepts you need before a topic will click
- **Session planner** — builds a focused session plan based on your mastery gaps and time until the exam
- **Spaced review** — schedules review of weak topics using the forgetting curve
- **Exam technique coaching** — advice on presentation, working, and time management for each question type
- **Progress celebration** — proactively surfaces genuine improvements to keep motivation high
- **Emotional support** — responds to frustration and fatigue with appropriate encouragement

### Personalisation (v3.0)

OpenTutor builds a real-time model of you as a student. Every interaction updates it:

- **Mastery profile** — per-dot-point scores across all NESA HSC Mathematics Advanced syllabus points
- **Learning style** — inferred from how you respond to different explanation types (visual / algebraic / numerical)
- **Learning velocity** — how quickly you improve on each topic, including trend detection (improving / stalling)
- **Affective state** — detects frustration, fatigue, and confidence from interaction patterns and adjusts tone accordingly
- **Exam readiness forecast** — projected performance by topic given your current trajectory and weeks remaining

---

## Prerequisites

Before installing OpenTutor, you need the following:

| Requirement | Version | Purpose |
|:---|:---|:---|
| [Node.js](https://nodejs.org/) | ≥ 18.0.0 | Runtime for Electron and build tools |
| [npm](https://www.npmjs.com/) | ≥ 9.0.0 | Dependency management |
| [Ollama](https://ollama.com/) | Latest | Runs the local AI model |

### Install and pull the default model

```bash
# Install Ollama from https://ollama.com, then:
ollama pull qwen2.5-coder:3b
ollama serve
```

Ollama must be running at `http://localhost:11434` before you start OpenTutor. You can verify it is running by visiting that URL in your browser — it should return `Ollama is running`.

---

## Installation

```bash
# Clone the repository
git clone https://github.com/linaizhong/Kuai_Open_Tutor.git
cd Kuai_Open_Tutor

# Install dependencies
npm install
```

That is all. On the first run, OpenTutor automatically creates the `data/` directory and writes default student data files — no manual setup is needed.

---

## Running the App

```bash
# Start normally
npm start

# Start in development mode (opens DevTools automatically)
npm run dev
```

On first launch you will be prompted to enter your name and HSC exam date in the Settings panel. This information is used to personalise urgency framing and session planning.

---

## Configuration

All configuration is stored in `data/config/user-config.json` and can be changed at any time through the Settings panel inside the app.

| Setting | Default | Description |
|:---|:---|:---|
| `activeModel` | `ollama:qwen2.5-coder:3b` | The model used for all AI responses |
| `ollamaUrl` | `http://localhost:11434` | URL of your local Ollama server |
| `apiKeys` | `{}` | API keys for cloud models (DeepSeek, OpenAI, Claude, Qwen) |
| `studentName` | *(empty)* | Your name — used in personalised responses |
| `theme` | `default` | UI colour theme |

### Switching models

OpenTutor supports both local Ollama models and cloud APIs. To switch, open **Settings → Model**, select a model, and click **Test Connection** before saving.

**Supported local models (via Ollama):**
- `qwen2.5-coder:3b` — default; fast and efficient on most laptops
- `qwen2.5-coder:7b` — higher quality; needs ≥ 8 GB VRAM
- `llama3.2:3b`
- `mistral:7b`

**Supported cloud models:**
- DeepSeek V3
- OpenAI GPT-4o
- Anthropic Claude 3.5 Sonnet
- Qwen Plus

---

## Project Structure

```
opentutor/
├── main.js                          # Electron entry point — wires all modules
├── preload.js                       # IPC bridge between main and renderer
├── package.json
│
├── src/
│   ├── main/                        # Main process (Node.js / Electron backend)
│   │   ├── agent/
│   │   │   ├── coordinator.js       # Conversation orchestrator
│   │   │   └── index.js             # Factory + IPC handler registration
│   │   ├── memory/
│   │   │   ├── index.js             # Memory Manager entry point
│   │   │   ├── student.js           # Student profile read/write
│   │   │   ├── mistakes.js          # Mistake records
│   │   │   ├── progress.js          # Progress statistics
│   │   │   ├── syllabus-mastery.js  # Per dot-point mastery scores
│   │   │   ├── exam-readiness.js    # Exam readiness assessment
│   │   │   ├── learning-style.js    # Learning style preferences
│   │   │   ├── velocity.js          # Learning velocity data
│   │   │   └── affective-history.js # Affective state history
│   │   ├── model-manager/
│   │   │   ├── index.js             # Model Manager entry point
│   │   │   ├── registry.js          # Model registry (local + cloud)
│   │   │   ├── config.js            # Config read/write
│   │   │   ├── tester.js            # Connectivity tester
│   │   │   ├── stats.js             # Usage statistics recorder
│   │   │   └── adapters/
│   │   │       ├── base.js          # Base adapter class
│   │   │       ├── ollama.js        # Ollama (local) adapter
│   │   │       ├── deepseek.js      # DeepSeek API adapter
│   │   │       ├── openai.js        # OpenAI API adapter
│   │   │       ├── claude.js        # Claude API adapter
│   │   │       └── qwen.js          # Qwen API adapter
│   │   ├── skill-manager/
│   │   │   ├── index.js             # Skill Manager entry point
│   │   │   ├── loader.js            # Scans src/skills/ and loads plugins
│   │   │   └── matcher.js           # Keyword-based skill matching
│   │   ├── student-model/
│   │   │   ├── index.js             # getStudentModel() — builds unified student profile
│   │   │   ├── mastery-synthesiser.js
│   │   │   ├── style-inferrer.js
│   │   │   ├── velocity-analyser.js
│   │   │   ├── affective-detector.js
│   │   │   └── readiness-forecaster.js
│   │   └── adaptive-feedback/
│   │       ├── index.js             # adjustResponse() — personalises output delivery
│   │       ├── tone-adjuster.js
│   │       ├── scaffold-adjuster.js
│   │       ├── format-selector.js
│   │       └── urgency-calibrator.js
│   │
│   ├── renderer/                    # Renderer process (React UI)
│   │   ├── index.html
│   │   ├── index.js
│   │   ├── App.js
│   │   └── components/
│   │       ├── ChatWindow.js
│   │       ├── ProgressDashboard.js
│   │       ├── FormulaRenderer.js   # KaTeX maths rendering
│   │       ├── Mascot.js            # Affective state mascot
│   │       └── Settings/
│   │           ├── index.js
│   │           ├── ModelSettings.js
│   │           ├── LocalModelConfig.js
│   │           ├── CloudModelConfig.js
│   │           └── StatsView.js
│   │
│   └── skills/                      # Skill plugins (one directory per skill)
│       └── {skill-name}/
│           ├── SKILL.md             # Skill metadata, triggers, and description
│           └── index.js             # Skill implementation (execute function)
│
├── knowledge-base/
│   └── hsc-maths-advanced/
│       ├── syllabus/
│       │   ├── syllabus-map.json    # NESA syllabus topic → subtopic → dot-point
│       │   └── dot-points.json      # Full dot-point detail, keywords, common errors
│       ├── past-papers/
│       │   ├── index.json           # Question index (year, marks, difficulty, dot-points)
│       │   └── questions/
│       │       └── questions.json   # Full question objects with solutions and marking criteria
│       └── marking-guidelines/
│           └── marking-guidelines-index.json
│
└── data/                            # Created automatically on first run; not committed to git
    ├── config/
    │   └── user-config.json
    └── students/
        └── default/
            ├── profile.md
            ├── mistakes.md
            ├── progress.json
            ├── syllabus-mastery.json
            ├── exam-readiness.json
            ├── learning-style.json
            ├── velocity.json
            └── affective-history.json
```

---

## Architecture Overview

OpenTutor uses a three-layer Electron architecture:

```
┌──────────────────────────────────────────────────┐
│  Presentation Layer  (Renderer process — React)  │
│  Chat Window · Progress Dashboard · Settings     │
└───────────────────────┬──────────────────────────┘
                        │  IPC  (preload.js bridge)
┌───────────────────────▼──────────────────────────┐
│  Application Layer  (Main process — Node.js)     │
│                                                  │
│  Agent Coordinator                               │
│    ↓ Memory Manager   → raw student data         │
│    ↓ Student Model    → synthesised profile      │
│    ↓ Skill Manager    → match + execute skill    │
│    ↓ Model Manager    → LLM call                 │
│    ↓ Adaptive Feedback Engine → personalise      │
│    ↓ Passive Skills   → update memory silently   │
└───────────────────────┬──────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────┐
│  Infrastructure Layer                            │
│  File System · Ollama Client · HTTP Client       │
└──────────────────────────────────────────────────┘
```

**Every conversation turn follows this pipeline:**

1. Student message arrives via IPC
2. **Memory Manager** retrieves the student's raw persistent data
3. **Student Model Module** synthesises it into an actionable profile (mastery, style, velocity, affective state, exam readiness)
4. **Skill Manager** keyword-matches the input and executes the best skill
5. **Model Manager** calls the active LLM (local Ollama or cloud)
6. **Adaptive Feedback Engine** adjusts the raw response — tone, scaffolding depth, format, urgency
7. **Passive skills** run silently in the background, updating the student model
8. Personalised response is returned to the renderer

---

## Skill System

Skills are self-contained plugins in `src/skills/`. Each skill is a directory containing two files:

- `SKILL.md` — declares the skill's name, type, trigger keywords, input/output contract, and description. The Skill Manager reads this at startup.
- `index.js` — implements `execute(params, context)` and returns `{ result, visualization, syllabusPoint, ... }`.

### Active skills (20)

Active skills produce a direct response to the student.

| Phase | Skill | What it does |
|:---:|:---|:---|
| 1 | `identify-syllabus-topic` | Maps any question to its NESA dot-point code |
| 1 | `hsc-worked-example` | Full step-by-step solution in HSC examiner format |
| 1 | `marking-guideline-feedback` | Marks answers against official NESA criteria with partial credit |
| 1 | `error-analysis` | Diagnoses mistakes as conceptual, computational, or misread |
| 1 | `socratic-questioning` | Guides the student to the answer using Socratic questions |
| 1 | `solve-equation` | Algebraic equation solving |
| 1 | `plot-function` | Function visualisation with graph output |
| 1 | `generate-quiz` | Generates practice questions calibrated to mastery level |
| 2 | `past-paper-practice` | Serves real HSC past paper questions; supports timed mode |
| 2 | `adaptive-drill` | Drill session that steps difficulty up or down based on accuracy |
| 2 | `hint-scaffolding` | Four-tier progressive scaffold (orientation → near-complete) |
| 2 | `multi-representation` | Same concept shown algebraically, numerically, and visually |
| 2 | `exam-technique-coach` | Advice on answer presentation and time management |
| 2 | `session-planner` | Builds a focused session plan from mastery gaps and exam timeline |
| 3 | `spaced-review` | Schedules weak-topic review using the forgetting curve |
| 3 | `knowledge-gap-mapping` | Identifies prerequisite gaps from mistake patterns |
| 3 | `progress-celebration` | Surfaces genuine improvements to reinforce motivation |
| 3 | `session-summary` | End-of-session summary of what was covered and what to revisit |
| 3 | `emotional-support` | Responds to frustration and disengagement with encouragement |
| — | `general-conversation` | Fallback for any input that doesn't trigger a specific skill |

### Passive skills (4)

Passive skills run silently after every interaction, updating the Student Model without producing a visible response.

| Skill | What it observes |
|:---|:---|
| `detect-learning-style` | Infers visual / algebraic / numerical preference from interaction patterns |
| `cognitive-load-monitor` | Detects fatigue and overload from attempt timing and error patterns |
| `velocity-tracker` | Tracks mastery change rate per topic over time |
| `engagement-tracker` | Monitors session-level engagement signals (frustration, confidence, fatigue) |

---

## Data & Privacy

All student data is stored **locally** on your own machine in the `data/` directory. Nothing is sent to any external server unless you explicitly choose to use a cloud model in Settings, in which case your messages are sent to that cloud provider's API only.

The `data/` directory is not committed to git (it is listed in `.gitignore`). It contains:

- `data/config/user-config.json` — your model preferences and (optionally) cloud API keys
- `data/students/default/` — your full learning history, mastery profile, and personalisation data

You can delete the `data/` directory at any time to start fresh. Backing it up preserves your entire learning history.

---

## Running the Tests

```bash
# Run all test suites
npm test

# Run individual suites
npm run test:memory    # Memory Manager — 40 tests
npm run test:model     # Model Manager  — 38 tests
npm run test:skills    # Skill Manager  — 49 tests
```

Tests are plain Node.js scripts (no test framework dependency). Each prints a pass/fail summary and exits with code 0 on success or 1 on failure.

---

## Building a Distributable

```bash
# Build for the current platform
npm run build

# Build for a specific platform
npm run build:win    # Windows — produces an NSIS installer in dist/
npm run build:mac    # macOS   — produces a DMG in dist/
npm run build:linux  # Linux   — produces an AppImage and .deb in dist/
```

Output is written to the `dist/` directory. Cross-platform builds (e.g. building a Windows installer on macOS) require additional tooling — see the [electron-builder documentation](https://www.electron.build/multi-platform-build).

---

## Adding a New Skill

1. Create a new directory under `src/skills/your-skill-name/`.

2. Write `SKILL.md` declaring the skill's metadata and trigger keywords:

```markdown
# Skill: your-skill-name

## Meta
- **Name**: your-skill-name
- **Type**: active   # or passive
- **Phase**: Phase N — short description
- **Version**: 1.0.0

## Description
What this skill does and when it fires.

## Triggers
\`\`\`json
{
  "keywords": ["trigger word one", "trigger word two"],
  "intent": "one-sentence description of the user intent this skill handles"
}
\`\`\`

## Inputs
- `params`: { userInput, ... }
- `context`: { studentId, memory, studentModel, model, knowledgeBase }

## Outputs
- `result`: the text response
- `visualization`: null or a graph spec object
- `syllabusPoint`: NESA dot-point code or null
```

3. Write `index.js` implementing the `execute` function:

```javascript
'use strict';

module.exports = {
  meta: {
    name:    'your-skill-name',
    version: '1.0.0',
    type:    'active',   // or 'passive'
  },

  execute: async function (params, context) {
    const { userInput } = params;
    const { studentId, memory, studentModel, model, knowledgeBase } = context;

    // Build system + user prompts
    const response = await model.chat([
      { role: 'system', content: 'Your system prompt here.' },
      { role: 'user',   content: userInput },
    ], {
      temperature: 0.7,
      maxTokens:   500,
      skillName:   'your-skill-name',
      studentId,
    });

    return {
      result:        response,
      visualization: null,
      syllabusPoint: null,
    };
  },
};
```

4. Restart the app. The Skill Manager automatically discovers the new skill directory on startup — no registration step is needed.

---

## Tech Stack

| Layer | Technology | Why |
|:---|:---|:---|
| Desktop framework | [Electron](https://www.electronjs.org/) v33 | Cross-platform desktop app with web technologies |
| UI framework | [React](https://react.dev/) | Component-based; rich ecosystem |
| Maths rendering | [KaTeX](https://katex.org/) | Fast, beautiful formula rendering in the chat window |
| Charts | [Chart.js](https://www.chartjs.org/) | Progress dashboard and syllabus heatmap |
| HTTP client | [axios](https://axios-http.com/) | Cloud model API calls with timeout and retry support |
| Markdown parser | [marked](https://marked.js.org/) | Parses student profile and mistake files |
| Local AI | [Ollama](https://ollama.com/) | Runs quantised models locally; no internet required |
| Build tool | [electron-builder](https://www.electron.build/) | Produces signed installers for Win / Mac / Linux |

---

## Licence

Apache 2.0 © 2025 OpenTutor