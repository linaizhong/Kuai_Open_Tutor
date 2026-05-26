// Skill: thesis-refinement
// Type: active
// Phase 1 — HSC English thesis construction and refinement
//
// Responsibility:
//   Isolates the single highest-leverage skill in HSC English: writing a
//   sophisticated, contestable thesis. A strong thesis determines the quality
//   of the entire essay. This skill handles:
//     - ASSESS: diagnose why a student's thesis is weak and classify the failure
//     - BUILD: construct a thesis from scratch given a question and text
//     - ELEVATE: take an adequate thesis and push it to Band 6 sophistication
//     - TEACH: explain what makes a strong HSC thesis and why
//
//   The skill enforces four thesis quality criteria:
//     1. Contestability — it makes a debatable claim, not a fact
//     2. Specificity — it names technique, text, and effect, not just theme
//     3. Module awareness — it uses the module's conceptual lens
//     4. Argument direction — it signals the essay's line of reasoning

'use strict';

// ─────────────────────────────────────────────────────────────
// Thesis task classifier
// ─────────────────────────────────────────────────────────────

/**
 * Detects the thesis task.
 * Returns: 'assess' | 'build' | 'elevate' | 'teach'
 */
function classifyThesisTask(input) {
  const t = input.toLowerCase();
  if (/my thesis|here is my thesis|is my thesis|check my thesis|feedback on my thesis|what's wrong with my thesis/i.test(t)) {
    return 'assess';
  }
  if (/make.*better|improve.*thesis|elevate|more sophisticated|band 6 thesis|upgrade/i.test(t)) {
    return 'elevate';
  }
  if (/what is a thesis|how does a thesis|explain thesis|what makes.*good thesis|teach me/i.test(t)) {
    return 'teach';
  }
  return 'build'; // default: student needs a thesis built from their question
}

/**
 * Detects the HSC module from input.
 * Returns: 'common' | 'modA' | 'modB' | 'modC' | 'general'
 */
function classifyModule(input) {
  const t = input.toLowerCase();
  if (/module a|mod a|comparative|pair of texts|textual conversation/i.test(t)) return 'modA';
  if (/module b|mod b|critical study|close study/i.test(t))                     return 'modB';
  if (/module c|mod c|craft of writing/i.test(t))                               return 'modC';
  if (/common module|human experiences|discovery/i.test(t))                     return 'common';
  return 'general';
}

/**
 * Classifies the weakness type in a student-submitted thesis.
 * Returns: 'descriptive' | 'vague' | 'no-technique' | 'no-module-lens' | 'two-theses' | 'adequate'
 */
function classifyThesisWeakness(thesis) {
  if (!thesis) return 'vague';
  const t = thesis.toLowerCase();
  // Descriptive: "explores", "is about", "deals with"
  if (/explores the theme|is about|deals with|tells the story|focuses on/i.test(t)) return 'descriptive';
  // Vague: no text title, no specific claim
  if (t.split(' ').length < 12) return 'vague';
  // No technique named
  if (!/through|via|by|using|employs|constructs|depicts|positions/i.test(t)) return 'no-technique';
  // Adequate if it passes the above checks
  return 'adequate';
}

// ─────────────────────────────────────────────────────────────
// Thesis quality criteria (used in feedback)
// ─────────────────────────────────────────────────────────────

const THESIS_CRITERIA = [
  {
    id: 'contestable',
    label: 'Contestability',
    question: 'Could a reasonable person disagree with this thesis?',
    failSignal: 'States an obvious or factual claim that no one would dispute.',
    fix: 'Add a specific claim about HOW or WHY, not just WHAT.',
  },
  {
    id: 'specific',
    label: 'Specificity',
    question: 'Does it name a technique, effect, or specific textual feature?',
    failSignal: 'Uses only abstract theme words without naming how the text achieves its effect.',
    fix: 'Name the technique or structural strategy the text uses and the effect it creates.',
  },
  {
    id: 'module-lens',
    label: 'Module Awareness',
    question: 'Does it engage with the module\'s conceptual focus?',
    failSignal: 'Ignores the module\'s framing question and treats the essay as a generic text response.',
    fix: 'Integrate the module\'s key concept (e.g. "human experience", "textual conversation", "craft") into the thesis.',
  },
  {
    id: 'direction',
    label: 'Argument Direction',
    question: 'Does the reader know what the essay will argue?',
    failSignal: 'States a topic but not a line of reasoning — the thesis is a description, not an argument.',
    fix: 'Signal the essay\'s direction: "this reveals...", "demonstrating that...", "positioning the reader to understand...".',
  },
];

