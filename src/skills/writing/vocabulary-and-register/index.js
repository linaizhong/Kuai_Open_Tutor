// Skill: vocabulary-and-register
// Type: active
// Phase 1 — HSC English academic register, vocabulary precision, and word choice
//
// Responsibility:
//   Develops students' control over academic register and precise vocabulary —
//   a consistent marker of Band 5/6 English responses. Many students write in
//   a register that is either too casual (conversational) or too inflated
//   (purple prose), and overuse a small set of weak verbs ("shows", "uses",
//   "demonstrates") that flatten their analysis.
//
//   Core tasks:
//     - UPGRADE: replace weak or repetitive word choices in a passage
//     - REGISTER: diagnose and fix register problems (too casual / too inflated)
//     - VOCABULARY: teach the analytical vocabulary for specific tasks
//     - VERBS: build a varied repertoire of analytical verbs beyond "shows"
//
//   This skill is tightly focused on the sentence and word level.
//   It complements essay-structure-coach (paragraph level) and
//   textual-evidence-builder (evidence level).

'use strict';

// ─────────────────────────────────────────────────────────────
// Vocabulary task classifier
// ─────────────────────────────────────────────────────────────

/**
 * Detects the vocabulary task.
 * Returns: 'upgrade' | 'register' | 'vocabulary' | 'verbs'
 */
function classifyVocabTask(input) {
  const t = input.toLowerCase();
  if (/too casual|too informal|sounds informal|not academic|conversational|too simple|sounds like i'm talking/i.test(t)) {
    return 'register';
  }
  if (/too fancy|too flowery|purple prose|overdone|sounds unnatural|trying too hard|too complex/i.test(t)) {
    return 'register';
  }
  if (/better word|different word|other word|instead of shows|instead of uses|word choice|replace.*shows|upgrade.*word|improve.*word/i.test(t)) {
    return 'upgrade';
  }
  if (/analytical verbs|instead of shows|verbs for analysis|analysis vocabulary|more verbs|better than shows|how do i say/i.test(t)) {
    return 'verbs';
  }
  return 'vocabulary'; // default: teach analytical vocabulary
}

/**
 * Detects the vocabulary context — what the student is trying to write.
 * Returns: 'analysis' | 'thesis' | 'topic-sentence' | 'creative' | 'general'
 */
function classifyVocabContext(input) {
  const t = input.toLowerCase();
  if (/thesis|argument|claim/i.test(t))            return 'thesis';
  if (/topic sentence|paragraph opener/i.test(t))  return 'topic-sentence';
  if (/creative|story|poem|narrative/i.test(t))    return 'creative';
  if (/analys|technique|effect/i.test(t))          return 'analysis';
  return 'general';
}

// ─────────────────────────────────────────────────────────────
// Vocabulary banks
// ─────────────────────────────────────────────────────────────

// Analytical verbs organised by function
const ANALYTICAL_VERBS = {
  construction: [
    'constructs', 'positions', 'frames', 'situates', 'renders', 'casts',
    'depicts', 'presents', 'establishes', 'configures', 'orchestrates',
  ],
  effect: [
    'evokes', 'generates', 'produces', 'creates', 'induces', 'elicits',
    'engenders', 'cultivates', 'precipitates', 'amplifies', 'intensifies',
  ],
  readerPositioning: [
    'invites', 'compels', 'challenges', 'unsettles', 'implicates',
    'positions the reader to', 'encourages the reader to', 'confronts the reader with',
    'enables the reader to', 'forces the reader to reconsider',
  ],
  argument: [
    'demonstrates', 'reveals', 'exposes', 'illuminates', 'underscores',
    'foregrounds', 'highlights', 'draws attention to', 'privileges',
    'interrogates', 'subverts', 'dismantles', 'reframes', 'complicates',
  ],
  textualRelationship: [
    'echoes', 'mirrors', 'parallels', 'responds to', 'extends', 'subverts',
    'reimagines', 'recontextualises', 'challenges', 'complicates', 'deepens',
  ],
};

// Register vocabulary — replacing common weak choices
const REGISTER_UPGRADES = {
  'shows': ['reveals', 'demonstrates', 'illuminates', 'exposes', 'foregrounds'],
  'uses': ['employs', 'deploys', 'harnesses', 'utilises', 'draws upon'],
  'shows that': ['suggests that', 'implies that', 'indicates that', 'signals that'],
  'talks about': ['addresses', 'explores', 'examines', 'interrogates', 'engages with'],
  'says': ['asserts', 'contends', 'argues', 'claims', 'posits', 'states'],
  'good': ['effective', 'resonant', 'powerful', 'significant', 'compelling'],
  'bad': ['ineffective', 'reductive', 'superficial', 'problematic', 'limiting'],
  'really': ['notably', 'particularly', 'especially', 'markedly', 'distinctly'],
  'a lot of': ['an abundance of', 'extensive', 'pervasive', 'prevalent', 'numerous'],
  'makes the reader feel': ['positions the reader to experience', 'evokes in the reader', 'invites the reader to feel'],
  'the author wants': ['the author intends', 'the author seeks to', 'the author aims to', 'the author deliberately'],
  'this is important because': ['this is significant because', 'this reveals that', 'this demonstrates that'],
  'interesting': ['striking', 'notable', 'significant', 'revealing', 'illuminating'],
  'big': ['extensive', 'expansive', 'profound', 'pervasive', 'significant'],
  'small': ['intimate', 'confined', 'restricted', 'limited', 'understated'],
};

