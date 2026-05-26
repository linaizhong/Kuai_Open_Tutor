// Skill: rubric-decoder
// Type: active
// Phase 1 — HSC English Advanced marking rubric interpretation
//
// Responsibility:
//   Translates the abstract language of the HSC English Advanced marking rubric
//   into concrete, actionable writing behaviours students can actually demonstrate.
//   Rubric descriptors like "sustained", "nuanced", "perceptive", "sophisticated"
//   are meaningless to most students without explicit translation.
//
//   Core tasks:
//     - DECODE: explain what a specific rubric descriptor means in practice
//     - SELF-ASSESS: help a student evaluate their own response against the rubric
//     - BAND-MAP: show what is needed to move from their current band to the next
//     - COMPARE: show Band 3 vs Band 5 vs Band 6 responses side by side
//
//   Covers the HSC English Advanced band descriptors for:
//     - Common Module (Paper 1)
//     - Module A, B, C (Paper 2)
//     - Creative writing component

'use strict';

// ─────────────────────────────────────────────────────────────
// Classifiers
// ─────────────────────────────────────────────────────────────

/**
 * Detects the rubric task.
 * Returns: 'decode' | 'self-assess' | 'band-map' | 'compare'
 */
function classifyRubricTask(input) {
  const t = input.toLowerCase();
  if (/what does.*mean|what is.*sustained|what is.*nuanced|what is.*perceptive|what is.*sophisticated|explain.*rubric|what does the marker/i.test(t)) {
    return 'decode';
  }
  if (/what band|what mark|how many marks|am i band|is this band|rate my|score my|assess my/i.test(t)) {
    return 'self-assess';
  }
  if (/how do i get.*band 6|how do i improve|move.*to band|get to band 6|reach band 6|what do i need/i.test(t)) {
    return 'band-map';
  }
  if (/difference between band|band 3 vs band 6|band 4 and band 6|show me.*band|example.*band/i.test(t)) {
    return 'compare';
  }
  return 'decode'; // default
}

/**
 * Detects which band the student thinks they are currently at.
 * Returns: 1 | 2 | 3 | 4 | 5 | 6 | null
 */
