// Skill: creative-writing-coach
// Type: active
// Phase 1 — HSC English creative writing guidance and feedback
//
// Responsibility:
//   Supports students with the creative writing component of HSC English Advanced.
//   Covers Paper 1 Section III (Extended Response — creative) and Module C
//   (The Craft of Writing). Handles three distinct modes:
//     - GENERATE: produce a model creative piece or opening for a given stimulus
//     - FEEDBACK: diagnose and improve a student's own creative draft
//     - TECHNIQUE: teach a specific craft technique (voice, structure, imagery, etc.)
//
//   Unlike other English skills, this skill must balance creative quality
//   WITH HSC-specific requirements: the writing must demonstrate craft
//   awareness and be readable as a "statement of intention" response.
//
//   Personalises depth and tone using the Student Model.

'use strict';

// ─────────────────────────────────────────────────────────────
// Mode classifier
// ─────────────────────────────────────────────────────────────

/**
 * Detects the creative writing task mode.
 * Returns: 'generate' | 'feedback' | 'technique'
 */
function classifyCreativeMode(input) {
  const t = input.toLowerCase();
  if (
    /my story|my piece|my writing|my draft|my creative|i wrote|here is my|check my|feedback on|improve my|mark my|fix my|what's wrong|is this good/i.test(t)
  ) return 'feedback';
  if (
    /how do i|how to write|teach me|explain.*technique|what is.*voice|what is.*structure|narrative technique|creative technique|craft technique/i.test(t)
  ) return 'technique';
  return 'generate';
}

/**
 * Detects the creative form requested or present in the draft.
 * Returns: 'short-story' | 'memoir' | 'speech' | 'poetry' | 'hybrid' | 'general'
 */
function classifyCreativeForm(input) {
  const t = input.toLowerCase();
  if (/poem|poetry|verse|stanza|lyric/i.test(t))                          return 'poetry';
  if (/speech|address|monologue|first person.*speak/i.test(t))            return 'speech';
  if (/memoir|personal narrative|autobiograph|true story|real experience/i.test(t)) return 'memoir';
  if (/hybrid|multimodal|mixed form|experimental/i.test(t))               return 'hybrid';
  return 'short-story';
}

/**
 * Detects the Module C stimulus type if present.
 * Returns: 'image' | 'quote' | 'word' | 'phrase' | 'concept' | 'general'
 */
function classifyStimulusType(input) {
  const t = input.toLowerCase();
  if (/image|photo|picture|painting|artwork/i.test(t))   return 'image';
  if (/quote|".*"/i.test(t))                             return 'quote';
  if (/single word|one word/i.test(t))                   return 'word';
  return 'concept';
}

// ─────────────────────────────────────────────────────────────
// Craft technique bank (used to enrich prompts)
// ─────────────────────────────────────────────────────────────

