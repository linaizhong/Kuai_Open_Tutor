// Skill: reading-comprehension-coach
// Type: active
// Phase 1 — HSC English unseen text comprehension and close reading
//
// Responsibility:
//   Builds students' ability to read and respond to unseen texts in
//   HSC English Advanced — the critical skill tested in Paper 1 Section I
//   and in any response requiring engagement with unfamiliar material.
//
//   Core tasks:
//     - CLOSE-READ: model a close reading of a passage sentence by sentence
//     - ANNOTATE:   teach annotation strategies for unseen texts
//     - RESPOND:    help construct a short-answer or paragraph response to unseen text
//     - STRATEGY:   teach time-management and reading strategies for exam conditions
//
//   Key difference from other English skills: this skill works with texts
//   the student has NEVER SEEN before. The skill must teach transferable
//   reading strategies, not text-specific knowledge.

'use strict';

// ─────────────────────────────────────────────────────────────
// Classifiers
// ─────────────────────────────────────────────────────────────

/**
 * Detects the comprehension task.
 * Returns: 'close-read' | 'annotate' | 'respond' | 'strategy'
 */
function classifyComprehensionTask(input) {
  const t = input.toLowerCase();
  if (/how do i annotate|annotation strategy|how to annotate|what to annotate|mark up/i.test(t)) {
    return 'annotate';
  }
  if (/exam strategy|time management|how much time|how long|exam technique|under pressure|timed/i.test(t)) {
    return 'strategy';
  }
  if (/write a response|write a paragraph|answer the question|respond to|short answer|how do i answer/i.test(t)) {
    return 'respond';
  }
  return 'close-read'; // default: student has a text, wants help reading it
}

/**
 * Detects the unseen text type.
 * Returns: 'poetry' | 'prose' | 'nonfiction' | 'visual' | 'multimodal' | 'general'
 */
function classifyTextType(input) {
  const t = input.toLowerCase();
  if (/poem|poetry|stanza|verse|lyric/i.test(t))                              return 'poetry';
  if (/image|photo|cartoon|advertisement|poster|visual|painting/i.test(t))    return 'visual';
  if (/article|editorial|speech|essay|nonfiction|opinion|letter|report/i.test(t)) return 'nonfiction';
  if (/multimodal|multiple text|text 1.*text 2|section 1/i.test(t))           return 'multimodal';
  return 'prose';
}

// ─────────────────────────────────────────────────────────────
// Close reading framework
// ─────────────────────────────────────────────────────────────

const CLOSE_READING_STEPS = [
  { step: 1, label: 'First impression', instruction: 'Read the whole text once without stopping. What is the overall TONE? What is it about at the surface level?' },
  { step: 2, label: 'Title and context clues', instruction: 'What does the title suggest? Are there any dates, author names, or publication context that signal meaning?' },
  { step: 3, label: 'First and last sentences', instruction: 'Read only the first and last sentences. What frame does the text set up? What does it leave the reader with?' },
  { step: 4, label: 'Technique scan', instruction: 'Do a second pass looking ONLY for techniques. Circle figurative language, sound devices, structural choices, unusual syntax.' },
  { step: 5, label: 'Effect and meaning', instruction: 'For the 2-3 most significant techniques found: what effect do they create? What do they reveal about the text\'s central idea?' },
  { step: 6, label: 'Purpose and audience', instruction: 'Who is this text for? What is it trying to do to its reader — persuade, move, unsettle, console? How does this shape the reading?' },
];

// ─────────────────────────────────────────────────────────────
// Annotation strategies by text type
// ─────────────────────────────────────────────────────────────

