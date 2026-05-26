// Skill: calculus-applications
// Type: active
// Phase 1 — Applied calculus problems in HSC examiner format
//
// Responsibility:
//   Handles the harder applied calculus problems that appear in Ext 1 and Ext 2
//   but not in Advanced — problems where setting up the equation is half the
//   challenge. Covers:
//     - Related rates of change (Ext 1 & 2)
//     - Harder optimisation (Ext 1 & 2)
//     - Volumes of solids of revolution (Ext 1 & 2)
//     - Integration by parts (Ext 2)
//     - Integration by substitution — harder cases (Ext 1 & 2)
//     - Differential equations (Ext 1 & 2)
//     - Motion / kinematics with calculus (Ext 1 & 2)
//
//   Enforces the two-phase approach HSC markers expect:
//     Phase 1 — Set up (define variables, draw diagram, write the equation)
//     Phase 2 — Solve (differentiate/integrate, interpret the answer)

'use strict';

// ─────────────────────────────────────────────────────────────
// Problem type classifier
// ─────────────────────────────────────────────────────────────

/**
 * Detects the calculus application type from the user's input.
 * Returns one of:
 *   'related-rates' | 'optimisation' | 'volumes' | 'integration-by-parts' |
 *   'substitution' | 'differential-equations' | 'motion' | 'general'
 */