const CRAFT_TECHNIQUES = {
  openings:   ['in medias res', 'sensory immersion', 'dialogue hook', 'provocative statement', 'image-centred opening'],
  voice:      ['first person intimate', 'second person direct address', 'unreliable narrator', 'free indirect discourse', 'stream of consciousness'],
  structure:  ['non-linear timeline', 'frame narrative', 'circular structure', 'vignette structure', 'parallel storylines'],
  endings:    ['resonant image', 'return to opening motif', 'ambiguous close', 'explicit resolution', 'tonal shift'],
  imagery:    ['extended metaphor', 'sensory layering', 'pathetic fallacy', 'symbolic object', 'motif threading'],
  pace:       ['short sentence urgency', 'long sentence immersion', 'white space', 'sentence fragments', 'paragraph breaks as beats'],
};

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(studentModel, creativeMode, creativeForm, stimulusType) {
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';
  const engagement = studentModel?.affectiveState?.currentEngagement      || 'focused';

  let toneInstruction = 'Be encouraging but specific. Creative feedback must point to exact lines, not general impressions.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is frustrated with their creative work. Open with genuine appreciation of what is working. Give one small, achievable improvement only.';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Push for greater craft sophistication — challenge them on voice consistency, structural risk, and the depth of their central image.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student is tired. Give one concrete model sentence or opening they can use immediately. Keep explanation minimal.';
  }

  let formatInstruction = 'Show model text with brief inline annotations explaining the craft choice.';
  if (style === 'visual') {
    formatInstruction = 'Lead with a visual or structural diagram of the piece (e.g. timeline, image-to-idea map), then show the model text.';
  } else if (style === 'numerical') {
    formatInstruction = 'Use a numbered craft checklist. For each item: show the technique, a weak example, and a strong example side by side.';
  }

  // Form-specific craft requirements
  const formGuide = {
    'short-story': `
FORM: Short Story / Narrative
HSC requirements for this form:
- A compelling opening that establishes voice, setting, or conflict within the first 3 sentences.
- A clear central tension or moment of change — the story must "turn" somewhere.
- Restraint: in 600-800 words, every sentence must earn its place. No padding.
- The ending must resonate — not resolve neatly, but leave the reader with something.
- Avoid: coincidental resolutions, on-the-nose dialogue, telling emotions rather than showing them.
Key craft moves: in medias res openings, concrete sensory detail, significant objects, tonal control.`,

    'memoir': `
FORM: Personal Narrative / Memoir
HSC requirements for this form:
- Specific, concrete memory — not a general account but one vivid moment.
- The "I" narrator must be reflective: the piece explores what the experience MEANT, not just what happened.
- Precise sensory detail distinguishes memoir from summary.
- The ending should offer insight or a shift in understanding, not closure.
- Avoid: sentimentality, over-explaining the meaning (show the insight through image), generic emotional language.
Key craft moves: present-tense immediacy, sensory anchoring, reflective distance, the "double perspective" (then and now).`,

    'speech': `
FORM: Speech / Monologue
HSC requirements for this form:
- A strong, consistent voice throughout — the reader must hear a distinct person.
- Rhetorical devices used with purpose: repetition, direct address, rhetorical questions.
- Structural rhythm: the speech should build — not stay at the same register throughout.
- A memorable closing line or image.
- Avoid: generic inspirational speech clichés, lists without rhythm, a voice that sounds like an essay.
Key craft moves: anaphora, direct address, tonal modulation, concrete anecdote embedded in the speech.`,

    'poetry': `
FORM: Poetry
HSC requirements for this form:
- Every word must be deliberately chosen — poetry tolerates no filler.
- Line breaks carry meaning: enjambment creates tension; end-stopped lines create weight.
- Sound devices (assonance, sibilance, rhythm) should reinforce the emotional content.
- The image must do the conceptual work — resist explaining the poem.
- Avoid: forced rhyme that distorts meaning, clichéd imagery (tears like rain, heart like stone), abstract openings.
Key craft moves: concrete central image, line break as punctuation, sonic texture, white space as silence.`,

    'hybrid': `
FORM: Hybrid / Experimental
HSC requirements for this form:
- The form choice must be motivated — mixing forms should create meaning, not just novelty.
- The Statement of Intention must explain the craft rationale clearly.
- Coherence: even experimental work must be readable and purposeful.
- Avoid: mixing forms arbitrarily, losing narrative thread in pursuit of experimentation.
Key craft moves: contrast between forms, the seam where forms meet as a site of meaning, consistent thematic thread.`,

    'general': `
FORM: General Creative Writing
- Establish voice, setting, and tension early.
- Every craft choice must be purposeful and explainable.
- The ending must earn its place — avoid both abrupt stops and over-resolved endings.
- The piece must be readable as a response to the stimulus, even if obliquely.`,
  };

  // Mode-specific task instructions
  const modeGuide = {
    generate: `
YOUR TASK — GENERATE A MODEL CREATIVE PIECE:
1. Write a high-quality opening (first 150-200 words) for a creative piece responding to the given stimulus.
2. After the opening, write a brief CRAFT ANNOTATION (50 words max) explaining the key decisions made:
   - Form chosen and why
   - Voice and why
   - Opening technique used (e.g. in medias res, sensory immersion)
   - Central image or motif being established
3. Then sketch the arc: suggest how the rest of the piece might develop (3-4 dot points only).
4. Offer 2 alternative opening approaches (one sentence each) so the student sees options.

⚠️ HSC NOTE: Do NOT write a complete 800-word story. The student must write their own. Model the opening and the craft logic, then hand it back.`,

    feedback: `
YOUR TASK — CREATIVE DRAFT FEEDBACK:
1. Identify ONE strength in the draft — quote the specific line or phrase that works best and explain why.
2. Identify the single highest-priority weakness. Be precise: quote the exact passage, name the craft problem (e.g. "telling not showing", "voice inconsistency", "weak ending"), explain why it costs marks.
3. Rewrite that specific passage to show what it could be.
4. Give a CRAFT CHECKLIST for self-revision:
   - Opening: does it establish voice and tension within 3 sentences?
   - Central turn: is there a clear moment of change or realisation?
   - Sensory detail: is there at least one specific, concrete image?
   - Ending: does it resonate without over-explaining?
5. Give ONE stretch challenge — a higher-order craft move they could attempt if they want Band 6.`,

    technique: `
YOUR TASK — TEACH A CRAFT TECHNIQUE:
1. Define the technique in one precise sentence.
2. Show a WEAK example (what students often do) and a STRONG example side by side.
3. Explain the EFFECT the strong version creates and why.
4. Give a practical exercise: a one-sentence writing prompt the student can attempt right now to practise the technique.
5. Name one published HSC text or well-known author known for this technique.`,
  };

  const formInstruction = formGuide[creativeForm] || formGuide['general'];
  const modeInstruction = modeGuide[creativeMode] || modeGuide['generate'];

  return `You are OpenTutor — an expert HSC English Advanced creative writing coach for Australian Year 11/12 students.

${modeInstruction}

${formInstruction}

STRICT REQUIREMENTS:
- All model text must demonstrate genuine literary craft — not generic "student essay" prose.
- Never use clichéd openings: "It was a dark and stormy night", "I never thought this would happen to me", etc.
- Feedback must quote specific lines — never give general impressions.
- Always distinguish between CONTENT (what is said) and CRAFT (how it is said). HSC marks the craft.
- The Statement of Intention / reflection is a separate task — this skill focuses on the creative piece itself.
- Do NOT write a complete creative piece. Model targeted components.

TONE: ${toneInstruction}
FORMAT: ${formatInstruction}

End with a "Craft Watchword:" — a single instruction the student should pin above their desk when writing this piece (e.g. "Earn every sentence." / "Show the feeling through the object." / "Your ending is your argument.").`;
}

