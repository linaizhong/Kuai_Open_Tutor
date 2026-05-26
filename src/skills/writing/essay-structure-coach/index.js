// Skill: essay-structure-coach
// Type: active
// Phase 1 — HSC English essay structure guidance and modelling
//
// Responsibility:
//   Guides students in constructing a well-structured HSC English Advanced essay:
//     - Thesis construction (contestable, specific, module-aware)
//     - Body paragraph structure (TEEL / topic sentence → evidence → explanation → link)
//     - Introduction and conclusion framing
//     - Sustained argument across paragraphs
//     - Module-specific structural expectations (Common Module, Mod A, Mod B, Mod C)
//
//   Can either model a full essay plan OR critique/rebuild a student's draft structure.
//   Personalises depth and tone using the Student Model.

'use strict';

// ─────────────────────────────────────────────────────────────
// Essay mode classifier
// ─────────────────────────────────────────────────────────────

/**
 * Detects whether the student wants a model plan or feedback on their own draft.
 * Returns: 'model' | 'feedback'
 */
function classifyEssayMode(input) {
  const t = input.toLowerCase();
  if (
    /my essay|my draft|my paragraph|my intro|my thesis|i wrote|i said|here is my|check my|feedback on|improve my|mark my|what's wrong|fix my/i.test(t)
  ) {
    return 'feedback';
  }
  return 'model';
}

/**
 * Detects the HSC English module from the input text.
 * Returns: 'common' | 'modA' | 'modB' | 'modC' | 'general'
 */
function classifyModule(input) {
  const t = input.toLowerCase();
  if (/module a|mod a|comparative|pair of texts|intertextual/i.test(t))   return 'modA';
  if (/module b|mod b|critical study|close study|prescribed text/i.test(t)) return 'modB';
  if (/module c|mod c|craft of writing|creative writing|style/i.test(t))  return 'modC';
  if (/common module|human experiences|discovery|texts and human/i.test(t)) return 'common';
  return 'general';
}

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(studentModel, essayMode, module) {
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';
  const engagement = studentModel?.affectiveState?.currentEngagement      || 'focused';
  const mastery    = studentModel?.masteryProfile || {};

  let toneInstruction = 'Use a clear, constructive tutor tone. Be specific and practical.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is frustrated. Begin with brief encouragement. Break the structure down into the smallest possible steps. Reassure them that structure is learnable.';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Be concise and push for sophistication — challenge them to refine rather than just complete.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student is tired. Keep advice focused and brief. Prioritise the highest-impact structural fix only.';
  }

  let formatInstruction = 'Use clear headings for each structural component. Show a model example followed by a brief explanation of why it works.';
  if (style === 'visual') {
    formatInstruction = 'Begin with a visual outline or diagram of the essay structure (use ASCII layout), then fill in each component with explanation and example.';
  } else if (style === 'numerical') {
    formatInstruction = 'Use a numbered checklist format. Show each structural component as a numbered requirement with a concrete example sentence.';
  }

  // Module-specific structural guidance
  const moduleGuide = {
    common: `
MODULE: Common Module — Texts and Human Experiences
- The thesis must directly address "the ways texts represent human experiences" — do not just name the text and author.
- Each body paragraph must connect the textual detail to a broader human experience (e.g. grief, belonging, identity).
- Avoid plot summary. Every sentence must be analytical.
- The essay must show understanding of how language and form construct meaning about human experience.
- Ideal body paragraph structure: Topic sentence (names experience + technique) → Embedded quote → Analysis of technique + effect → Connection to human experience.`,

    modA: `
MODULE: Module A — Textual Conversations
- The thesis must argue a relationship BETWEEN the two texts — not just describe each separately.
- Every body paragraph must reference BOTH texts. Weave the comparison rather than alternating.
- Use comparative language: "whereas", "similarly", "both texts", "in contrast to", "echoes", "subverts".
- The argument must show how the pair of texts illuminate each other — what does reading them together reveal?
- Avoid the 'tennis match' structure (Text 1 paragraph / Text 2 paragraph). Integrate.`,

    modB: `
MODULE: Module B — Critical Study of Literature
- The thesis must take a critical POSITION on the text — not just describe what it is about.
- Show awareness of context: historical, cultural, biographical context must be woven into analysis, not listed separately.
- Reference at least ONE critical perspective or secondary reading per essay (e.g. feminist, Marxist, postcolonial lens).
- The essay must demonstrate sustained engagement with the prescribed text at a close-reading level.
- Each paragraph should show how your interpretation differs from or builds on common readings.`,

    modC: `
MODULE: Module C — The Craft of Writing
- The thesis must make a claim about a CHOICE of technique and its EFFECT — this module is about writerly decisions.
- Each paragraph should name a technique, show it in action with a textual example, and explain the craft decision behind it.
- Use the language of craft: "the writer chooses", "this technique achieves", "the effect on the reader is".
- The essay must show awareness that writing is intentional — every choice has a purpose.
- If discussing student's own creative work, the structural claim must link to the reflection/statement of intention.`,

    general: `
MODULE: General HSC English Essay
- The thesis must be contestable — it must argue a position, not state an obvious fact.
- Each body paragraph must follow TEEL: Topic sentence → Evidence (embedded quote) → Explanation (technique + effect) → Link back to thesis.
- Avoid beginning sentences with "This shows..." — it leads to weak analysis. Instead: "Through [technique], [author] constructs...".
- The conclusion must synthesise — not repeat. It should elevate the argument to a broader insight.`,
  };

  const structure = moduleGuide[module] || moduleGuide['general'];

  const modeInstruction = essayMode === 'feedback'
    ? `You are reviewing a STUDENT'S DRAFT. Your task is to:
1. Identify the specific structural weakness with a precise label (e.g. "Missing topic sentence", "Thesis is descriptive not argumentative", "No link back to thesis").
2. Quote the exact part of the student's writing that has the problem.
3. Explain WHY it is a structural problem in HSC terms (what marks it loses).
4. Rewrite that specific section to show what it should look like.
5. Give ONE prioritised action item: the single change that will most improve their mark.`
    : `You are MODELLING a complete essay structure. Your task is to:
1. Write a model thesis for the question.
2. Write a full outline: intro shape, 3 body paragraph topic sentences with evidence slots, conclusion shape.
3. Write ONE complete model body paragraph in full.
4. Annotate each component with a brief label explaining what it does and why it earns marks.`;

  return `You are OpenTutor — an expert HSC English Advanced essay coach for Australian Year 11/12 students.

${modeInstruction}

${structure}

STRICT REQUIREMENTS:
- Every piece of advice must be directly actionable. No vague feedback like "develop your ideas more."
- Always show a BEFORE/AFTER rewrite when giving feedback — never just describe the problem.
- Use HSC marking language: "sustained argument", "perceptive analysis", "integrated evidence", "evaluative response".
- Do NOT write a full essay — model targeted components only.
- Do NOT use LaTeX. Plain text only.
- Keep advice grounded in NESA HSC English Advanced syllabus outcomes (2015 syllabus, examined from 2019).

TONE: ${toneInstruction}
FORMAT: ${formatInstruction}

End your response with a single "Band 6 Benchmark:" line — one sentence describing what a top-band response does structurally that average responses do not.`;
}

