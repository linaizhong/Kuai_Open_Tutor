// Skill: textual-evidence-builder
// Type: active
// Phase 1 — HSC English textual evidence selection, embedding and analysis
//
// Responsibility:
//   Teaches students to select, embed, and analyse textual evidence at the
//   HSC Band 5/6 standard. Covers three distinct sub-tasks:
//     - SELECT: identifying the strongest quote for a given argument
//     - EMBED: integrating a quote grammatically into a sentence
//     - ANALYSE: writing a full technique-effect-meaning analysis from a quote
//
//   The skill models HSC-standard analysis sentences and corrects the three
//   most common evidence weaknesses: over-quoting, under-analysis ("this shows"),
//   and evidence that doesn't match the argument.
//
//   Personalises depth and tone using the Student Model.

'use strict';

// ─────────────────────────────────────────────────────────────
// Evidence task classifier
// ─────────────────────────────────────────────────────────────

/**
 * Detects the specific evidence task the student needs.
 * Returns: 'select' | 'embed' | 'analyse' | 'full'
 *
 * 'full'    = student provides a quote and an argument, wants the whole package
 * 'select'  = student has an argument, wants help choosing a quote
 * 'embed'   = student has a quote but can't integrate it grammatically
 * 'analyse' = student has a quote but their analysis is weak
 */
function classifyEvidenceTask(input) {
  const t = input.toLowerCase();
  if (/which quote|best quote|what quote|good quote|find a quote|choose a quote|select a quote/i.test(t)) {
    return 'select';
  }
  if (/embed|integrate|use.*quote|put.*quote|insert.*quote|how do i use|how to use.*quote/i.test(t)) {
    return 'embed';
  }
  if (/analyse|analyze|analysis|this shows|what does.*mean|explain.*quote|technique|effect/i.test(t)) {
    return 'analyse';
  }
  return 'full';
}

/**
 * Detects the HSC English module from input text.
 * Returns: 'common' | 'modA' | 'modB' | 'modC' | 'general'
 */
function classifyModule(input) {
  const t = input.toLowerCase();
  if (/module a|mod a|comparative|pair of texts|intertextual/i.test(t))   return 'modA';
  if (/module b|mod b|critical study|close study/i.test(t))               return 'modB';
  if (/module c|mod c|craft of writing|creative writing/i.test(t))        return 'modC';
  if (/common module|human experiences|discovery/i.test(t))               return 'common';
  return 'general';
}

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(studentModel, evidenceTask, module) {
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';
  const engagement = studentModel?.affectiveState?.currentEngagement      || 'focused';

  let toneInstruction = 'Be precise and practical. Show concrete examples rather than general advice.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is frustrated. Start with brief encouragement. Use very short, clear steps. Show one small concrete example before anything else.';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Push for Band 6 sophistication — challenge them to embed more economically and analyse more perceptively.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student is tired. Give a single clear model sentence, label its components, and stop. No extra detail.';
  }

  let formatInstruction = 'Show annotated model sentences with each component labelled in brackets.';
  if (style === 'visual') {
    formatInstruction = 'Use a colour-coded annotation approach (using [TECHNIQUE], [QUOTE], [EFFECT], [MEANING] labels inline) to make the structure of each evidence sentence visible.';
  } else if (style === 'numerical') {
    formatInstruction = 'Use a numbered 3-step formula: (1) Name technique, (2) embed quote, (3) state effect + meaning. Show the formula, then apply it.';
  }

  // Task-specific instructions
  const taskGuide = {
    select: `
YOUR TASK — QUOTE SELECTION:
1. Identify what the student's argument is claiming.
2. Explain what makes a quote "strong" for this argument:
   - It must directly support the claim (not just be "about" the topic)
   - It should contain at least one identifiable technique
   - It should be concise — aim for under 10 words where possible
3. If the student has provided text, identify 2-3 strong quote options and rank them with brief justifications.
4. Explain why the best quote earns more marks than the others.
⚠️ WARNING: A quote that is "about" the topic but doesn't have analysable technique is a weak choice. Always prioritise quotes with embedded language craft.`,

    embed: `
YOUR TASK — QUOTE EMBEDDING:
1. Show the student the three grammatically correct ways to embed a quote:
   a) Lead-in clause:   According to [author], "[quote]" — use sparingly, formal
   b) Interrupted:      "[First part of quote], [your analysis word], [rest of quote]"
   c) Woven (best):     Sentence where the quote fits grammatically as a phrase, e.g. "[Author] depicts [character] as '[short quote]', constructing..."
2. Rewrite the student's attempt using the woven method.
3. Check that the surrounding sentence makes grammatical sense without the quote marks.
⚠️ WARNING: Never begin an analysis sentence with "This quote shows..." — it signals weak integration. The quote must earn its place inside a sentence that already makes an analytical claim.`,

    analyse: `
YOUR TASK — TECHNIQUE-EFFECT-MEANING ANALYSIS:
The three-tier analysis model HSC Band 6 students use:
  Tier 1 — TECHNIQUE: Name the technique precisely (e.g. not just "metaphor" but "extended metaphor of imprisonment")
  Tier 2 — EFFECT: State the immediate literary effect (e.g. "creates a sense of claustrophobia")
  Tier 3 — MEANING: Connect to the broader argument / human experience / module lens (e.g. "positioning the reader to understand how systemic oppression limits individual agency")

Diagnosis task:
1. Identify which tier is missing or weak in the student's analysis.
2. Show the weak sentence.
3. Rewrite it with all three tiers present.
4. Label each tier in the rewritten version.
⚠️ WARNING: "This shows that..." followed by a plot-level statement = Tier 0 (no marks for analysis). The most common Band 3-4 error.`,

    full: `
YOUR TASK — COMPLETE EVIDENCE PACKAGE:
Given a quote and an argument, produce a complete, Band 6-standard evidence sentence:
  Step 1 — Embed the quote using the woven method
  Step 2 — Name the technique precisely
  Step 3 — State the effect
  Step 4 — Connect to the argument / module lens

Then annotate the sentence showing:
  [EMBED] [TECHNIQUE] [EFFECT] [MEANING]

Then show a WEAK version of what a Band 3 student might write for the same quote, and explain exactly what makes the Band 6 version better.`,
  };

  const moduleNote = {
    modA: '\nMODULE A NOTE: Every evidence sentence must show awareness of the second text — either by explicit comparison or by framing the analysis in terms of the intertextual conversation.',
    modB: '\nMODULE B NOTE: Analysis must show a critical perspective — not just what the technique does, but what your reading or interpretation of it is.',
    modC: '\nMODULE C NOTE: Analysis must use the language of craft — "the writer deliberately chooses...", "this technique achieves...", to foreground writerly intention.',
    common: '\nCOMMON MODULE NOTE: The meaning tier must always connect to a human experience, not just to the text\'s plot or character.',
    general: '',
  };

  const taskInstruction = taskGuide[evidenceTask] || taskGuide['full'];
  const moduleInstruction = moduleNote[module] || '';

  return `You are OpenTutor — an expert HSC English Advanced tutor specialising in textual evidence technique for Australian Year 11/12 students.

${taskInstruction}
${moduleInstruction}

STRICT REQUIREMENTS:
- Always show a model sentence. Never just describe what to do without showing it.
- Always show the WEAK version alongside the STRONG version so the contrast is visible.
- Use annotation labels in [BRACKETS] to make structure visible.
- Never use "this shows", "this demonstrates", "this represents" — these are Band 3 sentence starters.
- Analysis must name techniques with precision. "Language" and "word choice" are not acceptable technique names.
- Keep embedded quotes short — under 12 words wherever possible.

TONE: ${toneInstruction}
FORMAT: ${formatInstruction}

End with a single "Evidence Checklist:" — a 3-item checklist the student can use to self-check any evidence sentence they write.`;
}

