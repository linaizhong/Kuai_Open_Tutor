// Skill: engagement-tracker
// Type: passive
// Phase 4 — Monitor session signals and update affective state in memory
//
// Responsibility:
//   Silently observes engagement signals after every interaction:
//     - Response length (shorter = disengaging)
//     - Recent success rate (high = confident/focused, low = frustrated)
//     - Negative emotion keywords in the student's message
//     - Consecutive "I don't know" / skip patterns
//     - Long session with sustained accuracy (flow state)
//
//   Produces a memoryUpdates payload for the Coordinator to write back
//   to the Memory Manager. Never produces any output to the student.

'use strict';

// ─────────────────────────────────────────────────────────────
// Signal detection helpers
// ─────────────────────────────────────────────────────────────

const FRUSTRATION_KEYWORDS = [
  "don't understand", "i give up", "this is too hard", "i can't",
  "i hate", "so confused", "hopeless", "i'm lost", "makes no sense",
  "useless", "why is this so hard", "i'm terrible", "i suck",
  "this is impossible", "forget it", "whatever", "i quit",
];

const DISENGAGEMENT_KEYWORDS = [
  "i don't know", "idk", "no idea", "skip", "next", "can we move on",
  "not sure", "pass", "i have no idea", "just tell me",
];

const FLOW_MIN_ATTEMPTS      = 10;   // minimum attempts before flow is detectable
const FLOW_MIN_ACCURACY      = 0.80; // accuracy threshold for flow state
const FRUSTRATED_MAX_ACCURACY = 0.30; // below this → frustrated signal
const CONFIDENT_MIN_ACCURACY  = 0.75; // above this → confident signal
const SHORT_RESPONSE_CHARS    = 15;  // very short student inputs suggest disengagement

/**
 * Detects negative emotion keywords in the student's message.
 * @param {string} input  — lowercased
 * @returns {'frustrated'|'disengaged'|null}
 */
function detectEmotionKeywords(input) {
  const lower = input.toLowerCase();
  if (FRUSTRATION_KEYWORDS.some(kw => lower.includes(kw))) return 'frustrated';
  if (DISENGAGEMENT_KEYWORDS.some(kw => lower.includes(kw))) return 'disengaged';
  return null;
}

/**
 * Derives an engagement signal from session-level accuracy and attempts.
 *
 * Priority:
 *   1. Explicit emotion keyword → trust it directly
 *   2. Very short input → disengaged signal
 *   3. High accuracy + many attempts → confident / in-flow
 *   4. Low accuracy → frustrated
 *   5. Moderate accuracy → focused (no update needed — stable state)
 *
 * @param {object} params
 *   - userInput        {string}
 *   - recentAccuracy   {number|null}
 *   - sessionAttempts  {number}
 * @returns {{ engagement: string, reason: string }|null}  null = no update
 */
function deriveEngagementSignal(params) {
  const { userInput = '', recentAccuracy, sessionAttempts = 0 } = params;

  // 1. Explicit emotion keyword
  const keyword = detectEmotionKeywords(userInput);
  if (keyword) {
    return {
      engagement: keyword,
      reason:     `Detected emotion keyword in message: "${userInput.slice(0, 60)}"`,
    };
  }

  // 2. Very short input (e.g. "ok", "no", "idk") — may indicate disengagement
  if (userInput.trim().length > 0 && userInput.trim().length <= SHORT_RESPONSE_CHARS) {
    return {
      engagement: 'disengaged',
      reason:     `Very short input (${userInput.trim().length} chars) — possible disengagement`,
    };
  }

  // 3. Flow state: sustained high accuracy over many attempts
  if (
    sessionAttempts >= FLOW_MIN_ATTEMPTS &&
    recentAccuracy !== null &&
    recentAccuracy >= FLOW_MIN_ACCURACY
  ) {
    return {
      engagement: 'confident',
      reason:     `Flow state: ${sessionAttempts} attempts at ${(recentAccuracy * 100).toFixed(0)}% accuracy`,
    };
  }

  // 4. Low accuracy → frustrated
  if (recentAccuracy !== null && recentAccuracy <= FRUSTRATED_MAX_ACCURACY && sessionAttempts >= 3) {
    return {
      engagement: 'frustrated',
      reason:     `Low accuracy: ${(recentAccuracy * 100).toFixed(0)}% over ${sessionAttempts} attempts`,
    };
  }

  // 5. Good accuracy → confident
  if (recentAccuracy !== null && recentAccuracy >= CONFIDENT_MIN_ACCURACY && sessionAttempts >= 3) {
    return {
      engagement: 'confident',
      reason:     `Good accuracy: ${(recentAccuracy * 100).toFixed(0)}% over ${sessionAttempts} attempts`,
    };
  }

  // No strong signal — don't update
  return null;
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name:    'engagement-tracker',
    version: '1.0.0',
    type:    'passive',
  },

  /**
   * @param {object} params
   *   - userInput       {string}        — raw student message
   *   - response        {string}        — tutor's response (unused here)
   *   - isCorrect       {boolean|null}  — whether last attempt was correct
   *   - sessionAttempts {number}        — total attempts this session
   *   - recentAccuracy  {number|null}   — accuracy ratio this session (0–1)
   *
   * @param {object} context
   *   - studentId, memory, studentModel, model, knowledgeBase
   *
   * @returns {{ memoryUpdates: object|null }}
   */
  execute: async function (params, context) {
    const { userInput = '', recentAccuracy = null, sessionAttempts = 0 } = params;

    const signal = deriveEngagementSignal({ userInput, recentAccuracy, sessionAttempts });

    if (!signal) {
      // No update needed — affective state is stable
      return { result: null, visualization: null, syllabusPoint: null };
    }

    return {
      result:        null,
      visualization: null,
      syllabusPoint: null,
      memoryUpdates: {
        type:   'affectiveState',
        signal: {
          engagement:      signal.engagement,
          sessionAttempts,
          recentAccuracy,
          notes:           signal.reason,
          source:          'engagement-tracker',
          timestamp:       new Date().toISOString(),
        },
      },
    };
  },
};