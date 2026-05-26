// Skill: plot-function
// Type: active
// Phase 1 — Sketch and analyse function graphs, identifying key features
// such as intercepts, asymptotes, turning points and transformations.
// Returns a text analysis AND structured visualization data for the
// frontend Chart.js renderer.

'use strict';

// ── Function type table ───────────────────────────────────────
const FUNCTION_TYPES = [
  { type: 'trig',        dotPoint: 'MA-T3.1', pattern: /\b(sin|cos|tan|cosec|sec|cot)\s*[(\^x]/i },
  { type: 'exponential', dotPoint: 'MA-E1.2', pattern: /\be\s*\^|e\^|(\d+)\s*\^\s*x|\bexp\s*\(/i },
  { type: 'logarithmic', dotPoint: 'MA-E1.2', pattern: /\bln\s*\(|\blog\s*\(|log_/i },
  { type: 'hyperbola',   dotPoint: 'MA-F1.4', pattern: /\b(1\s*\/\s*x|hyperbola)\b/i },
  { type: 'sqrt',        dotPoint: 'MA-F1.4', pattern: /\bsqrt\s*\(|√|square root/i },
  { type: 'absolute',    dotPoint: 'MA-F1.4', pattern: /\|.+\||\babs\s*\(|absolute value/i },
  { type: 'cubic',       dotPoint: 'MA-F1.3', pattern: /x\s*\^?\s*3|x³|\^3/i },
  { type: 'quadratic',   dotPoint: 'MA-F1.3', pattern: /x\s*\^?\s*2|x²|\^2|parabola/i },
  { type: 'linear',      dotPoint: 'MA-F1.3', pattern: /y\s*=\s*[+-]?\s*\d*\s*x|linear|straight line/i },
];

function classifyFunction(text) {
  for (const entry of FUNCTION_TYPES) {
    if (entry.pattern.test(text)) return { type: entry.type, dotPoint: entry.dotPoint };
  }
  return { type: 'general', dotPoint: 'MA-F1.3' };
}

// ── Extract the expression part from user input ───────────────
// e.g. "sketch y = x^2 + 3" → "x^2 + 3"
function extractExpression(input) {
  const patterns = [
    /(?:y|f\(x\))\s*=\s*(.+)/i,
    /(?:sketch|plot|graph|draw)\s+(?:of\s+)?(?:y\s*=\s*|f\(x\)\s*=\s*)?(.+)/i,
    /graph\s+of\s+(.+)/i,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1].trim().replace(/[,.]$/, '');
  }
  return input.trim();
}

// ── Safe numeric evaluator (no eval) ─────────────────────────
// Converts the expression to a safe JS form and evaluates it.
function safeEval(expr, x) {
  try {
    const s = expr
      .replace(/\^/g, '**')
      .replace(/\bsin\b/g,  'Math.sin')
      .replace(/\bcos\b/g,  'Math.cos')
      .replace(/\btan\b/g,  'Math.tan')
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\babs\b/g,  'Math.abs')
      .replace(/\bln\b/g,   'Math.log')
      .replace(/\bexp\b/g,  'Math.exp')
      .replace(/\be\b/g,    String(Math.E))
      .replace(/\bpi\b/gi,  String(Math.PI))
      .replace(/\bx\b/g,    `(${x})`);

    // Allowlist: only safe characters after substitution
    if (/[^0-9+\-*/.(),\sMath\s]/.test(s.replace(/Math\.\w+/g, ''))) return null;

    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${s})`)();
    return isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

// ── Generate plot data points ─────────────────────────────────
function generatePlotData(expr, funcType) {
  const isLog  = funcType === 'logarithmic';
  const isSqrt = funcType === 'sqrt';
  const isTrig = funcType === 'trig';
  const isHyp  = funcType === 'hyperbola';

  const xMin  = isLog || isSqrt ? 0.01 : isTrig ? -(2 * Math.PI) : -6;
  const xMax  = isTrig ? 2 * Math.PI : 6;
  const steps = 150;
  const step  = (xMax - xMin) / steps;

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * step;
    if (isHyp && Math.abs(x) < 0.15) continue; // skip near vertical asymptote
    const y = safeEval(expr, x);
    if (y !== null && Math.abs(y) <= 20) {
      points.push({ x: +x.toFixed(4), y: +y.toFixed(4) });
    }
  }
  return points;
}

// ── Build analysis system prompt ──────────────────────────────
function buildSystemPrompt(funcType, studentModel) {
  const mastery = studentModel?.masteryProfile?.['MA-F1.3'] ?? null;
  const depth   = (mastery === null || mastery < 0.5) ? 'detailed' : 'concise';
  const nameTag = studentModel?.name ? `The student's name is ${studentModel.name}.` : '';

  const typeSpecific = {
    trig:
      'State the amplitude, period, phase shift and vertical shift. Identify the key cycle points.',
    exponential:
      'Identify the horizontal asymptote. State whether the function is growth or decay. Give the y-intercept.',
    logarithmic:
      'Identify the vertical asymptote. State the x-intercept. Note the domain restriction carefully.',
    hyperbola:
      'Clearly state BOTH asymptotes (horizontal and vertical). Identify the two branches.',
    sqrt:
      'State the endpoint (starting point) and direction of the curve. Note the domain restriction.',
    absolute:
      'Find the vertex. State the two linear pieces that form the V-shape. Identify the domain.',
    cubic:
      'Find all x-intercepts by factorisation. Identify any stationary points using calculus if needed.',
    quadratic:
      'Complete the square to find the vertex. State axis of symmetry, x-intercepts and y-intercept.',
    linear:
      'State the gradient and y-intercept. Find the x-intercept.',
    general:
      'Identify all key features appropriate for this function type.',
  };

  return `You are Tute, an expert HSC Mathematics Advanced tutor.
Your task is to analyse and describe the graph of a given function for an HSC student.
${nameTag}
ANALYSIS DEPTH: ${depth}

STRUCTURE YOUR RESPONSE IN THIS EXACT ORDER — one labelled section per line:
1. Function type (one sentence)
2. Domain and Range (state clearly using correct notation)
3. x-intercept(s) — show the working
4. y-intercept — show the working
5. Asymptotes — state equation(s) and explain why they exist, or write "None"
6. Key features — ${typeSpecific[funcType] || typeSpecific.general}
7. Sketching strategy — what to mark first, second, and last for a clean sketch
8. HSC exam tip — one specific tip for this function type

RULES:
- Use exact values throughout (fractions, surds, π).
- Keep each section clearly labelled and concise.
- Do NOT use markdown headers. Use the numbered labels only.`;
}

// ═════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════
module.exports = {
  meta: {
    name: 'plot-function',
    version: '1.0.0',
    type: 'active',
  },

  execute: async function (params, context) {
    const { userInput = '', function: funcParam = '' } = params || {};
    const { studentModel, model }                      = context || {};

    const query = (funcParam || userInput).trim();
    if (!query) {
      return {
        result: 'Please tell me which function to sketch — for example: "Sketch y = x² − 4" or "Graph y = sin(2x)".',
        visualization: null,
        syllabusPoint: null,
      };
    }

    const { type, dotPoint } = classifyFunction(query);
    const expr               = extractExpression(query);
    const systemPrompt       = buildSystemPrompt(type, studentModel);

    // ── LLM analysis ──
    const result = await model.chat(
      [{ role: 'user', content: `Analyse and describe the graph of: ${query}` }],
      { system: systemPrompt, temperature: 0.2, maxTokens: 600 }
    );

    // ── Generate numeric plot data for Chart.js renderer ──
    const plotPoints  = generatePlotData(expr, type);
    const visualization = plotPoints.length > 5 ? {
      type:   'graph',
      data:   plotPoints,
      label:  `y = ${expr}`,
      xLabel: 'x',
      yLabel: 'y',
      xMin:   Math.min(...plotPoints.map(p => p.x)),
      xMax:   Math.max(...plotPoints.map(p => p.x)),
    } : null;

    return { result, visualization, syllabusPoint: dotPoint };
  },
};