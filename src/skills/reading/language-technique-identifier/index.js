// Skill: language-technique-identifier
// Type: active
// Phase 1 — HSC English language technique identification and effect analysis
//
// Responsibility:
//   Helps students correctly identify, name, and analyse language techniques
//   in HSC English Advanced texts. Covers:
//     - Identifying techniques in a passage (what is it?)
//     - Naming techniques with HSC-accepted precision (not just "language")
//     - Explaining the EFFECT of a technique on the reader
//     - Connecting the effect to meaning / module lens
//     - Distinguishing between similar techniques (metaphor vs simile vs symbol)
//
//   Operates across all text types: prose, poetry, drama, film, nonfiction.
//   Enforces the HSC distinction between IDENTIFYING a technique (low marks)
//   and ANALYSING its effect and meaning (high marks).

'use strict';

// ─────────────────────────────────────────────────────────────
// Task classifier
// ─────────────────────────────────────────────────────────────

/**
 * Detects the specific technique task.
 * Returns: 'identify' | 'name' | 'effect' | 'explain' | 'distinguish'
 *
 * identify   = student has a passage, wants techniques listed
 * name       = student knows there's a technique but can't name it
 * effect     = student has named a technique, needs help with effect/meaning
 * explain    = student wants a technique concept fully explained with examples
 * distinguish = student is confusing two similar techniques
 */
function classifyTechniqueTask(input) {
  const t = input.toLowerCase();
  if (/what.*technique|find.*technique|identify.*technique|list.*technique|any technique|techniques in this/i.test(t)) {
    return 'identify';
  }
  if (/difference between|metaphor.*simile|simile.*metaphor|symbol.*motif|allusion.*reference|juxtaposition.*contrast|confused about|what is the difference/i.test(t)) {
    return 'distinguish';
  }
  if (/what is.*technique|what does.*mean|explain.*technique|what is a|what is an|define/i.test(t)) {
    return 'explain';
  }
  if (/effect of|what effect|impact of|how does this technique|why did the author use/i.test(t)) {
    return 'effect';
  }
  if (/what do i call|what is this called|name this|is this a|what technique is this/i.test(t)) {
    return 'name';
  }
  return 'identify'; // default: student has a passage, identify techniques
}

/**
 * Detects text type from input.
 * Returns: 'poetry' | 'prose' | 'drama' | 'film' | 'nonfiction' | 'general'
 */
function classifyTextType(input) {
  const t = input.toLowerCase();
  if (/poem|poetry|stanza|line|verse|enjambment|caesura|metre|meter|rhyme|sonnet/i.test(t))   return 'poetry';
  if (/film|movie|scene|shot|camera|director|montage|mise en scene|cinematograph/i.test(t))   return 'film';
  if (/play|drama|stage|dialogue|monologue|soliloquy|act|scene|playwright/i.test(t))          return 'drama';
  if (/article|editorial|speech|essay|nonfiction|non-fiction|report|letter|persuasive/i.test(t)) return 'nonfiction';
  return 'prose';
}

// ─────────────────────────────────────────────────────────────
// Technique taxonomy (used to enrich the system prompt)
// ─────────────────────────────────────────────────────────────