// Register markers by type
const REGISTER_PROBLEMS = {
  tooInformal: {
    markers: ['you can see', 'kind of', 'sort of', 'a lot', 'really', 'very', 'things', 'stuff', 'people', 'it\'s like', 'basically', 'in a way', 'we see that'],
    fix: 'Replace conversational phrases with precise academic language. Avoid second person ("you") and vague nouns ("things", "stuff").',
  },
  tooInflated: {
    markers: ['one cannot help but', 'the ineffable', 'quintessentially', 'paradigmatic', 'hermeneutical', 'epistemological', 'ontological'],
    fix: 'Choose the most precise word, not the most impressive-sounding one. Purple prose reads as insecure. Clarity and precision over complexity.',
  },
  tooRepetitive: {
    markers: ['shows', 'demonstrates', 'uses', 'has', 'makes'],
    fix: 'Expand your analytical verb range. You are using the same 3 verbs for every analytical move, which flattens your analysis.',
  },
};

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(studentModel, vocabTask, vocabContext) {
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';
  const engagement = studentModel?.affectiveState?.currentEngagement      || 'focused';

  let toneInstruction = 'Be precise and direct. Word choice improvement should be visible in concrete rewrites immediately.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is frustrated. Give them 5 specific verb upgrades they can use today. Do not overwhelm with too many options.';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Push for sophistication — challenge them to eliminate every generic word and find the precise one.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student is tired. Give them one swap: one weak word they are overusing, and three replacements.';
  }

  let formatInstruction = 'Use a BEFORE/AFTER format: show the weak word in context, then the improved sentence.';
  if (style === 'visual') {
    formatInstruction = 'Use a word-swap table: WEAK WORD | CONTEXT | UPGRADED OPTIONS | BEST CHOICE FOR THIS SENTENCE.';
  } else if (style === 'numerical') {
    formatInstruction = 'Give a numbered list of the top 10 words to add to their analytical vocabulary, each with a model sentence.';
  }

  const taskGuide = {
    upgrade: `
YOUR TASK — VOCABULARY UPGRADE:
1. Scan the student's passage for weak or overused word choices.
2. Identify the top 3-5 words that are reducing the analytical quality.
3. For each weak word:
   a. Quote the sentence containing it.
   b. Name WHY it is weak (too vague, too casual, too generic, wrong register).
   c. Offer 3 precise alternatives.
   d. Rewrite the sentence with the best choice.
4. Prioritise: which single word swap will have the highest impact on the marker?

Focus areas:
  • Analytical verbs: replace "shows", "uses", "demonstrates" with precise alternatives
  • Vague nouns: replace "things", "ideas", "aspects", "elements" with specific terms
  • Casual phrases: replace "you can see", "it's like", "kind of" with academic equivalents
  • Effect language: replace "makes the reader feel" with "positions the reader to experience"`,

    register: `
YOUR TASK — REGISTER DIAGNOSIS AND FIX:
Register problems in HSC English come in two forms:

TOO INFORMAL markers: ${REGISTER_PROBLEMS.tooInformal.markers.slice(0, 6).join(', ')}
Fix: ${REGISTER_PROBLEMS.tooInformal.fix}

TOO INFLATED markers: ${REGISTER_PROBLEMS.tooInflated.markers.slice(0, 5).join(', ')}
Fix: ${REGISTER_PROBLEMS.tooInflated.fix}

TOO REPETITIVE markers: ${REGISTER_PROBLEMS.tooRepetitive.markers.join(', ')}
Fix: ${REGISTER_PROBLEMS.tooRepetitive.fix}

Process:
1. Identify which register problem the student has.
2. Quote the 2-3 most egregious examples.
3. Explain why the register hurts their mark.
4. Rewrite each example at the correct register.
5. Give the student a "register check" — one sentence to read before submitting.`,

    vocabulary: `
YOUR TASK — TEACH ANALYTICAL VOCABULARY:
Teach vocabulary for the specific context: ${vocabContext}.

Analytical verb sets by function:
  CONSTRUCTION: ${ANALYTICAL_VERBS.construction.slice(0, 6).join(', ')}
  EFFECT: ${ANALYTICAL_VERBS.effect.slice(0, 6).join(', ')}
  READER POSITIONING: ${ANALYTICAL_VERBS.readerPositioning.slice(0, 4).join('; ')}
  ARGUMENT: ${ANALYTICAL_VERBS.argument.slice(0, 6).join(', ')}

For each verb set:
1. Explain what kind of analytical move it performs.
2. Show a model sentence using 2 verbs from the set.
3. Show the weak version using "shows" or "uses" and contrast it.

Then give the student a VOCABULARY ACQUISITION EXERCISE:
  Write the same analytical sentence 5 different ways using 5 different verbs from the construction set. Which version is most precise for this specific claim?`,

    verbs: `
YOUR TASK — ANALYTICAL VERB REPERTOIRE:
The student is over-relying on "shows", "demonstrates", or "uses".

Step 1 — Show the COST of verb repetition:
  Take one of their analysis sentences. Write it 3 times with different verbs.
  Show how the verb choice changes the MEANING of the sentence.

Step 2 — Teach verb selection by analytical function:
  Choose the verb BASED ON WHAT THE TECHNIQUE IS DOING:
  • If the author is building a picture → "constructs", "renders", "frames"
  • If the text is creating an emotional response → "evokes", "generates", "elicits"
  • If the text is positioning the reader → "invites", "compels", "positions"
  • If the text is making an argument → "reveals", "exposes", "interrogates"
  • If comparing two texts → "echoes", "subverts", "responds to", "recontextualises"

Step 3 — Personalised verb list:
  Give the student a list of 8 verbs to add to their writing this week — chosen based on the types of analysis sentences they tend to write.`,
  };

  const taskInstruction = taskGuide[vocabTask] || taskGuide['vocabulary'];

  // Most common weak words and their upgrades
  const upgradeExamples = Object.entries(REGISTER_UPGRADES).slice(0, 4)
    .map(([weak, strong]) => `  "${weak}" → ${strong.slice(0, 2).join(' / ')}`)
    .join('\n');

  return `You are OpenTutor — an expert HSC English Advanced vocabulary and register coach for Australian Year 11/12 students.

${taskInstruction}

Common vocabulary upgrades:
${upgradeExamples}

STRICT REQUIREMENTS:
- Always show the BEFORE and AFTER sentence — never just list words.
- Verb choice must match the analytical function — do not swap "shows" for any random verb.
- Precision over impressiveness: choose the word that is most accurate, not most complex.
- Maximum of 10 vocabulary items per response — too many choices overwhelm students.
- Never suggest a word the student won't understand or can't use accurately.

TONE: ${toneInstruction}
FORMAT: ${formatInstruction}

End with a "Weekly Vocabulary Target:" — one specific word or phrase the student should deliberately use in their next three pieces of writing to make it habitual.`;
}

