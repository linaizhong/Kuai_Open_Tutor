// Skill: hint-scaffolding
// Type: active
// Phase 2 — Progressive hints without jumping to the answer
//
// Responsibility:
//   Deliver tiered, progressive hints that scaffold the student toward
//   the solution without ever revealing it. Each call escalates the
//   hintLevel by one tier:
//
//     Level 1 — Orientation:  "What type of problem is this?"
//     Level 2 — Method:       Name the technique or formula needed
//     Level 3 — First step:   Partially set up the working
//     Level 4 — Near-complete: Almost everything laid out; student completes it
//
//   Unlike socratic-questioning (which asks one Socratic question and waits),
//   hint-scaffolding is explicitly requested by a student who has ALREADY
//   asked for more help and needs a more direct, structured scaffold.
//
//   Inputs from Coordinator session state:
//     - hintLevel       — 1–4, incremented by Coordinator on each call
//     - previousHints   — array of previously delivered hint strings (avoid repetition)
//     - problem         — the problem being worked on

'use strict';

// ─────────────────────────────────────────────────────────────
// Knowledge base helpers
// ─────────────────────────────────────────────────────────────

function inferDotPoint(text, knowledgeBase) {
  if (!knowledgeBase?.dotPoints || !text) return null;
  const lower = text.toLowerCase();
  let best = null, bestScore = 0;
  for (const [code, dp] of Object.entries(knowledgeBase.dotPoints)) {
    let score = 0;
    for (const kw of (dp.keywords || [])) {
      if (lower.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) { bestScore = score; best = code; }
  }
  return bestScore > 0 ? best : null;
}

function getDotPointData(code, knowledgeBase) {
  if (!code || !knowledgeBase?.dotPoints) return null;
  return knowledgeBase.dotPoints[code] || null;
}

// ─────────────────────────────────────────────────────────────
// Hint level helpers
// ─────────────────────────────────────────────────────────────

const HINT_LEVEL_MAX = 4;

/**
 * Maps a hint level to a human-readable label and instructions for the LLM.
 *
 * @param {number} level  — 1–4
 * @returns {{ label: string, instruction: string }}
 */
function hintLevelSpec(level) {
  switch (level) {
    case 1:
      return {
        label: 'orientation',
        instruction:
          'Give a LEVEL 1 — ORIENTATION hint. ' +
          'Help the student recognise what kind of problem this is and which area of mathematics it falls under. ' +
          'Do NOT name the specific technique yet. Ask them: "What type of problem does this look like to you?"',
      };
    case 2:
      return {
        label: 'method',
        instruction:
          'Give a LEVEL 2 — METHOD hint. ' +
          'Name the specific technique, rule, or formula they need (e.g. "You\'ll want to use the product rule here"). ' +
          'Do NOT show how to apply it yet. You may remind them of the formula, but do not substitute values.',
      };
    case 3:
      return {
        label: 'first-step',
        instruction:
          'Give a LEVEL 3 — FIRST STEP scaffold. ' +
          'Partially set up the first step of the working (e.g. "Start by writing f\'(x) = ... — what goes in each part?"). ' +
          'You may write the formula with placeholders (a, b, ...) but do NOT fill in the numbers. ' +
          'The student must still complete the substitution and calculation themselves.',
      };
    case 4:
    default:
      return {
        label: 'near-complete',
        instruction:
          'Give a LEVEL 4 — NEAR-COMPLETE scaffold. ' +
          'Lay out almost all of the working, leaving only the final calculation or conclusion for the student to complete. ' +
          'Make clear what the final step is. This is the last scaffold before you would give the full solution.',
      };
  }
}

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(hintLevel, studentModel) {
  const engagement = studentModel?.affectiveState?.currentEngagement || 'focused';
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';
  const { label, instruction } = hintLevelSpec(hintLevel);

  let toneInstruction = 'Be warm, patient, and encouraging. You are scaffolding, not solving.';
  if (engagement === 'frustrated') {
    toneInstruction =
      'The student is frustrated and has asked for more help multiple times. ' +
      'Open with a brief, genuine acknowledgement ("This one is genuinely tricky — let\'s break it down together."). ' +
      'Then deliver the scaffold clearly and calmly.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student is tired. Keep everything short and simple. No unnecessary explanation.';
  }

  let styleNote = '';
  if (style === 'visual') {
    styleNote = '\nIf helpful, suggest what a sketch or diagram would look like at this stage.';
  } else if (style === 'numerical') {
    styleNote = '\nIf helpful, suggest they try substituting a simple number to see the pattern.';
  } else if (style === 'algebraic') {
    styleNote = '\nPrefer algebraic setups and symbolic notation over verbal description.';
  }

  return `You are OpenTutor — an expert HSC Mathematics Advanced tutor for Australian Year 11/12 students.

The student has explicitly asked for more structured help. You are delivering a PROGRESSIVE SCAFFOLD — a tiered hint system that gets more detailed with each request.

CURRENT HINT LEVEL: ${hintLevel} of ${HINT_LEVEL_MAX} (${label})

YOUR TASK: ${instruction}

STRICT RULES:
- Do NOT give the full answer or complete any calculation the student must do.
- Do NOT repeat hints the student has already received — build on them.
- Keep your response to 3–5 sentences maximum.
- End with a single, clear prompt: tell the student exactly what to do next.
${hintLevel === HINT_LEVEL_MAX ? '- This is the last hint tier. Make it as clear as possible so the student can finish independently.' : ''}

TONE: ${toneInstruction}${styleNote}`;
}

function buildUserMessage(params, dotPointData, hintLevel) {
  const { userInput, problem, previousHints = [] } = params;

  let msg = '';

  // What problem are we scaffolding?
  if (problem) {
    msg += `The student is working on:\n"${problem}"\n\n`;
  } else {
    msg += `Student's message: "${userInput}"\n\n`;
  }

  // Syllabus context to inform the scaffold
  if (dotPointData) {
    msg += `Syllabus dot-point: ${dotPointData.code} — ${dotPointData.name}\n`;
    if (hintLevel >= 2 && dotPointData.keyConcepts?.length > 0) {
      msg += `Key concepts for this topic:\n`;
      for (const c of dotPointData.keyConcepts.slice(0, 4)) {
        msg += `  - ${c}\n`;
      }
    }
    if (hintLevel >= 3 && dotPointData.commonErrors?.length > 0) {
      msg += `Common errors on this topic (help the student avoid these):\n`;
      for (const e of dotPointData.commonErrors.slice(0, 2)) {
        msg += `  - ${e}\n`;
      }
    }
    // Use pre-written scaffold steps from KB if available
    if (hintLevel >= 3 && dotPointData.scaffoldSteps?.length > 0) {
      const step = dotPointData.scaffoldSteps[hintLevel - 3] || dotPointData.scaffoldSteps[0];
      if (step) {
        msg += `\nSuggested scaffold step for this topic: "${step}"\n`;
        msg += `Adapt this to the specific problem above.\n`;
      }
    }
  }

  // Previous hints — so the LLM can build on them without repeating
  if (previousHints.length > 0) {
    msg += `\nHints already given (do NOT repeat these — build further):\n`;
    previousHints.slice(-3).forEach((h, i) => {
      // Truncate long hints for brevity
      const preview = h.length > 120 ? h.slice(0, 120) + '…' : h;
      msg += `  ${i + 1}. ${preview}\n`;
    });
  }

  msg += `\nNow deliver the Level ${hintLevel} scaffold. Do not give the full solution.`;
  return msg;
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name:    'hint-scaffolding',
    version: '1.0.0',
    type:    'active',
  },

  /**
   * @param {object} params
   *   - userInput     {string}         — raw student message
   *   - problem       {string|null}    — the problem being scaffolded
   *   - hintLevel     {number}         — current scaffold tier: 1–4 (Coordinator increments this)
   *   - previousHints {string[]}       — hints already delivered (avoids repetition)
   *   - dotPoint      {string|null}    — NESA dot-point if known
   *
   * @param {object} context
   *   - studentId, memory, studentModel, model, knowledgeBase
   *
   * @returns {Promise<{
   *   result:        string,
   *   visualization: null,
   *   syllabusPoint: string|null,
   *   hintLevel:     number,    — echoed back so Coordinator can track escalation
   *   isFinalHint:   boolean,   — true when hintLevel === HINT_LEVEL_MAX
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, studentModel, model, knowledgeBase } = context;
    const {
      userInput     = '',
      problem       = null,
      hintLevel     = 1,
      previousHints = [],
    } = params;

    // ── 1. Clamp hint level ──────────────────────────────────
    const level = Math.max(1, Math.min(hintLevel, HINT_LEVEL_MAX));

    // ── 2. Identify dot-point ────────────────────────────────
    const searchText   = problem || userInput || '';
    const dotPointCode = params.dotPoint || inferDotPoint(searchText, knowledgeBase);
    const dotPointData = getDotPointData(dotPointCode, knowledgeBase);

    // ── 3. Build prompts ─────────────────────────────────────
    const systemPrompt = buildSystemPrompt(level, studentModel);
    const userMessage  = buildUserMessage(
      { userInput, problem, previousHints },
      dotPointData,
      level,
    );

    // ── 4. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.5,   // scaffolds should be consistent; slight variation is fine
      maxTokens:   400,
      skillName:   'hint-scaffolding',
      studentId,
    });

    // ── 5. Return ────────────────────────────────────────────
    return {
      result:        response,
      visualization: null,
      syllabusPoint: dotPointCode,
      hintLevel:     level,
      isFinalHint:   level >= HINT_LEVEL_MAX,
    };
  },
};