// ─────────────────────────────────────────────────────────────
// Module-specific thesis conventions
// ─────────────────────────────────────────────────────────────

const MODULE_CONVENTIONS = {
  common: {
    lens: 'human experiences',
    requirement: 'The thesis must claim something about HOW the text represents human experience, not just WHAT experience it depicts.',
    formula: '[Author] constructs [specific human experience] through [technique], positioning the reader to understand [insight about human experience].',
    weak: 'The text explores the human experience of loss.',
    strong: 'Through the recurring motif of silence, [Author] constructs grief as an isolating, unspeakable rupture in the self, inviting readers to recognise how human loss resists the consolation of language.',
  },
  modA: {
    lens: 'textual conversation',
    requirement: 'The thesis must argue a RELATIONSHIP between the two texts — what does reading them together reveal?',
    formula: 'Where [Text 1] constructs [idea] as [X], [Text 2] reframes it as [Y], together revealing [insight that neither text produces alone].',
    weak: 'Both texts explore the theme of identity.',
    strong: 'Where [Text 1] presents identity as a stable inheritance of the past, [Text 2] deconstructs this certainty, reframing self-knowledge as perpetually provisional — together, the texts reveal how modernity has replaced the comfort of origin with the anxiety of choice.',
  },
  modB: {
    lens: 'critical position',
    requirement: 'The thesis must take a critical POSITION on the text — not describe what it is about, but argue what it MEANS and why it matters.',
    formula: '[Author]\'s [text] [critical claim about the text\'s value/meaning/effect], [contextual grounding], revealing [broader cultural/historical insight].',
    weak: 'The text is a significant work that deals with power and control.',
    strong: '[Author]\'s [text] dismantles the liberal-humanist myth of individual agency through its systematic exposure of institutional power, situating the personal within a web of ideological constraint that remains urgently legible in our own moment.',
  },
  modC: {
    lens: 'craft of writing',
    requirement: 'The thesis must make a claim about a WRITERLY CHOICE and its effect — the module is about craft decisions, not just themes.',
    formula: 'Through the deliberate choice of [technique/form/structure], [Author] achieves [effect], demonstrating that [insight about what the craft choice makes possible].',
    weak: 'The text uses many techniques to convey its ideas effectively.',
    strong: 'By fragmenting chronology into non-linear vignettes, [Author] replicates the discontinuous logic of traumatic memory, demonstrating that form itself can enact the psychological reality the text seeks to represent.',
  },
  general: {
    lens: 'analytical argument',
    requirement: 'The thesis must be contestable, specific, and signal the essay\'s line of reasoning.',
    formula: 'Through [technique], [Author] [claim about construction/effect], [revealing/demonstrating/positioning the reader to] [broader insight].',
    weak: 'The text explores important ideas about society.',
    strong: 'Through the systematic inversion of power hierarchies, [Author] exposes the arbitrariness of social hierarchy, positioning the reader to question the moral legitimacy of institutions that claim natural authority.',
  },
};

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(studentModel, thesisTask, module, weaknessType) {
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';
  const engagement = studentModel?.affectiveState?.currentEngagement      || 'focused';

  let toneInstruction = 'Be direct and specific. A good thesis critique names the problem precisely and fixes it immediately.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is frustrated. Lead with one clear model thesis before any diagnosis. Show them what\'s possible, then explain how to get there.';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Acknowledge what is working, then push hard for Band 6 sophistication. Challenge them on every vague word.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student is tired. Give them one strong model thesis they can adapt. Keep explanation to 3 bullet points maximum.';
  }

  let formatInstruction = 'Show WEAK thesis → diagnosis → STRONG thesis as a clear three-part structure, with the strong version annotated.';
  if (style === 'visual') {
    formatInstruction = 'Use a visual annotation: write the strong thesis, then bracket and label each component: [TEXT+TECHNIQUE] [EFFECT] [MODULE LENS] [ARGUMENT DIRECTION].';
  } else if (style === 'numerical') {
    formatInstruction = 'Use a 4-point checklist: score the thesis on each of the four criteria (Contestable / Specific / Module-aware / Direction), then rewrite it to fix the failures.';
  }

  const conv = MODULE_CONVENTIONS[module] || MODULE_CONVENTIONS['general'];

  const taskGuide = {
    assess: `
YOUR TASK — THESIS ASSESSMENT:
Diagnose the student's thesis against the four HSC thesis quality criteria:
${THESIS_CRITERIA.map(c => `  • ${c.label}: ${c.question}`).join('\n')}

For each criterion:
  1. State: PASS or FAIL
  2. If FAIL: quote the exact word or phrase that is the problem
  3. Give a one-sentence fix

Then rewrite the entire thesis incorporating all fixes.
Then annotate the rewritten thesis showing: [TECHNIQUE] [EFFECT] [${conv.lens.toUpperCase()}] [DIRECTION].

${weaknessType === 'descriptive' ? '⚠️ PRIMARY PROBLEM DETECTED: Descriptive thesis — "explores the theme of X" earns Band 2-3. The thesis must argue HOW and WHY, not just WHAT.' : ''}
${weaknessType === 'vague' ? '⚠️ PRIMARY PROBLEM DETECTED: Thesis is too short/vague — likely lacks technique, effect, or specific claim.' : ''}
${weaknessType === 'no-technique' ? '⚠️ PRIMARY PROBLEM DETECTED: No technique named. A thesis without a "how" cannot direct an analytical essay.' : ''}`,

    build: `
YOUR TASK — BUILD A THESIS:
Given the essay question and text, construct a Band 6 HSC thesis.

Module lens for this response: ${conv.lens}
Module requirement: ${conv.requirement}

Formula to follow:
${conv.formula}

Process:
1. Identify the key claim the question is asking for.
2. Name the primary technique or structural strategy the text uses.
3. State the effect of that technique on the reader.
4. Frame it through the module lens.
5. Signal the essay's direction.

Show:
  • Band 3 version (what most students write)
  • Band 5 version (clear and specific but not yet sophisticated)
  • Band 6 version (contestable, technique-specific, module-aware, directional)

Annotate the Band 6 version.`,

    elevate: `
YOUR TASK — ELEVATE AN ADEQUATE THESIS:
The student has a thesis that is technically correct but not yet Band 6.
Band 6 theses differ from Band 4-5 theses in:
  1. Greater specificity of technique (not "imagery" but "the layered pastoral imagery of the opening stanza")
  2. More precise effect language (not "shows" but "reframes", "subverts", "dismantles", "positions")
  3. A deeper insight in the direction clause — connecting to something beyond the obvious
  4. Module lens woven in, not bolted on

Elevation process:
1. Identify which of the four Band 6 differentiators is weakest.
2. Show the targeted revision of just that component.
3. Combine into the elevated thesis.
4. Annotate.`,

    teach: `
YOUR TASK — TEACH THESIS CONSTRUCTION:
Explain what makes a strong HSC English thesis using the four quality criteria:
${THESIS_CRITERIA.map((c, i) => `  ${i + 1}. ${c.label}: ${c.failSignal} Fix: ${c.fix}`).join('\n')}

Show:
  • A Band 2 thesis for a generic question
  • A Band 4 thesis for the same question
  • A Band 6 thesis for the same question
  • Annotation of the Band 6 version

Then show the formula:
${conv.formula}

Finally: give the student one practice question and ask them to write their own thesis attempt.`,
  };

  const taskInstruction = taskGuide[thesisTask] || taskGuide['build'];

  return `You are OpenTutor — an expert HSC English Advanced thesis coach for Australian Year 11/12 students.

${taskInstruction}

Module context: ${module}
${conv.requirement}

Weak thesis example (what to avoid):
"${conv.weak}"

Strong thesis example (what to aim for):
"${conv.strong}"

STRICT REQUIREMENTS:
- Always show a model thesis. Never describe what a good thesis looks like without showing one.
- Use precise language: "contestable", "technique-specific", "module-aware". Avoid vague praise.
- Every model thesis must include: a technique named precisely + an effect stated + the module lens + argument direction.
- Never use the words "explores", "deals with", "is about", "the theme of" in a model thesis.
- Do NOT write the essay — only the thesis and its annotation.

TONE: ${toneInstruction}
FORMAT: ${formatInstruction}

End with a "Thesis Test:" — one question the student can ask themselves to check if their thesis is Band 6-worthy.`;
}