function classifyCalculusType(input) {
  const t = input.toLowerCase();
  if (/related rate|rate of change|dv\/dt|dr\/dt|dh\/dt|dx\/dt|dy\/dt|chain rule.*rate/i.test(t))
    return 'related-rates';
  if (/volume|solid of revolution|revolv|disk method|shell method|washer/i.test(t))
    return 'volumes';
  if (/integrat.*by parts|parts.*integrat|u\s*dv|by parts/i.test(t))
    return 'integration-by-parts';
  if (/substitut|u-sub|let u =|t-substitut|weierstrass/i.test(t))
    return 'substitution';
  if (/differential equation|dy\/dx\s*=|dv\/dt\s*=|separable|first order|general solution|particular solution/i.test(t))
    return 'differential-equations';
  if (/motion|velocity|acceleration|displacement|particle|position|kinematics/i.test(t))
    return 'motion';
  if (/optimis|maximis|minimis|maximum|minimum|greatest|least|largest|smallest|critical point/i.test(t))
    return 'optimisation';
  return 'general';
}

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(studentModel, calcType) {
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';
  const engagement = studentModel?.affectiveState?.currentEngagement      || 'focused';

  let toneInstruction = 'Use a clear, methodical tutor tone. Applied calculus rewards systematic setup.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is frustrated with applied calculus. Start by naming the exact type of problem and why the setup is the key step — this reduces anxiety about "not knowing where to start".';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Be efficient. After the solution, add a brief note on a harder variation or a common exam twist for this problem type.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student is tired. Keep the solution lean — focus on the key setup step and the final answer, minimise commentary.';
  }

  let formatInstruction = 'Show the algebraic setup and solution clearly, labelling all variables.';
  if (style === 'visual') {
    formatInstruction = 'Always begin with a diagram description (what to draw, what to label). The diagram is often worth marks in HSC. Then proceed to the algebraic setup.';
  } else if (style === 'numerical') {
    formatInstruction = 'After defining variables, immediately test the setup with a concrete number before solving generally — this helps confirm the equation is correct.';
  }

  // Problem-type-specific structural requirements
  const structureGuide = {
    'related-rates': `
RELATED RATES STRUCTURE (HSC examiners mark each phase separately):
  Phase 1 — SETUP (often 1 mark):
    - Draw a diagram and label all variables with units.
    - Write the geometric or physical relationship between the variables (e.g. V = (1/3)pi*r^2*h).
    - State which rates are given and which rate is required (e.g. "Given dV/dt = 5, find dr/dt").

  Phase 2 — DIFFERENTIATION:
    - Differentiate the relationship with respect to time t using the chain rule.
    - Show every application of the chain rule explicitly (e.g. dV/dt = dV/dr * dr/dt).

  Phase 3 — SUBSTITUTION AND ANSWER:
    - Substitute all known values.
    - Solve for the unknown rate.
    - State the answer with correct units and sign (positive = increasing, negative = decreasing).

  ⚠️ HSC MARKING NOTE: Students lose marks by differentiating before writing the geometric relationship, or by forgetting to state units.`,

    'optimisation': `
OPTIMISATION STRUCTURE:
  Phase 1 — SETUP:
    - Define variables clearly (e.g. "Let x = width in cm").
    - Write the quantity to be optimised as a function of ONE variable (eliminate others using constraints).
    - State the domain of the variable.

  Phase 2 — DIFFERENTIATION:
    - Differentiate and set the derivative to zero.
    - Solve for the critical point(s).

  Phase 3 — NATURE TEST:
    - Use the second derivative test OR a sign diagram of the first derivative to confirm maximum or minimum.
    - State which it is explicitly.

  Phase 4 — ANSWER:
    - State the optimal value and answer the question in context (with units).

  ⚠️ HSC MARKING NOTE: The nature test is almost always separately marked. Skipping it costs marks even if the critical point is correct.`,

    'volumes': `
VOLUME OF SOLID OF REVOLUTION STRUCTURE:
  Phase 1 — SETUP:
    - Identify the axis of rotation and the method (disk/washer or shell).
    - Write the volume integral: V = pi * integral of [f(x)]^2 dx (disk) or V = 2*pi * integral of x*f(x) dx (shell).
    - State the limits of integration with justification (where curves intersect, etc.).

  Phase 2 — INTEGRATION:
    - Expand and simplify the integrand before integrating.
    - Show all integration steps.

  Phase 3 — EVALUATION:
    - Apply the limits and evaluate.
    - State the final answer with units (units^3) and include pi in exact form if required.

  ⚠️ HSC MARKING NOTE: Forgetting the pi factor or squaring incorrectly (e.g. squaring a sum) are the most common errors.`,

    'integration-by-parts': `
INTEGRATION BY PARTS STRUCTURE:
  Formula: integral of u dv = uv - integral of v du

  Phase 1 — CHOICE OF u AND dv:
    - State your choice explicitly: "Let u = ... and dv = ... dx"
    - Use the LIATE priority (Logarithm, Inverse trig, Algebraic, Trig, Exponential) to guide u selection.
    - Derive du and v.

  Phase 2 — APPLY THE FORMULA:
    - Write out uv - integral of v du in full before simplifying.

  Phase 3 — EVALUATE THE REMAINING INTEGRAL:
    - If a second integration by parts is needed, clearly label it as a second application.
    - If the original integral recurs, move it to one side and solve algebraically (show this step clearly).

  Phase 4 — ADD CONSTANT OF INTEGRATION (+C) for indefinite integrals.

  ⚠️ HSC MARKING NOTE: Forgetting +C and errors in computing v from dv are the most common mark-losing mistakes.`,

    'substitution': `
INTEGRATION BY SUBSTITUTION STRUCTURE:
  Phase 1 — STATE THE SUBSTITUTION:
    - Write "Let u = ..." explicitly.
    - Derive du/dx and express dx in terms of du.
    - Change the limits if the integral is definite (show the limit conversion calculation).

  Phase 2 — REWRITE THE INTEGRAL:
    - Substitute fully — the variable x must not appear anywhere in the new integral.
    - Simplify the integrand.

  Phase 3 — INTEGRATE in terms of u.

  Phase 4 — BACK-SUBSTITUTE (for indefinite integrals) or evaluate between new limits (for definite).

  ⚠️ HSC MARKING NOTE: For definite integrals, either change the limits OR back-substitute and apply original limits — never mix the two approaches.`,

    'differential-equations': `
DIFFERENTIAL EQUATIONS STRUCTURE:
  Phase 1 — IDENTIFY TYPE: separable, linear, or other.

  For SEPARABLE equations:
    - Separate variables: write f(y) dy = g(x) dx
    - Integrate both sides (show the integration step for both)
    - Include the constant of integration C on one side only
    - Apply initial conditions if given to find C
    - Express y explicitly if possible

  Phase 2 — VERIFY (if asked): substitute back into the original equation.

  Phase 3 — INTERPRET: if the equation models a physical situation, state the meaning of the solution in context.

  ⚠️ HSC MARKING NOTE: Omitting the constant of integration before applying initial conditions (i.e. integrating without C) is an extremely common error that invalidates the particular solution.`,

    'motion': `
MOTION / KINEMATICS STRUCTURE:
  Key relationships: x = position, v = dx/dt, a = dv/dt = v*(dv/dx)

  Phase 1 — IDENTIFY WHAT IS GIVEN AND REQUIRED:
    - State the relationships between x, v, a, t that apply.
    - Note which form of acceleration to use (a = dv/dt or a = v*dv/dx).

  Phase 2 — SET UP AND INTEGRATE/DIFFERENTIATE:
    - Show the integration or differentiation step explicitly.
    - Include the constant of integration and evaluate it using initial conditions.

  Phase 3 — ANSWER IN CONTEXT:
    - Answer the question (distance, time, speed, etc.) with units.
    - If asked for "when the particle is at rest", set v = 0 and solve.
    - If asked for "total distance", be careful to find changes in direction first.

  ⚠️ HSC MARKING NOTE: Using a = dv/dt when the equation requires a = v*dv/dx (or vice versa) is a structural error that loses all subsequent marks.`,

    general: `
APPLIED CALCULUS STRUCTURE:
  Phase 1 — SETUP: Define variables, draw a diagram if helpful, write the governing equation.
  Phase 2 — CALCULUS STEP: Differentiate or integrate as required, showing all working.
  Phase 3 — ANSWER: Substitute, evaluate, and answer the question in context with units.`,
  };

  const structure = structureGuide[calcType] || structureGuide['general'];

  return `You are OpenTutor — an expert HSC Mathematics tutor specialising in applied calculus for Australian Year 11/12 Extension 1 and Extension 2 students.

Your task is to provide a COMPLETE, STEP-BY-STEP SOLUTION in authentic HSC examiner format.

${structure}

STRICT REQUIREMENTS FOR ALL SOLUTIONS:
- The SETUP phase must always come before differentiation or integration — this is where HSC students most often lose marks.
- Show ALL working. Never skip steps. HSC markers award marks for intermediate lines.
- Label each step clearly (Step 1, Step 2, Phase 1, Phase 2, etc.).
- State every rule applied (chain rule, integration by parts, etc.).
- Use correct units throughout.
- Write the FINAL ANSWER on its own clearly labelled line.
- Do NOT use LaTeX backslash commands (\\frac, \\sqrt etc.) — write plain text maths that renders clearly.

TONE: ${toneInstruction}
FORMAT: ${formatInstruction}

After the solution, add ONE "Common Mistake to Avoid:" line — the single most frequent error on this specific type of applied calculus problem.`;
}