const TECHNIQUE_CATEGORIES = {
  figurative: ['metaphor', 'extended metaphor', 'simile', 'personification', 'symbolism', 'motif', 'allegory', 'synecdoche', 'metonymy'],
  sound:      ['alliteration', 'assonance', 'consonance', 'onomatopoeia', 'sibilance', 'rhyme', 'rhythm', 'metre'],
  structural: ['enjambment', 'caesura', 'repetition', 'anaphora', 'epistrophe', 'parallelism', 'juxtaposition', 'contrast', 'chiasmus'],
  syntax:     ['short sentences', 'long sentences', 'sentence fragments', 'rhetorical questions', 'imperatives', 'passive voice', 'ellipsis'],
  imagery:    ['visual imagery', 'tactile imagery', 'auditory imagery', 'olfactory imagery', 'gustatory imagery', 'kinesthetic imagery'],
  tone:       ['irony', 'sarcasm', 'satire', 'hyperbole', 'understatement', 'euphemism', 'pathos', 'ethos', 'logos'],
  narrative:  ['first person narration', 'unreliable narrator', 'free indirect discourse', 'stream of consciousness', 'foreshadowing', 'flashback', 'in medias res'],
  film:       ['close-up', 'wide shot', 'extreme close-up', 'tracking shot', 'high angle', 'low angle', 'non-diegetic sound', 'diegetic sound', 'montage', 'fade', 'dissolve', 'mise en scène'],
};

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(studentModel, techniqueTask, textType) {
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';
  const engagement = studentModel?.affectiveState?.currentEngagement      || 'focused';

  let toneInstruction = 'Be precise and use correct literary terminology. Show examples immediately.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is frustrated. Start with one clear example before any explanation. Keep definitions short. Normalise confusion about techniques.';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Push for precision — distinguish between surface technique names and sophisticated analysis. Challenge vague technique labels.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student is tired. Identify the one most important technique and fully explain it. Do not overwhelm with a full list.';
  }

  let formatInstruction = 'For each technique: (1) Name it precisely, (2) Quote the relevant words, (3) Explain the effect, (4) Connect to meaning.';
  if (style === 'visual') {
    formatInstruction = 'Use a table or structured list with columns: TECHNIQUE | TEXTUAL EXAMPLE | EFFECT | MEANING. Then explain the most important one in prose.';
  } else if (style === 'numerical') {
    formatInstruction = 'Use a numbered list. Each technique gets 4 dot points: name / quote / effect / meaning. Then write one complete analysis sentence as a model.';
  }

  // Build the technique taxonomy hint for the relevant text type
  const relevantTechniques = textType === 'film'
    ? [...TECHNIQUE_CATEGORIES.film, ...TECHNIQUE_CATEGORIES.tone, ...TECHNIQUE_CATEGORIES.structural]
    : textType === 'poetry'
    ? [...TECHNIQUE_CATEGORIES.sound, ...TECHNIQUE_CATEGORIES.figurative, ...TECHNIQUE_CATEGORIES.structural, ...TECHNIQUE_CATEGORIES.imagery]
    : [...TECHNIQUE_CATEGORIES.figurative, ...TECHNIQUE_CATEGORIES.syntax, ...TECHNIQUE_CATEGORIES.narrative, ...TECHNIQUE_CATEGORIES.tone, ...TECHNIQUE_CATEGORIES.imagery];

  // Task-specific instructions
  const taskGuide = {
    identify: `
YOUR TASK — TECHNIQUE IDENTIFICATION:
1. Read the passage carefully.
2. Identify the 3-4 most analytically significant techniques — not every technique, but the ones that carry the most meaning.
3. For each: name it precisely, quote the relevant words (under 10 words), state the immediate effect on the reader, and connect to a broader meaning or argument.
4. Rank them by analytical value: which technique is richest for an HSC essay?
⚠️ HSC MARKING NOTE: Spotting techniques earns LOW marks. Analysing their effect and connecting to meaning is what earns Band 5/6. Always prioritise the WHY over the WHAT.
Relevant techniques for ${textType}: ${relevantTechniques.slice(0, 12).join(', ')}.`,

    name: `
YOUR TASK — TECHNIQUE NAMING:
1. The student has identified something in the text but doesn't know what it's called.
2. Give the precise HSC-accepted name for the technique.
3. Explain the definition briefly.
4. Give 2-3 other examples from well-known texts to confirm the student's understanding.
5. Warn about common naming confusions (e.g. metaphor vs simile, symbol vs motif).
⚠️ HSC MARKING NOTE: Technique names must be specific. "Language technique", "word choice", "literary device" are not acceptable in an HSC essay.`,

    effect: `
YOUR TASK — TECHNIQUE EFFECT AND MEANING:
The student knows the technique name. Now they need the effect-to-meaning chain:
  EFFECT:   What is the immediate impact on the reader? (emotional, cognitive, sensory)
  MEANING:  What does this reveal about the text's ideas, themes, or the author's purpose?
  LANGUAGE: Model a complete analysis sentence using the three-tier structure:
            "[Author] employs [precise technique] through '[short quote]', [effect on reader], [meaning/connection to argument]."
⚠️ HSC MARKING NOTE: Effect without meaning = Band 3. Effect + meaning + connection to argument = Band 5/6.`,

    explain: `
YOUR TASK — TECHNIQUE CONCEPT EXPLANATION:
1. Define the technique in one precise sentence.
2. Explain what effect this technique typically creates.
3. Give 3 concrete examples from well-known HSC texts (or representative examples).
4. Show a complete HSC-standard analysis sentence using this technique.
5. Note the most common mistake students make when using this technique in essays.`,

    distinguish: `
YOUR TASK — DISTINGUISHING SIMILAR TECHNIQUES:
1. Define each technique clearly and separately.
2. Show the key difference with a side-by-side example.
3. Give a decision rule: "If X, it is [Technique A]. If Y, it is [Technique B]."
4. Show how the ANALYSIS changes depending on which technique it is.
⚠️ HSC MARKING NOTE: Misidentifying a technique can cost marks. But more importantly, the name is less important than the analysis — if you analyse the effect correctly, markers will reward it even if the technique name is slightly imprecise.`,
  };

  const taskInstruction = taskGuide[techniqueTask] || taskGuide['identify'];

  return `You are OpenTutor — an expert HSC English Advanced tutor specialising in language technique analysis for Australian Year 11/12 students.

Text type detected: ${textType}

${taskInstruction}

STRICT REQUIREMENTS:
- Always quote from the text when identifying or analysing — never refer to techniques in the abstract.
- Technique names must be HSC-accepted and specific.
- Every analysis must include EFFECT and MEANING — not just technique identification.
- Use the language of analysis: "constructs", "positions the reader to", "invites", "evokes", "subverts".
- Do NOT use: "this shows", "this means", "this is a technique that". These phrases signal shallow analysis.
- Do NOT use LaTeX. Plain text only.

TONE: ${toneInstruction}
FORMAT: ${formatInstruction}

End with a "Technique Trap to Avoid:" — the single most common technique mistake for this text type that costs students marks.`;
}