function buildUserMessage(params, pastMistakes, creativeMode, creativeForm, stimulusType) {
  const { userInput, problem } = params;
  const questionText = problem || userInput;

  const modeLabel = {
    generate: 'Please help me write a creative piece for the following HSC stimulus or task',
    feedback: 'Please give me feedback on my HSC creative writing draft',
    technique: 'Please teach me the following creative writing technique',
  };

  let message = `${modeLabel[creativeMode] || modeLabel['generate']}:\n\n${questionText}`;
  message += `\n\nDetected form: ${creativeForm}. Detected stimulus type: ${stimulusType}. Mode: ${creativeMode}.`;

  if (pastMistakes && pastMistakes.length > 0) {
    const recent = pastMistakes.slice(-2);
    message += `\nThis student has previously struggled with the following creative writing issues:\n`;
    for (const m of recent) {
      message += `- ${m.errorType || 'craft'} issue: ${m.notes || m.problem || 'unspecified'}\n`;
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
    name: 'creative-writing-coach',
    version: '1.0.0',
    type: 'active',
  },

  /**
   * @param {object} params
   *   - userInput      {string}      — raw student message or draft text
   *   - problem        {string}      — extracted stimulus or draft
   *   - creativeForm   {string|null} — 'short-story'|'memoir'|'speech'|'poetry'|'hybrid'
   *
   * @param {object} context
   *   - studentId      {string}
   *   - memory         {MemoryManager}
   *   - studentModel   {object}
   *   - model          {ModelManager}
   *   - knowledgeBase  {object|null}
   *
   * @returns {Promise<{
   *   result:        string,
   *   visualization: null,
   *   creativeMode:  string,
   *   creativeForm:  string,
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model } = context;
    const { userInput, problem, creativeForm: formOverride } = params;

    const questionText = problem || userInput || '';

    // ── 1. Classify mode, form and stimulus ─────────────────
    const creativeMode   = classifyCreativeMode(questionText);
    const creativeForm   = formOverride || classifyCreativeForm(questionText);
    const stimulusType   = classifyStimulusType(questionText);

    // ── 2. Fetch past creative mistakes ──────────────────────
    let pastMistakes = [];
    if (memory) {
      try {
        pastMistakes = memory.getMistakesForSkill(studentId, 'creative-writing-coach');
      } catch { /* proceed without */ }
    }

    // ── 3. Build prompt ──────────────────────────────────────
    const systemPrompt = buildSystemPrompt(studentModel, creativeMode, creativeForm, stimulusType);
    const userMessage  = buildUserMessage(params, pastMistakes, creativeMode, creativeForm, stimulusType);

    // ── 4. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.7,   // higher — creative tasks benefit from varied, imaginative output
      maxTokens:   1500,
      skillName:   'creative-writing-coach',
      studentId,
    });

    // ── 5. Record attempt ────────────────────────────────────
    if (memory) {
      try {
        memory.recordAttempt(
          studentId,
          `english.creative.${creativeForm}`,
          questionText,
          `creative mode: ${creativeMode}`,
          null,
          null,
        );
      } catch { /* non-fatal */ }
    }

    // ── 6. Return ────────────────────────────────────────────
    return {
      result:      response,
      visualization: null,
      creativeMode,
      creativeForm,
    };
  },
};