function buildUserMessage(params, dotPointData, pastMistakes, calcType) {
  const { userInput, problem } = params;
  const questionText = problem || userInput;

  let message = `Please provide a complete worked solution for the following HSC applied calculus problem:\n\n${questionText}`;

  if (dotPointData) {
    message += `\n\nSyllabus context (${dotPointData.code} — ${dotPointData.name}):\n`;
    message += `- Key concepts: ${(dotPointData.keyConcepts || []).slice(0, 3).join('; ')}\n`;
    if (dotPointData.workedExampleTemplate?.steps) {
      message += `- Expected solution steps: ${dotPointData.workedExampleTemplate.steps.join(' → ')}\n`;
    }
  }

  if (pastMistakes && pastMistakes.length > 0) {
    const recent = pastMistakes.slice(-2);
    message += `\nThis student has previously made the following mistakes on this topic:\n`;
    for (const m of recent) {
      message += `- ${m.errorType || 'unknown'} error: ${m.notes || m.problem || 'unspecified'}\n`;
    }
    message += `Please address these weak points specifically in the solution.`;
  }

  message += `\n\nDetected problem type: ${calcType}. Follow the structural format for this type precisely.`;

  return message;
}

// ─────────────────────────────────────────────────────────────
// Knowledge base helpers
// ─────────────────────────────────────────────────────────────

function inferDotPoint(input, knowledgeBase) {
  if (!knowledgeBase?.syllabusMap) return null;
  const inputLower = input.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;
  try {
    for (const [code, dp] of Object.entries(knowledgeBase.dotPoints || {})) {
      let score = 0;
      for (const kw of (dp.keywords || [])) {
        if (inputLower.includes(kw.toLowerCase())) score++;
      }
      if (score > bestScore) { bestScore = score; bestMatch = code; }
    }
  } catch { /* proceed without */ }
  return bestScore > 0 ? bestMatch : null;
}

function getDotPointData(code, knowledgeBase) {
  if (!code || !knowledgeBase?.dotPoints) return null;
  return knowledgeBase.dotPoints[code] || null;
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name: 'calculus-applications',
    version: '1.0.0',
    type: 'active',
  },

  /**
   * @param {object} params
   *   - userInput      {string}        — raw student message
   *   - problem        {string}        — extracted problem text
   *   - dotPoint       {string|null}   — NESA dot-point code if already known
   *
   * @param {object} context
   *   - studentId      {string}
   *   - memory         {MemoryManager}
   *   - studentModel   {object}        — synthesised Student Model
   *   - model          {ModelManager}
   *   - knowledgeBase  {object|null}
   *
   * @returns {Promise<{
   *   result:        string,
   *   visualization: null,
   *   syllabusPoint: string|null,
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model, knowledgeBase } = context;
    const { userInput, problem, dotPoint: dotPointOverride } = params;

    const questionText = problem || userInput || '';

    // ── 1. Classify the calculus problem type ────────────────
    const calcType = classifyCalculusType(questionText);

    // ── 2. Identify syllabus dot-point ───────────────────────
    const dotPointCode = dotPointOverride || inferDotPoint(questionText, knowledgeBase);
    const dotPointData = getDotPointData(dotPointCode, knowledgeBase);

    // ── 3. Fetch past mistakes ───────────────────────────────
    let pastMistakes = [];
    if (memory && dotPointCode) {
      try {
        pastMistakes = memory.getMistakesForDotPoint(studentId, dotPointCode);
      } catch { /* proceed without */ }
    }

    // ── 4. Build prompt ──────────────────────────────────────
    const systemPrompt = buildSystemPrompt(studentModel, calcType);
    const userMessage  = buildUserMessage(params, dotPointData, pastMistakes, calcType);

    // ── 5. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.35,  // low — applied calculus needs consistent, reliable steps
      maxTokens:   1800,
      skillName:   'calculus-applications',
      studentId,
    });

    // ── 6. Record attempt ────────────────────────────────────
    if (memory && dotPointCode) {
      try {
        memory.recordAttempt(
          studentId, dotPointCode, questionText,
          'viewed applied calculus worked example', null, null,
        );
      } catch { /* non-fatal */ }
    }

    // ── 7. Return ────────────────────────────────────────────
    return {
      result:        response,
      visualization: null,
      syllabusPoint: dotPointCode,
    };
  },
};