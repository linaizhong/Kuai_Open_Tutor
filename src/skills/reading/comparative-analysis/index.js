// Skill: comparative-analysis
// Type: active
// Phase 1 — HSC English comparative analysis across paired texts
//
// Responsibility:
//   Guides students in constructing comparative analysis for HSC English Advanced.
//   Applies to two distinct contexts:
//     - Module A (Textual Conversations): formal paired text comparison
//     - Common Module / general: comparing unseen or studied texts on shared ideas
//
//   Core tasks:
//     - COMPARE: show how two texts treat the same idea differently or similarly
//     - CONTRAST: articulate a meaningful point of difference with analytical depth
//     - INTEGRATE: weave both texts into a single paragraph (not alternating)
//     - LINK: write a comparative thesis or topic sentence that argues a relationship
//
//   The skill specifically targets the most common comparative failure:
//   the "tennis match" structure (Text A paragraph / Text B paragraph)
//   and trains students toward integrated, argument-driven comparison.

'use strict';

// ─────────────────────────────────────────────────────────────
// Comparative task classifier
// ─────────────────────────────────────────────────────────────

/**
 * Detects the specific comparative task.
 * Returns: 'compare' | 'contrast' | 'integrate' | 'link' | 'thesis' | 'full'
 */
function classifyComparativeTask(input) {
  const t = input.toLowerCase();
  if (/my paragraph|check my|feedback on|my essay|my draft|fix my|improve my/i.test(t)) {
    return 'integrate'; // student has written something — likely needs integration help
  }
  if (/thesis|topic sentence|argument.*both|how do i argue|comparative thesis/i.test(t)) {
    return 'thesis';
  }
  if (/how do i connect|link.*texts|connect.*texts|how to compare|how to link/i.test(t)) {
    return 'link';
  }
  if (/contrast|difference|differ|unlike|whereas|on the other hand/i.test(t)) {
    return 'contrast';
  }
  if (/similar|both texts|same|echo|reflect|parallel/i.test(t)) {
    return 'compare';
  }
  return 'full'; // default: model a complete comparative paragraph
}

/**
 * Detects the comparison context — Module A or general.
 */
function classifyContext(input) {
  const t = input.toLowerCase();
  if (/module a|mod a|textual conversation|intertextual/i.test(t))         return 'modA';
  if (/common module|human experience|paper 1|section 1/i.test(t))         return 'common';
  return 'general';
}

/**
 * Extracts text titles or authors from input if mentioned.
 * Returns an array of up to 2 detected names (simple heuristic).
 */
