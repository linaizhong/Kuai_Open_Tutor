// Skill: multi-representation
// Type: active
// Phase 2 — Explain concepts numerically, graphically and algebraically
//
// Responsibility:
//   Re-explain a concept or problem using all three HSC-relevant
//   representations, leading with the student's preferred style:
//
//     visual/graphical  — sketch description, key features, geometry
//     algebraic         — symbols, formal rules, manipulation steps
//     numerical         — worked example with specific numbers
//
//   Preferred style is inferred from the Student Model's learningStyle.
//   If the student explicitly requests a style in their message, that
//   overrides the Student Model preference.
//
//   Returns a visualization payload when the graphical representation
//   includes enough data for the frontend to render a graph.

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
// Preferred style resolver
// ─────────────────────────────────────────────────────────────

/**
 * Detects an explicit style request in the user's message.
 *
 * @param {string} input
 * @returns {'visual'|'algebraic'|'numerical'|null}
 */
function detectExplicitStyleRequest(input) {
  const lower = input.toLowerCase();
  if (/visually|graphically|draw|sketch|picture|diagram|geometr|see it/.test(lower)) return 'visual';
  if (/algebraically|algebraic|formula|symbolic|formally|equation/.test(lower))       return 'algebraic';
  if (/numerically|numerical|numbers?|example|specific|substitut|plug in/.test(lower)) return 'numerical';
  return null;
}

/**
 * Resolves the lead representation.
 * Priority:
 *   1. Explicit request in user's message
 *   2. Student Model learningStyle.preferredRepresentation
 *   3. Default to 'algebraic' (standard HSC approach)
 *
 * @param {string} userInput
 * @param {object} studentModel
 * @returns {'visual'|'algebraic'|'numerical'}
 */
function resolveLeadStyle(userInput, studentModel) {
  const explicit = detectExplicitStyleRequest(userInput);
  if (explicit) return explicit;

  const preferred = studentModel?.learningStyle?.preferredRepresentation;
  if (preferred && ['visual', 'algebraic', 'numerical'].includes(preferred)) {
    return preferred;
  }

  return 'algebraic';
}

/**
 * Given the lead style, returns the order in which to present all three.
 *
 * @param {'visual'|'algebraic'|'numerical'} lead
 * @returns {string[]}
 */
function representationOrder(lead) {
  const all = ['algebraic', 'numerical', 'visual'];
  return [lead, ...all.filter(s => s !== lead)];
}

// ─────────────────────────────────────────────────────────────
// Visualization builder
// ─────────────────────────────────────────────────────────────

/**
 * Constructs a lightweight graph specification if the dot-point has
 * a graphable function associated with it. The frontend renderer reads
 * this to draw a Plotly/Recharts chart.
 *
 * Returns null when no graph data is available — the LLM will describe
 * the graph verbally instead.
 *
 * @param {object|null} dotPointData
 * @returns {object|null}
 */
function buildVisualization(dotPointData) {
  if (!dotPointData?.graphSpec) return null;

  // KB graphSpec format: { type, expression, xRange, annotations }
  const { type, expression, xRange, yRange, annotations, label } = dotPointData.graphSpec;

  return {
    type:        type       || 'function',
    expression:  expression || null,
    xRange:      xRange     || [-5, 5],
    yRange:      yRange     || null,
    annotations: annotations || [],
    label:       label      || dotPointData.name,
  };
}

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

/**
 * @param {string[]} order         — representation order, lead first
 * @param {object}   studentModel
 * @param {string}   leadStyle
 * @returns {string}
 */