function detectCurrentBand(input) {
  const match = input.match(/band\s*([1-6])/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Detects the module.
 * Returns: 'common' | 'modA' | 'modB' | 'modC' | 'creative' | 'general'
 */
function classifyModule(input) {
  const t = input.toLowerCase();
  if (/module a|mod a|textual conversation/i.test(t))       return 'modA';
  if (/module b|mod b|critical study/i.test(t))             return 'modB';
  if (/module c|mod c|craft of writing/i.test(t))           return 'modC';
  if (/creative writing|creative piece|short story|poem/i.test(t)) return 'creative';
  if (/common module|human experiences/i.test(t))           return 'common';
  return 'general';
}

// ─────────────────────────────────────────────────────────────
// Rubric translation database
// ─────────────────────────────────────────────────────────────

const RUBRIC_TERMS = {
  'sustained': {
    term: 'sustained',
    rubricMeaning: 'The quality of analysis is maintained consistently across the entire response — not just in the best paragraph.',
    studentMeaning: 'Every paragraph is as analytically strong as your best paragraph. You cannot coast in the middle or rush the ending.',
    bandLevel: 'Band 5-6',
    weak: 'Strong opening paragraph, then body paragraphs drop to plot summary, then a brief conclusion.',
    strong: 'Every paragraph contains: a contestable claim, embedded quote, named technique, effect analysis, and module lens connection.',
    selfCheckQuestion: 'Is my weakest paragraph still analytical, or does it drift into summary?',
  },
  'nuanced': {
    term: 'nuanced',
    rubricMeaning: 'The response acknowledges complexity, tension, or qualification in the text\'s meaning — it does not reduce the text to one simple idea.',
    studentMeaning: 'You acknowledge when the text is doing more than one thing at once, when its meaning is not simple, or when it pushes back against easy readings.',
    bandLevel: 'Band 5-6',
    weak: 'The text shows that love is powerful.',
    strong: 'The text simultaneously celebrates and mourns love — constructing it as both the source of human meaning and the site of its deepest loss.',
    selfCheckQuestion: 'Have I acknowledged any tension, contradiction, or complexity in the text, or am I reducing it to one simple point?',
  },
  'perceptive': {
    term: 'perceptive',
    rubricMeaning: 'The student notices details that most readers would miss, and draws non-obvious conclusions from them.',
    studentMeaning: 'Your analysis makes the marker think "I hadn\'t noticed that" or "that\'s a sharper reading than most." It is not about the obvious themes — it\'s about what those themes are built from.',
    bandLevel: 'Band 6',
    weak: 'The use of dark imagery shows the character is sad.',
    strong: 'The consistent displacement of the character\'s grief onto setting — pathetic fallacy as the text\'s structural principle — reveals that the narrator cannot yet name the loss directly, only approach it obliquely through the external world.',
    selfCheckQuestion: 'Is this something most students would write, or is it a reading that requires genuine attention to this specific text?',
  },
  'sophisticated': {
    term: 'sophisticated',
    rubricMeaning: 'The response demonstrates a high level of control over both ideas and language — complex concepts are handled with precision and the argument is coherently constructed.',
    studentMeaning: 'Your vocabulary is precise, your sentences are controlled, and your argument builds — each paragraph adds something new rather than repeating the same point at different places.',
    bandLevel: 'Band 6',
    weak: 'This technique is effective because it makes the reader feel things. It shows that the author is good at writing.',
    strong: 'This technique enacts the text\'s central argument at the level of form itself — the fragmented syntax performing the psychological discontinuity the narrative describes.',
    selfCheckQuestion: 'Am I using the same 3 words in every paragraph ("shows", "demonstrates", "illustrates"), or am I choosing language precisely for each specific analytical move?',
  },
  'insightful': {
    term: 'insightful',
    rubricMeaning: 'The student draws conclusions that illuminate something beyond the text itself — about human experience, society, or the nature of representation.',
    studentMeaning: 'Your analysis connects the specific to the universal. You are not just writing about this text — you are using this text to say something about the world.',
    bandLevel: 'Band 6',
    weak: 'This shows that the character has had a hard life.',
    strong: 'This positions the personal trauma as symptomatic of a larger cultural rupture — the individual\'s fractured memory a mirror for collective historical forgetting.',
    selfCheckQuestion: 'Does my analysis stay inside the text, or does it reach outward to say something about human experience or the world?',
  },
  'integrated': {
    term: 'integrated',
    rubricMeaning: 'Textual evidence and analysis are woven together rather than presented as separate blocks (quote + then analysis).',
    studentMeaning: 'Your quotes are embedded inside your analytical sentences — they appear as part of your argument, not as a separate exhibit.',
    bandLevel: 'Band 4-5',
    weak: 'The author uses a metaphor: "the world is a cold machine." This shows that the world is presented as harsh.',
    strong: 'By constructing the world as a "cold machine", the author strips the natural world of warmth and agency, positioning modern industrial society as antithetical to human flourishing.',
    selfCheckQuestion: 'Can I remove my quotes from my sentences and have the analysis still make grammatical sense? If yes, my quotes are not integrated.',
  },
  'evaluative': {
    term: 'evaluative',
    rubricMeaning: 'The student makes judgements about the text\'s effectiveness, significance, or the quality of its ideas — not just describes what it does.',
    studentMeaning: 'You have an opinion about the text. You are arguing that it achieves something, or that it reveals something, or that its approach to [idea] is [specific quality]. You are not just reporting what is there.',
    bandLevel: 'Band 5-6',
    weak: 'The text uses many techniques to convey its ideas.',
    strong: 'The text\'s most significant achievement is its refusal of resolution — a structural choice that forces the reader to sit with discomfort rather than the consolation of meaning.',
    selfCheckQuestion: 'Am I making a judgement about the text\'s value or effectiveness, or am I just describing what it contains?',
  },
};

// ─────────────────────────────────────────────────────────────
// Band descriptors (generalised across modules)
// ─────────────────────────────────────────────────────────────

const BAND_DESCRIPTORS = {
  6: {
    label: 'Band 6 (17-20 marks)',
    characteristics: [
      'Sustained, perceptive, and nuanced analysis throughout',
      'Sophisticated use of textual evidence — woven, not dropped',
      'Complex argument that builds across the essay',
      'Module lens actively integrated into every paragraph',
      'Precise and varied critical vocabulary',
      'Insight that reaches beyond the text to broader meaning',
    ],
    whatToDo: 'Maintain your analytical standard in every paragraph. Push your meaning tier further — what does this reveal about human experience / the textual relationship / the craft decision?',
  },
  5: {
    label: 'Band 5 (13-16 marks)',
    characteristics: [
      'Consistent analysis with some perceptive moments',
      'Good use of evidence, though occasionally over-quoted',
      'Clear argument, though sometimes loses direction mid-essay',
      'Module lens present but sometimes bolted on rather than integrated',
      'Competent vocabulary with occasional imprecision',
    ],
    whatToDo: 'To reach Band 6: eliminate plot summary entirely, push every analysis sentence to its third tier (the broader meaning), and vary your analytical verbs beyond "shows" and "demonstrates".',
  },
  4: {
    label: 'Band 4 (9-12 marks)',
    characteristics: [
      'Analysis present but inconsistent — strongest in some paragraphs, absent in others',
      'Evidence selected but analysis often stops at effect without reaching meaning',
      'Argument present but some paragraphs feel disconnected from the thesis',
      'Module language appears but is often a surface addition',
    ],
    whatToDo: 'To reach Band 5: make sure every paragraph has a technique named, a quote embedded (not dropped), an effect stated, and a meaning connected to the thesis. Apply this formula to every paragraph without exception.',
  },
  3: {
    label: 'Band 3 (5-8 marks)',
    characteristics: [
      'Attempts analysis but often slips into paraphrase or plot summary',
      '"This shows that..." analysis — identifies technique but does not analyse effect',
      'Module is present in introduction but not integrated into body',
      'Limited range of techniques discussed',
    ],
    whatToDo: 'To reach Band 4: stop paraphrasing the text — every sentence must be analytical. For every quote you include, ask: what technique is this? What effect does it create? Connect it to the thesis.',
  },
};

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(studentModel, rubricTask, module, currentBand) {
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';
  const engagement = studentModel?.affectiveState?.currentEngagement      || 'focused';

  let toneInstruction = 'Be precise and practical. Translate abstract rubric language into specific sentences the student can write.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is frustrated with rubric language. Start with the simplest possible explanation and one concrete before/after example. Reassure them that rubric language is learnable.';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Challenge them — push beyond the surface meaning of the rubric descriptor to what it requires at the level of individual sentences.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student is tired. Give the one-sentence meaning and one model sentence. Nothing else.';
  }

  let formatInstruction = 'For each rubric descriptor: WHAT IT MEANS → WHAT IT LOOKS LIKE → WEAK EXAMPLE → STRONG EXAMPLE → SELF-CHECK QUESTION.';
  if (style === 'visual') {
    formatInstruction = 'Use a band ladder diagram (ASCII) showing what each band looks like, then zoom into the gap between the student\'s current band and the next.';
  } else if (style === 'numerical') {
    formatInstruction = 'Use a scoring rubric table: each criterion scored 1-3, with specific evidence from the student\'s writing where available.';
  }

  const nextBand = currentBand ? Math.min(currentBand + 1, 6) : null;
  const targetBandDesc = nextBand ? BAND_DESCRIPTORS[nextBand] : BAND_DESCRIPTORS[6];
  const currentBandDesc = currentBand ? BAND_DESCRIPTORS[currentBand] : null;

  const taskGuide = {
    decode: `
YOUR TASK — DECODE RUBRIC LANGUAGE:
For each rubric term the student asks about:
1. Give the MARKER'S meaning (what the rubric actually intends)
2. Give the STUDENT'S meaning (what they need to DO in their writing)
3. Show a WEAK sentence that fails this criterion
4. Show a STRONG sentence that passes it
5. Give a SELF-CHECK QUESTION the student can ask themselves

Use the rubric terms database: ${Object.keys(RUBRIC_TERMS).join(', ')}.

If the student asks about a term not in the database, apply the same framework using your HSC marking knowledge.`,

    'self-assess': `
YOUR TASK — SELF-ASSESSMENT:
Help the student evaluate their response against the HSC marking criteria.

If they have submitted a response, evaluate it on:
  ${['sustained', 'nuanced', 'integrated', 'evaluative'].map(t => `• ${RUBRIC_TERMS[t].term}: ${RUBRIC_TERMS[t].selfCheckQuestion}`).join('\n  ')}

For each criterion:
  1. PASS or IMPROVEMENT NEEDED
  2. Quote the specific line that earns/loses the criterion
  3. Rewrite that line to meet the criterion if it fails

Then: give an estimated band range with the specific reasons for the ceiling.`,

    'band-map': `
YOUR TASK — BAND MAP:
${currentBand ? `The student believes they are currently at Band ${currentBand}.` : 'The student wants to know what they need to reach Band 6.'}
${currentBandDesc ? `\nCurrent band (Band ${currentBand}) is characterised by:\n${currentBandDesc.characteristics.map(c => `  • ${c}`).join('\n')}` : ''}

Target: ${targetBandDesc.label}
Target characteristics:
${targetBandDesc.characteristics.map(c => `  ✓ ${c}`).join('\n')}

What to do: ${targetBandDesc.whatToDo}

Show this as a concrete GAP ANALYSIS:
  1. List the 3 specific things separating this band from the next
  2. For each: show what it looks like in their writing and what it should look like
  3. Give ONE sentence they can rewrite RIGHT NOW to demonstrate the upgrade`,

    compare: `
YOUR TASK — BAND COMPARISON:
Show the same analytical point written at Band 3, Band 5, and Band 6.
Use the same quote and the same topic so the comparison is controlled.

Band 3 version: [plot-level, "this shows", technique identified but not analysed]
Band 5 version: [technique named, effect stated, module mention, but meaning tier thin]
Band 6 version: [technique precise, effect clear, meaning tier reaches broader insight, module fully integrated]

Annotate each version to show WHAT makes the difference.
Then show the student the single UPGRADE MOVE that takes a Band 5 sentence to Band 6.`,
  };

  const taskInstruction = taskGuide[rubricTask] || taskGuide['decode'];

  return `You are OpenTutor — an expert HSC English Advanced marking coach for Australian Year 11/12 students.

${taskInstruction}

Module context: ${module}

STRICT REQUIREMENTS:
- Always translate abstract rubric language into concrete writing behaviours.
- Always show a weak and strong example for every rubric descriptor explained.
- Self-check questions must be actionable — the student can answer yes/no while reading their own work.
- Never use rubric language to describe rubric language (e.g. don't explain "nuanced" by saying "it needs to be more nuanced").
- Be specific: quote from the student's work where provided, and rewrite specific lines.

TONE: ${toneInstruction}
FORMAT: ${formatInstruction}

End with a "Rubric Reality Check:" — the single most misunderstood marking criterion in HSC English and what students actually need to do about it.`;
}

function buildUserMessage(params, pastMistakes, rubricTask, module, currentBand) {
  const { userInput, problem } = params;
  const questionText = problem || userInput;

  const modeLabel = {
    decode:      'Please explain this HSC English marking rubric language',
    'self-assess': 'Please help me self-assess my response against the HSC rubric',
    'band-map':  'Please show me what I need to do to reach Band 6',
    compare:     'Please show me the difference between band levels',
  };

  let message = `${modeLabel[rubricTask] || modeLabel['decode']}:\n\n${questionText}`;
  if (currentBand) message += `\n\nStudent believes current band: ${currentBand}`;
  message += `\nDetected module: ${module}. Task: ${rubricTask}.`;

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
    name: 'rubric-decoder',
    version: '1.0.0',
    type: 'active',
  },

  /**
   * @param {object} params
   *   - userInput    {string}      — raw student message or response text
   *   - problem      {string}      — extracted question or response
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
   *   rubricTask:    string,
   *   module:        string,
   *   currentBand:   number|null,
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model } = context;
    const { userInput, problem, module: moduleOverride } = params;

    const questionText = problem || userInput || '';

    // ── 1. Classify task, module and band ────────────────────
    const rubricTask  = classifyRubricTask(questionText);
    const module      = moduleOverride || classifyModule(questionText);
    const currentBand = detectCurrentBand(questionText);

    // ── 2. Fetch past rubric struggles ───────────────────────
    let pastMistakes = [];
    if (memory) {
      try {
        pastMistakes = memory.getMistakesForSkill(studentId, 'rubric-decoder');
      } catch { /* proceed without */ }
    }

    // ── 3. Build prompt ──────────────────────────────────────
    const systemPrompt = buildSystemPrompt(studentModel, rubricTask, module, currentBand);
    const userMessage  = buildUserMessage(params, pastMistakes, rubricTask, module, currentBand);

    // ── 4. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.4,
      maxTokens:   1500,
      skillName:   'rubric-decoder',
      studentId,
    });

    // ── 5. Record attempt ────────────────────────────────────
    if (memory) {
      try {
        memory.recordAttempt(
          studentId,
          `english.rubric.${module}`,
          questionText,
          `rubric task: ${rubricTask}`,
          null,
          null,
        );
      } catch { /* non-fatal */ }
    }

    // ── 6. Return ────────────────────────────────────────────
    return {
      result:      response,
      visualization: null,
      rubricTask,
      module,
      currentBand,
    };
  },
};