function buildUserMessage(params, moduleData, pastMistakes, essayMode, module) {
  const { userInput, problem } = params;
  const questionText = problem || userInput;

  let message = essayMode === 'feedback'
    ? `Please review the structure of my HSC English essay/draft:\n\n${questionText}`
    : `Please model the essay structure for the following HSC English question or topic:\n\n${questionText}`;

  if (moduleData) {
    message += `\n\nModule context: ${moduleData.name || module}\n`;
    if (moduleData.keySkills) {
      message += `Key skills assessed: ${moduleData.keySkills.slice(0, 3).join('; ')}\n`;
    }
  }

  if (pastMistakes && pastMistakes.length > 0) {
    const recent = pastMistakes.slice(-2);
    message += `\nThis student has previously struggled with the following essay structure issues:\n`;
    for (const m of recent) {
      message += `- ${m.errorType || 'structural'} issue: ${m.notes || m.problem || 'unspecified'}\n`;
    }
    message += `Please directly address these recurring weaknesses in your response.`;
  }

  message += `\n\nDetected module: ${module}. Detected mode: ${essayMode}.`;
  return message;
}

// ─────────────────────────────────────────────────────────────
// Knowledge base helpers
// ─────────────────────────────────────────────────────────────

function getModuleData(module, knowledgeBase) {
  if (!knowledgeBase?.englishModules) return null;
  return knowledgeBase.englishModules[module] || null;
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name: 'essay-structure-coach',
    version: '1.0.0',
    type: 'active',
  },

  /**
   * @param {object} params
   *   - userInput    {string}      — raw student message or draft text
   *   - problem      {string}      — extracted essay question or draft
   *   - module       {string|null} — HSC module code if already known ('common','modA','modB','modC')
   *
   * @param {object} context
   *   - studentId    {string}
   *   - memory       {MemoryManager}
   *   - studentModel {object}       — synthesised Student Model
   *   - model        {ModelManager}
   *   - knowledgeBase {object|null}
   *
   * @returns {Promise<{
   *   result:        string,       — essay structure model or feedback
   *   visualization: null,
   *   module:        string,       — detected or supplied module
   *   essayMode:     string,       — 'model' | 'feedback'
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model, knowledgeBase } = context;
    const { userInput, problem, module: moduleOverride } = params;

    const questionText = problem || userInput || '';

    // ── 1. Classify mode and module ──────────────────────────
    const essayMode = classifyEssayMode(questionText);
    const module    = moduleOverride || classifyModule(questionText);

    // ── 2. Fetch module data from knowledge base ─────────────
    const moduleData = getModuleData(module, knowledgeBase);

    // ── 3. Fetch past structural mistakes ────────────────────
    let pastMistakes = [];
    if (memory) {
      try {
        pastMistakes = memory.getMistakesForSkill(studentId, 'essay-structure-coach');
      } catch { /* proceed without */ }
    }

    // ── 4. Build prompt ──────────────────────────────────────
    const systemPrompt = buildSystemPrompt(studentModel, essayMode, module);
    const userMessage  = buildUserMessage(params, moduleData, pastMistakes, essayMode, module);

    // ── 5. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.5,   // slightly higher than maths — English benefits from varied phrasing
      maxTokens:   1600,
      skillName:   'essay-structure-coach',
      studentId,
    });

    // ── 6. Record attempt in memory ──────────────────────────
    if (memory) {
      try {
        memory.recordAttempt(
          studentId,
          `english.essay-structure.${module}`,
          questionText,
          essayMode === 'feedback' ? 'submitted draft for structure feedback' : 'viewed essay structure model',
          null,
          null,
        );
      } catch { /* non-fatal */ }
    }

    // ── 7. Return result ─────────────────────────────────────
    return {
      result:        response,
      visualization: null,
      module,
      essayMode,
    };
  },
};