const ANNOTATION_STRATEGIES = {
  poetry: [
    'Circle every image. Draw arrows to show which images are connected.',
    'Mark the tone shifts with a T. Where does the voice change register?',
    'Count syllables in 3-4 lines. Is there a rhythmic pattern? Where does it break?',
    'Underline the volta (turn) — where the poem\'s direction changes.',
    'Box the final image. Work backwards from it: everything before prepares for this.',
  ],
  prose: [
    'Underline the first sentence of every paragraph — the argument lives here.',
    'Mark dialogue with D. What is said vs what is left unsaid?',
    'Circle time markers — flashback, foreshadowing, present tense shifts.',
    'Mark the point where something changes. Every story has a "turn".',
    'Box any repeated word or image — it is a motif and carries weight.',
  ],
  nonfiction: [
    'Underline the thesis — usually the last sentence of the first paragraph.',
    'Mark every rhetorical device: R(Q) for rhetorical question, A for anaphora, etc.',
    'Note the evidence type for each claim: anecdote / statistic / authority / analogy.',
    'Mark tone shifts — where does the writer\'s register change and why?',
    'Circle the call to action or concluding appeal.',
  ],
  visual: [
    'Describe what you see before you interpret: foreground, background, focal point.',
    'Note colour choices: warm/cool, contrast, saturation.',
    'Identify the gaze: who is looking at whom? What does the viewer\'s position imply?',
    'Look for text within the image — caption, slogan, labels. How does text interact with image?',
    'Ask: what is absent? What has been cropped, removed, or not shown?',
  ],
  general: [
    'Read once for the overall. Read again for the detail.',
    'Mark the most striking technique. Work outward from that choice.',
    'Identify the tone: what emotion does the text want the reader to feel?',
    'Find the central image or idea. Everything else supports it.',
  ],
};

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(studentModel, comprehensionTask, textType) {
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';
  const engagement = studentModel?.affectiveState?.currentEngagement      || 'focused';

  let toneInstruction = 'Be methodical and clear. Unseen texts feel overwhelming — show a repeatable process.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is overwhelmed by an unfamiliar text. Begin with the ONE thing to look for first. Make the text feel less intimidating by giving a starting point.';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Push for close reading depth — challenge them to notice the second and third layers of meaning beyond the obvious.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student is tired. Give a 3-step process only. Keep it minimal.';
  }

  let formatInstruction = 'Walk through the close reading step by step, showing your reading process in real time.';
  if (style === 'visual') {
    formatInstruction = 'Use an annotation map — show the text with bracketed labels [TECHNIQUE] [EFFECT] [MEANING] inline. Then explain the most important annotations.';
  } else if (style === 'numerical') {
    formatInstruction = 'Use the 6-step close reading framework as a numbered checklist. Apply each step to the text in order.';
  }

  const taskGuide = {
    'close-read': `
YOUR TASK — MODEL A CLOSE READING:
Apply the 6-step close reading framework to the student's text:
${CLOSE_READING_STEPS.map(s => `  Step ${s.step} — ${s.label}: ${s.instruction}`).join('\n')}

For this text type (${textType}), prioritise:
${(ANNOTATION_STRATEGIES[textType] || ANNOTATION_STRATEGIES['general']).slice(0, 3).map(s => `  • ${s}`).join('\n')}

After modelling the close reading:
1. Identify the 2-3 most analytically rich moments in the text.
2. Show a complete analysis sentence for the strongest moment.
3. Give the student a "reading entry point" — the one question to ask first when approaching any unfamiliar ${textType}.`,

    annotate: `
YOUR TASK — TEACH ANNOTATION STRATEGIES:
Show the student a systematic annotation approach for ${textType}:
${(ANNOTATION_STRATEGIES[textType] || ANNOTATION_STRATEGIES['general']).map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

Then:
1. Apply these annotations to the first paragraph/stanza of the student's text.
2. Show what a well-annotated text looks like (use [BRACKETS] to simulate marks on the text).
3. Explain what NOT to annotate — the mistake of underlining everything, which leaves nothing marked.
4. Give a "time check": in an exam with 15 minutes for a text, how much time should annotation take?`,

    respond: `
YOUR TASK — BUILD A SHORT-ANSWER RESPONSE:
Help the student write a response to an unseen text question. Structure for a 4-6 mark short answer:
  Sentence 1 — Analytical claim that directly answers the question (no introduction, no "In this text...")
  Sentence 2-3 — Evidence: embedded quote + named technique + effect
  Sentence 4 — Meaning: what this reveals about the text's central idea or purpose
  Sentence 5 — (For 6-mark responses) Second piece of evidence, or broader insight

Show:
1. A model response to a generic question about this text.
2. The annotation of each sentence showing its function.
3. The single most common short-answer failure: beginning with "In this text, the author uses many techniques..."`,

    strategy: `
YOUR TASK — EXAM READING STRATEGIES:
Teach time management and reading strategies for Paper 1 Section I conditions:

Time allocation (approximate for Section I):
  • Reading time: use all of it on Section I texts. Read each text twice.
  • Per text: ~2-3 minutes reading, 3-4 minutes writing for a 4-mark question
  • Do NOT copy out long quotes — embed short phrases (under 8 words)

Reading order strategy:
  1. Read the question FIRST, then the text — know what you're looking for
  2. First read: surface meaning and tone
  3. Second read: technique identification and effect

Under time pressure, prioritise:
  • 1 technique + 1 effect + 1 meaning = a complete analysis sentence
  • Do not attempt to say everything — depth on one point beats breadth on five

Common time-wasting habits to eliminate:
  • Copying out long quotes
  • Writing a full introduction for a short-answer question
  • Analysing techniques without stating their effect`,
  };

  const taskInstruction = taskGuide[comprehensionTask] || taskGuide['close-read'];

  return `You are OpenTutor — an expert HSC English Advanced reading coach for Australian Year 11/12 students.

Text type: ${textType}

${taskInstruction}

STRICT REQUIREMENTS:
- Always work FROM the text. Quote specific words and phrases — do not speak in generalities.
- Teach transferable strategies that work on ANY unseen text, not just this one.
- Model the reading process in real time — show thinking, not just conclusions.
- Short answers must be analytical from sentence 1. No "In this text..." openers.
- Do NOT write a full essay response. Model the analytical sentence unit.

TONE: ${toneInstruction}
FORMAT: ${formatInstruction}

End with a "First Move:" — the single first thing the student should do when they see an unseen text in the exam.`;
}

