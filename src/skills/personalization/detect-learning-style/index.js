// Skill: detect-learning-style
// Type: passive
// Phase 4 — Observe interactions and update learning style preferences silently.
//
// This skill runs automatically after every interaction. It produces no
// visible output to the student. Instead it writes incremental signals to
// learning-style.json via memoryUpdates so the Student Model Module can
// infer and maintain an accurate learning style profile over time.

'use strict';

// ── Signal weights ────────────────────────────────────────────
// How strongly each detected signal shifts the running preference score.
const WEIGHT_STRONG   = 3;   // explicit request ("show me a graph")
const WEIGHT_MODERATE = 2;   // implicit preference ("can you use numbers")
const WEIGHT_WEAK     = 1;   // positive engagement after a representation
const WEIGHT_NEGATIVE = -2;  // expressed confusion after a representation

// Decay applied to all existing scores each observation, so recent
// behaviour gradually outweighs older patterns.
const DECAY_FACTOR    = 0.96;

// Minimum observations before a preference is considered reliable enough
// for the Student Model to act on it.
const MIN_RELIABLE_OBSERVATIONS = 6;

// ── Keyword signal maps ───────────────────────────────────────
// Each entry: { pattern: RegExp, representation: string, weight: number }
const INPUT_SIGNALS = [
  // ── Visual signals ──────────────────────────────────────
  { pattern: /\b(graph|plot|draw|diagram|sketch|picture|visual|show me|can you show|axes|curve|chart)\b/i,
    representation: 'visual',   weight: WEIGHT_STRONG },
  { pattern: /\b(what does .{0,20} look like|visually|geometrically|geometrical)\b/i,
    representation: 'visual',   weight: WEIGHT_MODERATE },

  // ── Algebraic signals ────────────────────────────────────
  { pattern: /\b(formula|equation|algebraically|algebraic|expression|the rule|derive|proof|prove|differentiate|integrate|expand|factorise|factorize)\b/i,
    representation: 'algebraic', weight: WEIGHT_STRONG },
  { pattern: /\b(in terms of|general form|general case|algebraic form|symbolically)\b/i,
    representation: 'algebraic', weight: WEIGHT_MODERATE },

  // ── Numerical signals ────────────────────────────────────
  { pattern: /\b(example|for example|with numbers|specific (numbers?|values?|case)|try with|plug in|substitute|let x =|if x =|concrete)\b/i,
    representation: 'numerical', weight: WEIGHT_STRONG },
  { pattern: /\b(calculate|compute|work out|evaluate|find the value|numerically)\b/i,
    representation: 'numerical', weight: WEIGHT_MODERATE },
];

// Patterns in the *response* that indicate which representation was used
const RESPONSE_SIGNALS = [
  { pattern: /\b(graph|plot|diagram|sketch|axes|curve|figure|the curve|visually)\b/i,  representation: 'visual'    },
  { pattern: /\b(formula|equation|let [a-z] =|d\/dx|∫|∑|therefore|hence|proof)\b/i,    representation: 'algebraic' },
  { pattern: /\b(for example|substitut|let x =|numerically|= \d|calculate|try x =)\b/i, representation: 'numerical' },
];

// Phrases indicating student confusion or disengagement in their follow-up input
const CONFUSION_PATTERNS = /\b(i (don't|do not|still don't) (understand|get it)|confus|unclear|lost|what does that mean|i'm not sure|huh\?|not following|doesn't make sense|makes no sense)\b/i;

// Phrases indicating student success or positive engagement
const SUCCESS_PATTERNS = /\b(i (get it|understand now|see now|got it)|that makes sense|oh (i see|right|ok)|that helps|clear(er)?|perfect|got it|thanks?[.!]?$)\b/i;


// ── Detect which representation the response used ─────────────
function detectResponseRepresentation(responseText) {
  if (!responseText) return null;
  const counts = { visual: 0, algebraic: 0, numerical: 0 };
  for (const signal of RESPONSE_SIGNALS) {
    const matches = responseText.match(new RegExp(signal.pattern, 'gi'));
    if (matches) counts[signal.representation] += matches.length;
  }
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return dominant[1] > 0 ? dominant[0] : null;
}

// ── Analyse the student's input for explicit preference signals ──
function analyseInputSignals(userInput) {
  if (!userInput) return [];
  const detected = [];
  for (const signal of INPUT_SIGNALS) {
    if (signal.pattern.test(userInput)) {
      detected.push({ representation: signal.representation, weight: signal.weight, source: 'input' });
    }
  }
  return detected;
}

// ── Infer engagement signals from isCorrect + representationUsed ─
function inferEngagementSignals(isCorrect, representationUsed, userInput) {
  const signals = [];
  if (!representationUsed) return signals;

  if (isCorrect === true) {
    // Student got it right after this representation → weak positive signal
    signals.push({ representation: representationUsed, weight: WEIGHT_WEAK, source: 'correct_answer' });
  }

  if (isCorrect === false && CONFUSION_PATTERNS.test(userInput || '')) {
    // Student expressed confusion after this representation → negative signal
    signals.push({ representation: representationUsed, weight: WEIGHT_NEGATIVE, source: 'confusion' });
  }

  // Positive follow-up language after a representation → moderate positive
  if (SUCCESS_PATTERNS.test(userInput || '') && isCorrect !== false) {
    signals.push({ representation: representationUsed, weight: WEIGHT_MODERATE, source: 'positive_feedback' });
  }

  return signals;
}

