// Skill: mathematical-proof
// Type: active
// Phase 1 — Formal mathematical proof in HSC examiner format
//
// Responsibility:
//   Handles all HSC proof questions across Ext 1 and Ext 2:
//     - Mathematical induction (Ext 1 & 2)
//     - Direct proof
//     - Proof by contradiction
//     - Proof by contrapositive
//     - Inequality proofs (Ext 2)
//     - Complex number proofs (Ext 2)
//
//   Enforces the strict formal structure HSC markers award marks for.
//   Personalises depth and tone using the Student Model.

'use strict';

// ─────────────────────────────────────────────────────────────
// Proof type classifier
// ─────────────────────────────────────────────────────────────

/**
 * Detects the proof type from the user's input.
 * Returns one of: 'induction' | 'contradiction' | 'contrapositive' |
 *                 'direct' | 'inequality' | 'complex' | 'general'
 */
function classifyProofType(input) {
  const t = input.toLowerCase();
  if (/induct/i.test(t))                                        return 'induction';
  if (/contradict|assume.*true.*false|assume.*false.*true/i.test(t)) return 'contradiction';
  if (/contraposit/i.test(t))                                   return 'contrapositive';
  if (/inequalit|am.gm|cauchy|triangle inequality/i.test(t))    return 'inequality';
  if (/complex|arg\(|mod\(|de moivre/i.test(t))                 return 'complex';
  return 'direct';
}

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(studentModel, proofType) {
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';
  const engagement = studentModel?.affectiveState?.currentEngagement      || 'focused';

  let toneInstruction = 'Use a clear, precise tutor tone. Proof writing rewards careful language.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is frustrated. Start with a brief reassurance, then break the proof into very small, clear steps.';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Be concise. After the proof, add a brief note on a harder extension or common variation.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student is tired. Keep the proof clean and minimal — no extra commentary beyond what is needed for marks.';
  }

  let formatInstruction = 'Present the proof algebraically with clear justification at each step.';
  if (style === 'visual') {
    formatInstruction = 'Where possible, open with a brief visual or numerical motivation before the formal proof (e.g. "If we test n=1,2,3 we see the pattern..."), then proceed formally.';
  } else if (style === 'numerical') {
    formatInstruction = 'After each algebraic step, briefly note what it means with a concrete number to ground the abstraction.';
  }

  // Proof-type-specific structural requirements
  const structureGuide = {
    induction: `
MATHEMATICAL INDUCTION STRUCTURE (marks are awarded per stage):
  Step 1 — Base Case: Prove the statement is true for n = 1 (or the stated starting value). Show full substitution and evaluation. State "The statement is true for n = 1."
  Step 2 — Inductive Assumption: State explicitly "Assume the statement is true for n = k", then write out what that assumption says algebraically.
  Step 3 — Inductive Step: Prove the statement is true for n = k + 1. Start from the LHS of the k+1 case. Use the inductive assumption explicitly (label it "By the inductive assumption:"). Arrive at the RHS through valid algebraic steps only.
  Step 4 — Conclusion: "Since the statement is true for n = 1, and if true for n = k it is true for n = k + 1, by mathematical induction the statement is true for all integers n ≥ 1."
  ⚠️ HSC MARKING NOTE: Each stage (base case, assumption, step, conclusion) is independently marked. Never skip or combine stages.`,

    contradiction: `
PROOF BY CONTRADICTION STRUCTURE:
  Step 1 — Assumption: "Assume, for the sake of contradiction, that [negation of what you want to prove]."
  Step 2 — Logical deduction: Follow valid algebraic/logical steps from the assumption.
  Step 3 — Contradiction: Arrive at a statement that contradicts a known fact, a given condition, or the assumption itself. Label it clearly: "This is a contradiction."
  Step 4 — Conclusion: "Therefore our assumption was false, and [original statement] must be true."`,

    contrapositive: `
PROOF BY CONTRAPOSITIVE STRUCTURE:
  Step 1 — State the contrapositive: "We prove the contrapositive: if [not Q] then [not P]."
  Step 2 — Assume not Q and derive not P through valid steps.
  Step 3 — Conclusion: "Since the contrapositive is true, the original statement is true."`,

    inequality: `
INEQUALITY PROOF STRUCTURE:
  Step 1 — State the strategy (AM-GM, squaring both sides, completing the square, etc.).
  Step 2 — Show all algebraic manipulations clearly, justifying each inequality sign direction.
  Step 3 — State when equality holds.
  Step 4 — Conclude with the original inequality restored.
  ⚠️ HSC MARKING NOTE: You must state the equality condition and justify each inequality step — do not just assert ≥ or ≤ without explanation.`,

    complex: `
COMPLEX NUMBER PROOF STRUCTURE:
  Step 1 — State key properties being used (modulus-argument form, conjugate properties, De Moivre's theorem, etc.).
  Step 2 — Show all algebraic steps in full, using z = x + iy or polar form as appropriate.
  Step 3 — Verify any geometric interpretation if relevant (e.g. locus, argument bounds).
  Step 4 — State the conclusion clearly.`,

    direct: `
DIRECT PROOF STRUCTURE:
  Step 1 — State what is given and what must be shown.
  Step 2 — Proceed step by step using definitions, axioms, or known results. Justify each step.
  Step 3 — Arrive at the conclusion and state it clearly.`,

    general: `
PROOF STRUCTURE:
  Step 1 — Identify the proof technique appropriate to this problem.
  Step 2 — State all assumptions and givens.
  Step 3 — Develop the argument with clear justification at each step.
  Step 4 — State the conclusion explicitly.`,
  };

  const structure = structureGuide[proofType] || structureGuide['general'];

  return `You are OpenTutor — an expert HSC Mathematics tutor specialising in formal proof for Australian Year 11/12 Extension 1 and Extension 2 students.

Your task is to present a COMPLETE, FORMALLY CORRECT PROOF in authentic HSC examiner format.

${structure}

STRICT REQUIREMENTS FOR ALL PROOFS:
- Every step must be explicitly justified. Never skip steps that carry marks.
- Use correct mathematical language: "therefore", "since", "by [theorem/property]", "it follows that".
- Do NOT use LaTeX backslash commands (\\frac, \\sqrt etc.) — write plain text maths that renders clearly.
- Do NOT use informal language like "obviously" or "clearly" — write out the reasoning.
- The final conclusion must be a complete sentence restating what has been proved.
- Keep notation consistent throughout.

TONE: ${toneInstruction}
FORMAT: ${formatInstruction}

After the proof, add ONE "HSC Marker's Note:" line — the single most common reason students lose marks on this type of proof.`;
}

function buildUserMessage(params, dotPointData, pastMistakes, proofType) {
  const { userInput, problem } = params;
  const questionText = problem || userInput;

  let message = `Please provide a complete formal proof for the following HSC question:\n\n${questionText}`;

  if (dotPointData) {
    message += `\n\nSyllabus context (${dotPointData.code} — ${dotPointData.name}):\n`;
    message += `- Key concepts: ${(dotPointData.keyConcepts || []).slice(0, 3).join('; ')}\n`;
  }

  if (pastMistakes && pastMistakes.length > 0) {
    const recent = pastMistakes.slice(-2);
    message += `\nThis student has previously made the following mistakes on proof questions:\n`;
    for (const m of recent) {
      message += `- ${m.errorType || 'unknown'} error: ${m.notes || m.problem || 'unspecified'}\n`;
    }
    message += `Please make sure the proof specifically addresses these weak points.`;
  }

  message += `\n\nDetected proof type: ${proofType}. Ensure the proof follows the correct structural format for this type.`;

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
    name: 'mathematical-proof',
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

    // ── 1. Classify the proof type ───────────────────────────
    const proofType = classifyProofType(questionText);

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
    const systemPrompt = buildSystemPrompt(studentModel, proofType);
    const userMessage  = buildUserMessage(params, dotPointData, pastMistakes, proofType);

    // ── 5. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.3,   // low — formal proofs demand consistency and precision
      maxTokens:   1800,
      skillName:   'mathematical-proof',
      studentId,
    });

    // ── 6. Record attempt ────────────────────────────────────
    if (memory && dotPointCode) {
      try {
        memory.recordAttempt(
          studentId, dotPointCode, questionText,
          'viewed proof worked example', null, null,
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