function buildUserMessage(params, pastMistakes, comprehensionTask, textType) {
  const { userInput, problem } = params;
  const questionText = problem || userInput;

  const modeLabel = {
    'close-read': 'Please help me close read this HSC English unseen text',
    'annotate':   'Please teach me how to annotate this HSC English text',
    'respond':    'Please help me write a response to this HSC English unseen text question',
    'strategy':   'Please teach me reading strategies for HSC English unseen texts',
  };

  let message = `${modeLabel[comprehensionTask]}:\n\n${questionText}`;
  message += `\n\nDetected text type: ${textType}. Task: ${comprehensionTask}.`;

  if (pastMistakes && pastMistakes.length > 0) {
    const recent = pastMistakes.slice(-2);
    message += `\nThis student has previously struggled with:\n`;
    for (const m of recent) {
      message += `- ${m.notes || m.problem || 'unspecified'}\n`;
    }
  }

  return message;
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name: 'reading-comprehension-coach',
    version: '1.0.0',
    type: 'active',
  },

  /**
   * @param {object} params
   *   - userInput    {string}      — raw student message or text passage
   *   - problem      {string}      — extracted passage or question
   *   - textType     {string|null} — text type if already known
   *
   * @param {object} context
   *   - studentId    {string}
   *   - memory       {MemoryManager}
   *   - studentModel {object}
   *   - model        {ModelManager}
   *   - knowledgeBase {object|null}
   *
   * @returns {Promise<{
   *   result:             string,
   *   visualization:      null,
   *   comprehensionTask:  string,
   *   textType:           string,
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model } = context;
    const { userInput, problem, textType: textTypeOverride } = params;

    const questionText = problem || userInput || '';

    // ── 1. Classify task and text type ───────────────────────
    const comprehensionTask = classifyComprehensionTask(questionText);
    const textType          = textTypeOverride || classifyTextType(questionText);

    // ── 2. Fetch past comprehension struggles ────────────────
    let pastMistakes = [];
    if (memory) {
      try {
        pastMistakes = memory.getMistakesForSkill(studentId, 'reading-comprehension-coach');
      } catch { /* proceed without */ }
    }

    // ── 3. Build prompt ──────────────────────────────────────
    const systemPrompt = buildSystemPrompt(studentModel, comprehensionTask, textType);
    const userMessage  = buildUserMessage(params, pastMistakes, comprehensionTask, textType);

    // ── 4. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.4,
      maxTokens:   1400,
      skillName:   'reading-comprehension-coach',
      studentId,
    });

    // ── 5. Record attempt ────────────────────────────────────
    if (memory) {
      try {
        memory.recordAttempt(
          studentId,
          `english.reading.${textType}`,
          questionText,
          `comprehension task: ${comprehensionTask}`,
          null,
          null,
        );
      } catch { /* non-fatal */ }
    }

    // ── 6. Return ────────────────────────────────────────────
    return {
      result:            response,
      visualization:     null,
      comprehensionTask,
      textType,
    };
  },
};