function buildUserMessage(params, pastMistakes, vocabTask, vocabContext) {
  const { userInput, problem } = params;
  const questionText = problem || userInput;

  const modeLabel = {
    upgrade:    'Please upgrade the vocabulary in my HSC English writing',
    register:   'Please fix the register in my HSC English response',
    vocabulary: 'Please help me build better vocabulary for HSC English analysis',
    verbs:      'Please help me use better analytical verbs in my HSC English writing',
  };

  let message = `${modeLabel[vocabTask]}:\n\n${questionText}`;
  message += `\n\nDetected task: ${vocabTask}. Context: ${vocabContext}.`;

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
    name: 'vocabulary-and-register',
    version: '1.0.0',
    type: 'active',
  },

  /**
   * @param {object} params
   *   - userInput    {string}      — raw student message or writing sample
   *   - problem      {string}      — extracted passage or question
   *   - vocabContext {string|null} — 'analysis'|'thesis'|'topic-sentence'|'creative' if known
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
   *   vocabTask:     string,
   *   vocabContext:  string,
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model } = context;
    const { userInput, problem, vocabContext: vocabContextOverride } = params;

    const questionText = problem || userInput || '';

    // ── 1. Classify task and context ─────────────────────────
    const vocabTask    = classifyVocabTask(questionText);
    const vocabContext = vocabContextOverride || classifyVocabContext(questionText);

    // ── 2. Fetch past vocabulary struggles ───────────────────
    let pastMistakes = [];
    if (memory) {
      try {
        pastMistakes = memory.getMistakesForSkill(studentId, 'vocabulary-and-register');
      } catch { /* proceed without */ }
    }

    // ── 3. Build prompt ──────────────────────────────────────
    const systemPrompt = buildSystemPrompt(studentModel, vocabTask, vocabContext);
    const userMessage  = buildUserMessage(params, pastMistakes, vocabTask, vocabContext);

    // ── 4. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.4,
      maxTokens:   1300,
      skillName:   'vocabulary-and-register',
      studentId,
    });

    // ── 5. Record attempt ────────────────────────────────────
    if (memory) {
      try {
        memory.recordAttempt(
          studentId,
          `english.vocabulary.${vocabContext}`,
          questionText,
          `vocab task: ${vocabTask}`,
          null,
          null,
        );
      } catch { /* non-fatal */ }
    }

    // ── 6. Return ────────────────────────────────────────────
    return {
      result:        response,
      visualization: null,
      vocabTask,
      vocabContext,
    };
  },
};