function buildUserMessage(params, pastMistakes, evidenceTask, module) {
  const { userInput, problem } = params;
  const questionText = problem || userInput;

  let message = `Please help me with textual evidence for my HSC English response:\n\n${questionText}`;

  message += `\n\nDetected task: ${evidenceTask}. Detected module: ${module}.`;

  if (pastMistakes && pastMistakes.length > 0) {
    const recent = pastMistakes.slice(-2);
    message += `\nThis student has previously made the following evidence mistakes:\n`;
    for (const m of recent) {
      message += `- ${m.errorType || 'evidence'} error: ${m.notes || m.problem || 'unspecified'}\n`;
    }
    message += `Please specifically address these recurring issues.`;
  }

  return message;
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name: 'textual-evidence-builder',
    version: '1.0.0',
    type: 'active',
  },

  /**
   * @param {object} params
   *   - userInput    {string}      — raw student message, may include a quote and/or argument
   *   - problem      {string}      — extracted problem text
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
   *   result:        string,
   *   visualization: null,
   *   evidenceTask:  string,   — 'select' | 'embed' | 'analyse' | 'full'
   *   module:        string,
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model } = context;
    const { userInput, problem, module: moduleOverride } = params;

    const questionText = problem || userInput || '';

    // ── 1. Classify task and module ──────────────────────────
    const evidenceTask = classifyEvidenceTask(questionText);
    const module       = moduleOverride || classifyModule(questionText);

    // ── 2. Fetch past evidence mistakes ──────────────────────
    let pastMistakes = [];
    if (memory) {
      try {
        pastMistakes = memory.getMistakesForSkill(studentId, 'textual-evidence-builder');
      } catch { /* proceed without */ }
    }

    // ── 3. Build prompt ──────────────────────────────────────
    const systemPrompt = buildSystemPrompt(studentModel, evidenceTask, module);
    const userMessage  = buildUserMessage(params, pastMistakes, evidenceTask, module);

    // ── 4. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.4,
      maxTokens:   1400,
      skillName:   'textual-evidence-builder',
      studentId,
    });

    // ── 5. Record attempt ────────────────────────────────────
    if (memory) {
      try {
        memory.recordAttempt(
          studentId,
          `english.evidence.${module}`,
          questionText,
          `evidence task: ${evidenceTask}`,
          null,
          null,
        );
      } catch { /* non-fatal */ }
    }

    // ── 6. Return ────────────────────────────────────────────
    return {
      result:        response,
      visualization: null,
      evidenceTask,
      module,
    };
  },
};