function extractTexts(input) {
  // Look for quoted titles or "Text 1 / Text 2" markers
  const quoted = input.match(/"([^"]+)"/g) || [];
  if (quoted.length >= 2) return quoted.slice(0, 2).map(s => s.replace(/"/g, ''));

  // Look for "and" between two capitalised proper noun phrases (title case)
  const titleCase = input.match(/\b[A-Z][a-zA-Z\s']{2,30}\b/g) || [];
  if (titleCase.length >= 2) return titleCase.slice(0, 2);

  return ['Text 1', 'Text 2']; // fallback labels
}

// ─────────────────────────────────────────────────────────────
// Comparative language bank
// ─────────────────────────────────────────────────────────────

const COMPARATIVE_LANGUAGE = {
  similarity:  ['similarly', 'likewise', 'both texts', 'echoes', 'parallels', 'reflects', 'mirrors', 'reinforces', 'aligns with', 'resonates with'],
  difference:  ['whereas', 'in contrast', 'however', 'while', 'unlike', 'conversely', 'subverts', 'diverges from', 'complicates', 'challenges'],
  relationship: ['in conversation with', 'responds to', 'extends the exploration of', 'deepens our understanding of', 'recontextualises', 'illuminates'],
};

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(studentModel, comparativeTask, context, texts) {
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';
  const engagement = studentModel?.affectiveState?.currentEngagement      || 'focused';

  const [text1, text2] = texts;

  let toneInstruction = 'Be precise. Every piece of advice must be illustrated with a concrete model sentence using the student\'s actual texts.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is frustrated. Start with a single clear model sentence that shows what integrated comparison looks like. Then explain it simply.';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Challenge them — push beyond "similar/different" to a nuanced argument about WHAT the comparison reveals.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student is tired. Give one model comparative sentence and annotate it. That is enough.';
  }

  let formatInstruction = 'Show annotated model sentences with [TEXT 1], [TEXT 2], [LINK WORD], [SHARED IDEA] labels.';
  if (style === 'visual') {
    formatInstruction = 'Use a visual layout: show the "tennis match" (wrong) paragraph structure vs the integrated (correct) structure side by side. Then annotate the integrated version.';
  } else if (style === 'numerical') {
    formatInstruction = 'Use a numbered formula: (1) Shared idea / point of comparison → (2) Text 1 evidence + analysis → (3) Link word → (4) Text 2 evidence + analysis → (5) What the comparison reveals. Show the formula then apply it.';
  }

  const contextGuide = {
    modA: `
CONTEXT: Module A — Textual Conversations
The core task is to argue HOW and WHY the two texts are "in conversation" — not just that they share a theme.
Key requirements:
- Every paragraph must reference BOTH texts. Never write a single-text paragraph.
- The comparison must argue a RELATIONSHIP: how does reading them together reveal something neither reveals alone?
- Use the language of intertextuality: "responds to", "recontextualises", "challenges the assumptions of", "extends the exploration of".
- The thesis must argue about the PAIR, not describe each text separately.
- Avoid: "Text A explores X. Text B also explores X." This is description, not argument.`,

    common: `
CONTEXT: Common Module — Texts and Human Experiences
Comparison may be between studied and unseen texts, or between aspects of the same text.
Key requirements:
- Comparison must connect to a shared or contrasting human experience.
- Ask: what does comparing these representations of [human experience] reveal?
- Use the comparison to deepen the argument about human experience — not just to show you've read both texts.`,

    general: `
CONTEXT: General comparative response
- Identify a clear POINT OF COMPARISON before writing any sentence.
- Every comparative paragraph should make one claim about what the comparison reveals.
- The comparison must be analytical — not a description of what each text is about.`,
  };

  // Task-specific instructions
  const taskGuide = {
    thesis: `
YOUR TASK — COMPARATIVE THESIS:
A comparative thesis must:
  1. Name both texts (title and composer).
  2. State a RELATIONSHIP between them (not just "both explore X").
  3. Argue what comparing them REVEALS — the insight that reading them together produces.

WEAK thesis: "Both [Text 1] and [Text 2] explore the theme of loss."
STRONG thesis: "Where [Text 1] constructs loss as a private, inward dissolution of identity, [Text 2] reframes it as a communal and politically charged act of mourning — together, they reveal the tension between individual grief and collective response."

Show:
  1. The weak version.
  2. The strong version built from the student's texts.
  3. A brief annotation explaining each component.`,

    compare: `
YOUR TASK — SIMILARITY ANALYSIS:
Modelling a comparison of similarity:
  Step 1 — State the shared idea as a claim (not "both texts have X" but "both texts construct X as...")
  Step 2 — Evidence from Text 1 with technique + effect
  Step 3 — Link word from the similarity bank: ${COMPARATIVE_LANGUAGE.similarity.slice(0, 5).join(', ')}
  Step 4 — Evidence from Text 2 with technique + effect
  Step 5 — Synthesising sentence: what does this shared approach REVEAL?

Show a full model paragraph (6-8 sentences), then annotate the key moves.`,

    contrast: `
YOUR TASK — CONTRAST ANALYSIS:
Modelling a contrast (point of difference):
  Step 1 — State the point of difference as a claim: "Whereas [Text 1] constructs X as..., [Text 2] presents it as..."
  Step 2 — Evidence from Text 1 with technique + effect
  Step 3 — Contrast link word: ${COMPARATIVE_LANGUAGE.difference.slice(0, 5).join(', ')}
  Step 4 — Evidence from Text 2 with technique + effect
  Step 5 — Synthesising sentence: what does this DIFFERENCE reveal that neither text reveals alone?

⚠️ KEY INSIGHT: A contrast is more analytically rich than a similarity — it reveals TENSION, and tension is where the best Module A arguments live.`,

    integrate: `
YOUR TASK — PARAGRAPH INTEGRATION:
The student has likely written a "tennis match" paragraph. Your tasks:
  1. Identify whether the paragraph is alternating (Text A / Text B / Text A) or genuinely integrated.
  2. If alternating: diagnose why it loses marks (the comparison is never made — it's just description).
  3. Rewrite the paragraph in integrated form:
     - The paragraph's topic sentence argues a RELATIONSHIP between the two texts.
     - The evidence from each text is woven around a single analytical claim.
     - The link between texts is explicit, not implied.
  4. Show the BEFORE (student's version) and AFTER (rewritten version) side by side.

Comparative language to integrate: ${[...COMPARATIVE_LANGUAGE.similarity.slice(0,3), ...COMPARATIVE_LANGUAGE.difference.slice(0,3), ...COMPARATIVE_LANGUAGE.relationship.slice(0,3)].join(', ')}`,

    link: `
YOUR TASK — COMPARATIVE LINKING:
Teaching students how to write comparative topic sentences and paragraph links:
  1. Show the formula for a comparative topic sentence:
     "[Text 1] [relationship word] [Text 2]'s construction of [shared idea], [what the difference/similarity reveals]."
  2. Show 3 model topic sentences at increasing sophistication.
  3. Explain how the link sentence at the end of the paragraph should pivot to the next point of comparison.`,

    full: `
YOUR TASK — COMPLETE COMPARATIVE PARAGRAPH MODEL:
Produce one complete, Band 6-standard comparative paragraph covering both texts:
  1. Topic sentence (comparative claim — not summary)
  2. Text 1: technique + embedded quote + three-tier analysis
  3. Comparative link word + Text 2: technique + embedded quote + three-tier analysis
  4. Synthesis sentence: what reading them TOGETHER reveals
  5. Link sentence (connects to the next point in the argument)

Then annotate every sentence with its function label.
Then show a Band 3 version of the same paragraph to highlight the contrast.`,
  };

  const taskInstruction = taskGuide[comparativeTask] || taskGuide['full'];
  const contextInstruction = contextGuide[context] || contextGuide['general'];

  return `You are OpenTutor — an expert HSC English Advanced tutor specialising in comparative analysis for Australian Year 11/12 students.

Texts detected: "${text1}" and "${text2}".

${contextInstruction}

${taskInstruction}

STRICT REQUIREMENTS:
- Never write separate paragraphs for each text. Every model you produce must integrate both texts.
- Never use "tennis match" structure. Call it out explicitly when you see it in student work.
- Every comparative claim must be arguable — not a description of what each text is about.
- Always show the WEAK version alongside the STRONG version.
- Use [LABELS] to annotate model sentences so students can see the structure.
- Comparative language must be varied — do not rely on only "similarly" and "however".

TONE: ${toneInstruction}
FORMAT: ${formatInstruction}

End with a "Comparison Pitfall:" — the single most common error that stops a comparative response from reaching Band 5/6.`;
}

function buildUserMessage(params, pastMistakes, comparativeTask, context, texts) {
  const { userInput, problem } = params;
  const questionText = problem || userInput;
  const [text1, text2] = texts;

  let message = `Please help me with comparative analysis for my HSC English response.\n\nTexts: "${text1}" and "${text2}"\n\n${questionText}`;
  message += `\n\nDetected task: ${comparativeTask}. Detected context: ${context}.`;

  if (pastMistakes && pastMistakes.length > 0) {
    const recent = pastMistakes.slice(-2);
    message += `\nThis student has previously made the following comparative analysis mistakes:\n`;
    for (const m of recent) {
      message += `- ${m.errorType || 'comparative'} error: ${m.notes || m.problem || 'unspecified'}\n`;
    }
    message += `Please specifically address these recurring weaknesses.`;
  }

  return message;
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name: 'comparative-analysis',
    version: '1.0.0',
    type: 'active',
  },

  /**
   * @param {object} params
   *   - userInput    {string}      — raw student message or draft paragraph
   *   - problem      {string}      — extracted question or draft
   *   - context      {string|null} — 'modA' | 'common' | 'general' if already known
   *   - texts        {string[]|null} — [title1, title2] if already known
   *
   * @param {object} context (execution context — different from the 'context' param above)
   *   - studentId    {string}
   *   - memory       {MemoryManager}
   *   - studentModel {object}
   *   - model        {ModelManager}
   *   - knowledgeBase {object|null}
   *
   * @returns {Promise<{
   *   result:            string,
   *   visualization:     null,
   *   comparativeTask:   string,
   *   comparisonContext: string,
   *   texts:             string[],
   * }>}
   */
  execute: async function (params, execContext) {
    const { studentId, memory, studentModel, model } = execContext;
    const { userInput, problem, context: contextOverride, texts: textsOverride } = params;

    const questionText = problem || userInput || '';

    // ── 1. Classify task and context ─────────────────────────
    const comparativeTask     = classifyComparativeTask(questionText);
    const comparisonContext   = contextOverride || classifyContext(questionText);
    const texts               = textsOverride   || extractTexts(questionText);

    // ── 2. Fetch past comparative mistakes ───────────────────
    let pastMistakes = [];
    if (memory) {
      try {
        pastMistakes = memory.getMistakesForSkill(studentId, 'comparative-analysis');
      } catch { /* proceed without */ }
    }

    // ── 3. Build prompt ──────────────────────────────────────
    const systemPrompt = buildSystemPrompt(studentModel, comparativeTask, comparisonContext, texts);
    const userMessage  = buildUserMessage(params, pastMistakes, comparativeTask, comparisonContext, texts);

    // ── 4. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.5,
      maxTokens:   1600,
      skillName:   'comparative-analysis',
      studentId,
    });

    // ── 5. Record attempt ────────────────────────────────────
    if (memory) {
      try {
        memory.recordAttempt(
          studentId,
          `english.comparative.${comparisonContext}`,
          questionText,
          `comparative task: ${comparativeTask}`,
          null,
          null,
        );
      } catch { /* non-fatal */ }
    }

    // ── 6. Return ────────────────────────────────────────────
    return {
      result:            response,
      visualization:     null,
      comparativeTask,
      comparisonContext,
      texts,
    };
  },
};