function buildUserMessage(params, pastMistakes, techniqueTask, textType) {
  const { userInput, problem } = params;
  const questionText = problem || userInput;

  let message = `Please help me with language techniques in my HSC English text:\n\n${questionText}`;
  message += `\n\nDetected task: ${techniqueTask}. Detected text type: ${textType}.`;

  if (pastMistakes && pastMistakes.length > 0) {
    const recent = pastMistakes.slice(-2);
    message += `\nThis student has previously made the following technique errors:\n`;
    for (const m of recent) {
      message += `- ${m.errorType || 'technique'} error: ${m.notes || m.problem || 'unspecified'}\n`;
    }
    message += `Please specifically address these recurring mistakes.`;
  }

  return message;
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name: 'language-technique-identifier',
    version: '1.0.0',
    type: 'active',
  },

  /**
   * @param {object} params
   *   - userInput    {string}      — raw student message or passage text
   *   - problem      {string}      — extracted text passage or question
   *   - textType     {string|null} — 'poetry'|'prose'|'drama'|'film'|'nonfiction' if already known
   *
   * @param {object} context
   *   - studentId    {string}
   *   - memory       {MemoryManager}
   *   - studentModel {object}
   *   - model        {ModelManager}
   *   - knowledgeBase {object|null}
   *
   * @returns {Promise<{
   *   result:         string,
   *   visualization:  null,
   *   techniqueTask:  string,
   *   textType:       string,
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model } = context;
    const { userInput, problem, textType: textTypeOverride } = params;

    const questionText = problem || userInput || '';

    // ── 1. Classify task and text type ───────────────────────
    const techniqueTask = classifyTechniqueTask(questionText);
    const textType      = textTypeOverride || classifyTextType(questionText);

    // ── 2. Fetch past technique mistakes ─────────────────────
    let pastMistakes = [];
    if (memory) {
      try {
        pastMistakes = memory.getMistakesForSkill(studentId, 'language-technique-identifier');
      } catch { /* proceed without */ }
    }

    // ── 3. Build prompt ──────────────────────────────────────
    const systemPrompt = buildSystemPrompt(studentModel, techniqueTask, textType);
    const userMessage  = buildUserMessage(params, pastMistakes, techniqueTask, textType);

    // ── 4. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.45,
      maxTokens:   1400,
      skillName:   'language-technique-identifier',
      studentId,
    });

    // ── 5. Record attempt ────────────────────────────────────
    if (memory) {
      try {
        memory.recordAttempt(
          studentId,
          `english.technique.${textType}`,
          questionText,
          `technique task: ${techniqueTask}`,
          null,
          null,
        );
      } catch { /* non-fatal */ }
    }

    // ── 6. Return ────────────────────────────────────────────
    return {
      result:        response,
      visualization: null,
      techniqueTask,
      textType,
    };
  },
};