function buildUserMessage(params, pastMistakes, thesisTask, module) {
  const { userInput, problem } = params;
  const questionText = problem || userInput;

  const modeLabel = {
    assess:  'Please assess my HSC English thesis',
    build:   'Please help me build a thesis for this HSC English question',
    elevate: 'Please help me elevate my thesis to Band 6',
    teach:   'Please teach me how to write a strong HSC English thesis',
  };

  let message = `${modeLabel[thesisTask] || modeLabel['build']}:\n\n${questionText}`;
  message += `\n\nDetected module: ${module}. Detected task: ${thesisTask}.`;

  if (pastMistakes && pastMistakes.length > 0) {
    const recent = pastMistakes.slice(-2);
    message += `\nThis student has previously made the following thesis mistakes:\n`;
    for (const m of recent) {
      message += `- ${m.errorType || 'thesis'} issue: ${m.notes || m.problem || 'unspecified'}\n`;
    }
    message += `Please directly address these recurring weaknesses.`;
  }

  return message;
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name: 'thesis-refinement',
    version: '1.0.0',
    type: 'active',
  },

  /**
   * @param {object} params
   *   - userInput    {string}      — raw student message or thesis text
   *   - problem      {string}      — extracted question or thesis
   *   - module       {string|null} — HSC module if already known
   *
   * @param {object} context
   *   - studentId    {string}
   *   - memory       {MemoryManager}
   *   - studentModel {object}
   *   - model        {ModelManager}
   *   - knowledgeBase {object|null}
   *
   * @returns {Promise<{
   *   result:       string,
   *   visualization: null,
   *   thesisTask:   string,
   *   module:       string,
   *   weaknessType: string|null,
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model } = context;
    const { userInput, problem, module: moduleOverride } = params;

    const questionText = problem || userInput || '';

    // ── 1. Classify task and module ──────────────────────────
    const thesisTask  = classifyThesisTask(questionText);
    const module      = moduleOverride || classifyModule(questionText);

    // ── 2. If assessing, classify the weakness type ──────────
    // Extract what looks like the thesis itself (heuristic: last long sentence)
    const sentences     = questionText.split(/[.!?]/).map(s => s.trim()).filter(Boolean);
    const likelyThesis  = sentences.find(s => s.length > 30) || questionText;
    const weaknessType  = thesisTask === 'assess' ? classifyThesisWeakness(likelyThesis) : null;

    // ── 3. Fetch past thesis mistakes ────────────────────────
    let pastMistakes = [];
    if (memory) {
      try {
        pastMistakes = memory.getMistakesForSkill(studentId, 'thesis-refinement');
      } catch { /* proceed without */ }
    }

    // ── 4. Build prompt ──────────────────────────────────────
    const systemPrompt = buildSystemPrompt(studentModel, thesisTask, module, weaknessType);
    const userMessage  = buildUserMessage(params, pastMistakes, thesisTask, module);

    // ── 5. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.45,
      maxTokens:   1400,
      skillName:   'thesis-refinement',
      studentId,
    });

    // ── 6. Record attempt ────────────────────────────────────
    if (memory) {
      try {
        memory.recordAttempt(
          studentId,
          `english.thesis.${module}`,
          questionText,
          `thesis task: ${thesisTask}`,
          null,
          null,
        );
      } catch { /* non-fatal */ }
    }

    // ── 7. Return ────────────────────────────────────────────
    return {
      result:        response,
      visualization: null,
      thesisTask,
      module,
      weaknessType,
    };
  },
};