function buildSystemPrompt(order, studentModel, leadStyle) {
  const engagement = studentModel?.affectiveState?.currentEngagement || 'focused';

  // Build the section order description
  const sectionLabels = {
    visual:    '📊 Graphical / Visual',
    algebraic: '✏️  Algebraic',
    numerical: '🔢 Numerical',
  };
  const orderedSections = order.map(s => sectionLabels[s]).join(' → ');

  let toneInstruction = 'Be clear and educational. Show genuine enthusiasm for the different ways maths can be seen.';
  if (engagement === 'frustrated') {
    toneInstruction =
      'The student is frustrated with the standard explanation. ' +
      'Open warmly: "Let\'s look at this a completely different way." ' +
      'Then deliver — keep each representation brief and clear.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'Keep each section short. Quality over quantity — one clear insight per representation.';
  }

  let leadNote = '';
  if (leadStyle === 'visual') {
    leadNote = '\nThe student is a visual learner. The graphical section is FIRST and should be the most detailed.';
  } else if (leadStyle === 'numerical') {
    leadNote = '\nThe student learns best from numbers and examples. The numerical section is FIRST with a fully worked concrete example.';
  } else {
    leadNote = '\nStart with the algebraic view (standard HSC approach), then add the other perspectives.';
  }

  return `You are OpenTutor — an expert HSC Mathematics Advanced tutor for Australian Year 11/12 students.

Your task is to explain a concept using MULTIPLE REPRESENTATIONS so the student can see it from every angle.

REPRESENTATION ORDER: ${orderedSections}${leadNote}

STRICT FORMAT — use exactly these section headings (in the order above):
${order.map(s => `**${sectionLabels[s]}:**`).join('\n')}

RULES FOR EACH SECTION:
- Graphical/Visual: Describe what a sketch would look like, key features (intercepts, turning points, asymptotes, shape). If a graph is being rendered, mention key coordinates.
- Algebraic: State the rule, formula, or manipulation steps using plain text maths (x^2, dy/dx, sqrt(x)). No LaTeX backslash commands.
- Numerical: Work through ONE specific example with real numbers from start to finish.

Keep each section to 3–5 lines. Total response should be comprehensive but scannable.

TONE: ${toneInstruction}`;
}

function buildUserMessage(params, dotPointData, order, visualization) {
  const { userInput, concept } = params;

  let msg = '';

  // What concept needs multi-representation treatment?
  if (concept) {
    msg += `Concept to explain: "${concept}"\n`;
  } else if (dotPointData) {
    msg += `Concept: ${dotPointData.code} — ${dotPointData.name}\n`;
  } else {
    msg += `Student's message: "${userInput}"\n`;
    msg += `Identify the concept being asked about and provide all three representations.\n`;
  }

  // Dot-point knowledge to ground the explanation
  if (dotPointData) {
    msg += `Syllabus dot-point: ${dotPointData.code}\n`;
    if (dotPointData.keyConcepts?.length > 0) {
      msg += `Key concepts to cover:\n`;
      for (const c of dotPointData.keyConcepts.slice(0, 4)) {
        msg += `  - ${c}\n`;
      }
    }
    if (dotPointData.graphSpec) {
      msg += `A graph will be rendered for the visual section — describe the key features in text too.\n`;
    }
  }

  // Representation order for this student
  msg += `\nRepresentation order (lead first): ${order.join(' → ')}\n`;
  msg += `\nPlease deliver all three representations in the required format.`;
  return msg;
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name:    'multi-representation',
    version: '1.0.0',
    type:    'active',
  },

  /**
   * @param {object} params
   *   - userInput  {string}       — raw student message
   *   - concept    {string|null}  — explicit concept description
   *   - dotPoint   {string|null}  — NESA dot-point override
   *
   * @param {object} context
   *   - studentId, memory, studentModel, model, knowledgeBase
   *
   * @returns {Promise<{
   *   result:        string,
   *   visualization: object|null,  — graph spec for frontend renderer, or null
   *   syllabusPoint: string|null,
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, studentModel, model, knowledgeBase } = context;
    const { userInput = '', concept = null } = params;

    // ── 1. Identify dot-point ────────────────────────────────
    const searchText   = concept || userInput || '';
    const dotPointCode = params.dotPoint || inferDotPoint(searchText, knowledgeBase);
    const dotPointData = getDotPointData(dotPointCode, knowledgeBase);

    // ── 2. Resolve representation order ─────────────────────
    const leadStyle = resolveLeadStyle(userInput, studentModel);
    const order     = representationOrder(leadStyle);

    // ── 3. Build visualization payload (if available) ────────
    const visualization = buildVisualization(dotPointData);

    // ── 4. Build prompts ─────────────────────────────────────
    const systemPrompt = buildSystemPrompt(order, studentModel, leadStyle);
    const userMessage  = buildUserMessage(params, dotPointData, order, visualization);

    // ── 5. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.6,
      maxTokens:   800,   // three representations need more space
      skillName:   'multi-representation',
      studentId,
    });

    // ── 6. Return ────────────────────────────────────────────
    return {
      result:        response,
      visualization,           // null if no graph spec in KB
      syllabusPoint: dotPointCode,
    };
  },
};