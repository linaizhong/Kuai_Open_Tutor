// Skill: solve-equation
// Type: active
// Phase 1 — Solve algebraic equations step-by-step, including linear,
// quadratic, simultaneous and trigonometric equations.

'use strict';

// ── Equation type classifier ──────────────────────────────────
const EQUATION_TYPES = [
  { type: 'simultaneous',  dotPoint: 'MA-F1.3', pattern: /simultaneous|system of|solve.{0,20}(and|&).{0,20}(equation|=)|two equations/i },
  { type: 'trigonometric', dotPoint: 'MA-T2.2', pattern: /\b(sin|cos|tan|sec|cosec|cot)\s*[(\^x]|trig(onometric)?/i },
  { type: 'exponential',   dotPoint: 'MA-E1.2', pattern: /\be\s*\^|e\^|(\d+)\s*\^\s*x|\bln\s*\(|\blog\s*\(/i },
  { type: 'cubic',         dotPoint: 'MA-F1.3', pattern: /x\s*\^?\s*3|x³|\^3|cubic/i },
  { type: 'quadratic',     dotPoint: 'MA-F1.3', pattern: /x\s*\^?\s*2|x²|\^2|quadratic/i },
  { type: 'linear',        dotPoint: 'MA-F1.3', pattern: /solve|find\s+x|linear|equation/i },
];

function classifyEquation(text) {
  for (const entry of EQUATION_TYPES) {
    if (entry.pattern.test(text)) return { type: entry.type, dotPoint: entry.dotPoint };
  }
  return { type: 'general', dotPoint: 'MA-F1.3' };
}

// ── Scaffolding depth from mastery score ──────────────────────
function scaffoldingLevel(masteryScore) {
  if (masteryScore === null || masteryScore === undefined || masteryScore < 0.5) return 'high';
  if (masteryScore < 0.75) return 'medium';
  return 'low';
}

// ── Build system prompt ───────────────────────────────────────
function buildSystemPrompt(equationType, dotPoint, studentModel) {
  const mastery    = studentModel?.masteryProfile?.[dotPoint] ?? null;
  const scaffolding = scaffoldingLevel(mastery);
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'algebraic';
  const nameTag    = studentModel?.name ? `The student's name is ${studentModel.name}.` : '';

  const scaffoldingGuide = {
    high:
      `- Break the solution into very small, clearly labelled steps (Step 1:, Step 2:, …).
- Before each step, briefly explain in plain English what you are about to do and why.
- After the solution, call out the single most common mistake students make on this question type.`,
    medium:
      `- Use clearly numbered steps with brief one-line justifications.
- Assume the student knows the basic rules but may need a reminder.
- After the solution, add one specific HSC exam tip for this question type.`,
    low:
      `- Present a clean, efficient worked solution with steps labelled.
- Standard notation may be used without explaining every rule.
- After the solution, offer one brief insight or an extension thought.`,
  };

  const styleNote =
    style === 'visual'
      ? 'Where helpful, describe the geometric interpretation (e.g. intersection of lines, roots on the number line).'
      : style === 'numerical'
      ? 'After the algebraic solution, verify the answer by substituting back in numerically and state it explicitly.'
      : '';

  const typeGuide = {
    simultaneous:  'Label the equations (1) and (2). Show each elimination or substitution step explicitly.',
    trigonometric: 'State the reference angle, apply ASTC, and list ALL solutions within the given domain. Use exact values.',
    exponential:   'Take ln of both sides where needed. Show each logarithm law applied.',
    quadratic:     'Try factorisation first. If it does not factorise neatly, use the quadratic formula. State both roots.',
    cubic:         'Use the factor theorem to find one root, then perform polynomial long division or synthetic division.',
    linear:        'Isolate the variable using inverse operations. Check by substitution.',
    general:       'Show all algebraic steps clearly.',
  };

  return `You are Tute, an expert HSC Mathematics Advanced tutor.
Your task is to solve a mathematical equation with full step-by-step working.
${nameTag}
EQUATION TYPE: ${equationType}
SCAFFOLDING LEVEL: ${scaffolding}
${styleNote}

TYPE-SPECIFIC RULES:
${typeGuide[equationType] || typeGuide.general}

SCAFFOLDING INSTRUCTIONS:
${scaffoldingGuide[scaffolding]}

GENERAL RULES:
- Always present a fully worked, complete solution.
- Use exact values (fractions, surds, π) unless a decimal is explicitly requested.
- State the final answer clearly on its own line, prefixed with "Answer:".
- Use proper mathematical notation (e.g. x = 3/2, not x = 1.5 unless needed).
- Do NOT use markdown headers or bullet lists inside the solution steps themselves.
- Do NOT skip steps, even if they seem obvious.`;
}

// ═════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════
module.exports = {
  meta: {
    name: 'solve-equation',
    version: '1.0.0',
    type: 'active',
  },

  execute: async function (params, context) {
    const { userInput = '', equation = '' } = params || {};
    const { studentModel, model }           = context || {};

    const query = (equation || userInput).trim();
    if (!query) {
      return {
        result: 'Please give me an equation to solve — for example: "Solve x² − 5x + 6 = 0".',
        visualization: null,
        syllabusPoint: null,
      };
    }

    const { type, dotPoint } = classifyEquation(query);
    const systemPrompt       = buildSystemPrompt(type, dotPoint, studentModel);

    const result = await model.chat(
      [{ role: 'user', content: `Please solve the following:\n\n${query}` }],
      { system: systemPrompt, temperature: 0.2, maxTokens: 700 }
    );

    return { result, visualization: null, syllabusPoint: dotPoint };
  },
};