// ── Identify what the student responds well to (topic-agnostic) ──
function detectRespondsWellTo(userInput, skillUsed, isCorrect) {
  const tags = new Set();

  if (skillUsed === 'hsc-worked-example' && isCorrect === true) {
    tags.add('worked examples');
  }
  if (skillUsed === 'socratic-questioning' && isCorrect === true) {
    tags.add('guided discovery');
  }
  if (skillUsed === 'hint-scaffolding' && isCorrect === true) {
    tags.add('hints');
  }
  if (/\b(analogy|like|similar to|imagine|think of it as)\b/i.test(userInput || '')) {
    tags.add('analogies');
  }
  if (/\b(step.?by.?step|one step|slowly|break it down|step \d)\b/i.test(userInput || '')) {
    tags.add('step-by-step');
  }

  return [...tags];
}

function detectStrugglesWith(userInput, skillUsed, isCorrect) {
  const tags = new Set();

  if (/\b(notation|symbols?|symboli[cs]|abstract)\b/i.test(userInput || '') && isCorrect === false) {
    tags.add('abstract notation');
  }
  if (skillUsed === 'socratic-questioning' && isCorrect === false) {
    tags.add('open-ended questions');
  }

  return [...tags];
}

// ── Apply decay and update scores ─────────────────────────────
function applySignalsToScores(existingScores, signals) {
  // Start from existing scores, applying decay
  const scores = {
    visual:    (existingScores.visual    || 0) * DECAY_FACTOR,
    algebraic: (existingScores.algebraic || 0) * DECAY_FACTOR,
    numerical: (existingScores.numerical || 0) * DECAY_FACTOR,
  };

  // Accumulate new signals
  for (const signal of signals) {
    if (scores[signal.representation] !== undefined) {
      scores[signal.representation] += signal.weight;
    }
  }

  return scores;
}

// ── Derive the preferred representation from scores ───────────
function derivePreference(scores, observationCount) {
  if (observationCount < MIN_RELIABLE_OBSERVATIONS) return null;

  const entries = Object.entries(scores).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;

  const max = Math.max(...entries.map(([, v]) => v));
  if (max <= 0) return null;

  // Only assert a preference if one representation is clearly dominant
  // (at least 30% more than the second-highest)
  entries.sort((a, b) => b[1] - a[1]);
  if (entries.length >= 2 && (entries[0][1] - entries[1][1]) / max < 0.3) {
    return null; // Too ambiguous to assert a preference yet
  }

  return entries[0][0];
}

// ── Merge tag arrays, capping at 5 items ─────────────────────
function mergeTags(existing, additions, removals = []) {
  const merged = new Set([...(existing || []), ...additions]);
  removals.forEach(r => merged.delete(r));
  return [...merged].slice(0, 5);
}


// ═════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════
module.exports = {
  meta: {
    name: 'detect-learning-style',
    version: '1.0.0',
    type: 'passive',
  },

  execute: async function (params, context) {
    // ── 1. Extract inputs ──────────────────────────────────
    const {
      userInput   = '',
      response    = '',
      skillUsed   = null,
      isCorrect   = null,   // true | false | null (unknown)
    } = params || {};

    const { memory } = context || {};

    // ── 2. Load current learning style state ──────────────
    const current = (memory?.learningStyle) || {
      preferredRepresentation: null,
      respondsWellTo:  [],
      strugglesWith:   [],
      observationCount: 0,
      scores: { visual: 0, algebraic: 0, numerical: 0 },
      lastUpdated: null,
    };

    // Ensure scores sub-object exists (backward compat)
    const currentScores = current.scores || { visual: 0, algebraic: 0, numerical: 0 };
    const observationCount = (current.observationCount || 0) + 1;

    // ── 3. Detect representation used in the response ─────
    const representationUsed = detectResponseRepresentation(response);

    // ── 4. Collect all signals for this interaction ───────
    const inputSignals      = analyseInputSignals(userInput);
    const engagementSignals = inferEngagementSignals(isCorrect, representationUsed, userInput);
    const allSignals        = [...inputSignals, ...engagementSignals];

    // ── 5. Update running scores ───────────────────────────
    const updatedScores = applySignalsToScores(currentScores, allSignals);

    // ── 6. Derive new preference (may still be null) ───────
    const newPreference = derivePreference(updatedScores, observationCount);

    // ── 7. Update respondsWellTo / strugglesWith lists ─────
    const newRespondsWellTo = detectRespondsWellTo(userInput, skillUsed, isCorrect);
    const newStrugglesWith  = detectStrugglesWith(userInput, skillUsed, isCorrect);

    // When a student shows confusion with a representation, remove it
    // from respondsWellTo if it was previously listed there
    const representationsToRemove = engagementSignals
      .filter(s => s.weight < 0)
      .map(s => s.representation);

    const updatedRespondsWellTo = mergeTags(
      current.respondsWellTo,
      newRespondsWellTo,
      representationsToRemove
    );
    const updatedStrugglesWith = mergeTags(
      current.strugglesWith,
      newStrugglesWith
    );

    // ── 8. Build the updated learning style object ─────────
    const updatedLearningStyle = {
      preferredRepresentation: newPreference ?? current.preferredRepresentation,
      respondsWellTo:   updatedRespondsWellTo,
      strugglesWith:    updatedStrugglesWith,
      observationCount,
      scores:           updatedScores,
      lastUpdated:      new Date().toISOString().slice(0, 10),

      // Expose signal detail for debugging / the Student Model to inspect
      _lastSignals: allSignals.map(s => ({
        representation: s.representation,
        weight: s.weight,
        source: s.source,
      })),
    };

    // ── 9. Return memoryUpdates (passive skill contract) ───
    return {
      memoryUpdates: {
        type:  'learningStyle',
        value: updatedLearningStyle,
        signal: {
          preferredRepresentation: updatedLearningStyle.preferredRepresentation,
          respondsWellTo:          updatedLearningStyle.respondsWellTo,
          strugglesWith:           updatedLearningStyle.strugglesWith,
        },
      },
    };
  },
};