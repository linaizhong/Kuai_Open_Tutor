// Skill: cognitive-load-monitor
// Type: passive
// Phase 4 — Watch attempt patterns to detect fatigue or cognitive overload
//
// Responsibility:
//   Runs silently after every interaction. Analyses session-level signals
//   to detect whether the student is in a normal, elevated, or overloaded
//   cognitive state — and writes a recommendation to the Memory Manager
//   for the Coordinator and Adaptive Feedback Engine to act on.
//
// Returns: { memoryUpdates } — no direct output to the student.

'use strict';

// ─────────────────────────────────────────────────────────────
// Constants — tuning thresholds
// ─────────────────────────────────────────────────────────────

// How many consecutive wrong answers triggers an overload signal
const CONSECUTIVE_WRONG_OVERLOAD_THRESHOLD = 3;

// A short response is likely disengagement or fatigue
const SHORT_RESPONSE_CHAR_THRESHOLD = 20;

// Accuracy drop: if session accuracy has fallen this much below the
// student's historical baseline, flag as elevated load
const ACCURACY_DROP_ELEVATED  = 0.20;   // 20 percentage points below baseline
const ACCURACY_DROP_OVERLOADED = 0.40;  // 40 percentage points below baseline

// Mastery regression: if student makes an error on a dot-point where
// their stored mastery is above this threshold, it's a fatigue signal
const MASTERY_REGRESSION_THRESHOLD = 0.75;

// Session length (attempts) beyond which fatigue is plausible
const SESSION_FATIGUE_ATTEMPTS = 20;

// ─────────────────────────────────────────────────────────────
// Signal detectors
// ─────────────────────────────────────────────────────────────

/**
 * Detects a sharp accuracy drop compared to the student's historical baseline.
 *
 * @param {number|null} recentAccuracy   - accuracy over last N attempts (0–1)
 * @param {number|null} historicalAccuracy - overall stored accuracy (0–1)
 * @returns {{ triggered: boolean, severity: "elevated"|"overloaded"|null, detail: string }}
 */
function detectAccuracyDrop(recentAccuracy, historicalAccuracy) {
  if (recentAccuracy === null || historicalAccuracy === null) {
    return { triggered: false, severity: null, detail: '' };
  }

  const drop = historicalAccuracy - recentAccuracy;

  if (drop >= ACCURACY_DROP_OVERLOADED) {
    return {
      triggered: true,
      severity: 'overloaded',
      detail: `Accuracy dropped ${Math.round(drop * 100)}pp below baseline (baseline: ${Math.round(historicalAccuracy * 100)}%, recent: ${Math.round(recentAccuracy * 100)}%)`,
    };
  }

  if (drop >= ACCURACY_DROP_ELEVATED) {
    return {
      triggered: true,
      severity: 'elevated',
      detail: `Accuracy dropped ${Math.round(drop * 100)}pp below baseline (baseline: ${Math.round(historicalAccuracy * 100)}%, recent: ${Math.round(recentAccuracy * 100)}%)`,
    };
  }

  return { triggered: false, severity: null, detail: '' };
}

/**
 * Detects consecutive wrong answers this session.
 *
 * @param {object|null} progress   - progress object from Memory Manager
 * @returns {{ triggered: boolean, count: number }}
 */
function detectConsecutiveWrong(progress) {
  if (!progress?.sessions || progress.sessions.length === 0) {
    return { triggered: false, count: 0 };
  }

  // Get today's attempts in reverse order
  const today = new Date().toISOString().split('T')[0];
  const todaySession = progress.sessions.find(s => s.date === today);
  if (!todaySession?.attempts || todaySession.attempts.length === 0) {
    return { triggered: false, count: 0 };
  }

  let streak = 0;
  const attempts = [...todaySession.attempts].reverse();
  for (const attempt of attempts) {
    if (attempt.isCorrect === false) streak++;
    else break;
  }

  return {
    triggered: streak >= CONSECUTIVE_WRONG_OVERLOAD_THRESHOLD,
    count: streak,
  };
}

/**
 * Detects mastery regression — an error on a previously well-mastered topic.
 *
 * @param {boolean|null} isCorrect      - was the latest attempt correct
 * @param {string|null}  dotPoint       - dot-point of the latest attempt
 * @param {object}       masteryProfile - { dotPointCode: score }
 * @returns {{ triggered: boolean, dotPoint: string|null, storedMastery: number|null }}
 */
function detectMasteryRegression(isCorrect, dotPoint, masteryProfile) {
  if (isCorrect !== false || !dotPoint || !masteryProfile) {
    return { triggered: false, dotPoint: null, storedMastery: null };
  }

  const storedMastery = masteryProfile[dotPoint] ?? null;
  if (storedMastery !== null && storedMastery >= MASTERY_REGRESSION_THRESHOLD) {
    return {
      triggered: true,
      dotPoint,
      storedMastery,
    };
  }

  return { triggered: false, dotPoint: null, storedMastery: null };
}

/**
 * Detects a very short student response (likely disengagement or fatigue).
 *
 * @param {string} userInput
 * @returns {{ triggered: boolean, length: number }}
 */
function detectShortResponse(userInput) {
  if (!userInput) return { triggered: false, length: 0 };
  const trimmed = userInput.trim();
  return {
    triggered: trimmed.length > 0 && trimmed.length < SHORT_RESPONSE_CHAR_THRESHOLD,
    length: trimmed.length,
  };
}

/**
 * Detects session length fatigue.
 *
 * @param {number} sessionAttempts
 * @returns {{ triggered: boolean }}
 */
function detectSessionFatigue(sessionAttempts) {
  return { triggered: sessionAttempts >= SESSION_FATIGUE_ATTEMPTS };
}

// ─────────────────────────────────────────────────────────────
// Load level decision
// ─────────────────────────────────────────────────────────────

/**
 * Aggregates all signals into a single load level and recommendation.
 *
 * @param {object} signals
 * @returns {{ loadLevel: string, recommendation: string, reasons: string[] }}
 */
function computeLoadLevel(signals) {
  const reasons = [];
  let maxSeverity = 'normal';  // normal → elevated → overloaded

  const levels = { normal: 0, elevated: 1, overloaded: 2 };

  function escalate(level, reason) {
    if (levels[level] > levels[maxSeverity]) maxSeverity = level;
    if (reason) reasons.push(reason);
  }

  // Accuracy drop
  if (signals.accuracyDrop.triggered) {
    escalate(signals.accuracyDrop.severity, signals.accuracyDrop.detail);
  }

  // Consecutive wrong answers
  if (signals.consecutiveWrong.triggered) {
    escalate('overloaded', `${signals.consecutiveWrong.count} consecutive wrong answers`);
  }

  // Mastery regression
  if (signals.masteryRegression.triggered) {
    escalate('elevated', `Error on previously mastered topic (${signals.masteryRegression.dotPoint}, mastery: ${Math.round((signals.masteryRegression.storedMastery || 0) * 100)}%)`);
  }

  // Short response
  if (signals.shortResponse.triggered) {
    escalate('elevated', `Very short student response (${signals.shortResponse.length} chars) — possible disengagement`);
  }

  // Session length fatigue
  if (signals.sessionFatigue.triggered) {
    escalate('elevated', `Session length fatigue (${signals.sessionAttempts} attempts)`);
  }

  // Map load level to recommendation
  let recommendation = 'continue';
  if (maxSeverity === 'elevated')   recommendation = 'simplify';
  if (maxSeverity === 'overloaded') recommendation = 'break';

  return { loadLevel: maxSeverity, recommendation, reasons };
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name: 'cognitive-load-monitor',
    version: '1.0.0',
    type: 'passive',
  },

  /**
   * @param {object} params
   *   - userInput         {string}        — student's raw message this turn
   *   - response          {string}        — OpenTutor's response this turn
   *   - isCorrect         {boolean|null}  — was the attempt correct (null if not a graded attempt)
   *   - dotPoint          {string|null}   — dot-point of the current attempt
   *   - sessionAttempts   {number}        — total attempts this session
   *   - recentAccuracy    {number|null}   — accuracy over last 5 attempts (0–1)
   *
   * @param {object} context
   *   - studentId      {string}
   *   - memory         {MemoryManager}
   *   - studentModel   {object}
   *   - model          {ModelManager}    — NOT used (passive skills never call the LLM)
   *   - knowledgeBase  {object|null}
   *
   * @returns {{ memoryUpdates: object }}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel } = context;
    const {
      userInput       = '',
      isCorrect       = null,
      dotPoint        = null,
      sessionAttempts = 0,
      recentAccuracy  = null,
    } = params;

    // ── 1. Gather data ───────────────────────────────────────
    const masteryProfile    = studentModel?.masteryProfile || {};
    const historicalAccuracy = memory
      ? (() => { try { return memory.getOverallAccuracy(studentId); } catch { return null; } })()
      : null;

    const progress = memory
      ? (() => { try { return memory.getProgress(studentId); } catch { return null; } })()
      : null;

    // ── 2. Run all signal detectors ──────────────────────────
    const signals = {
      accuracyDrop:      detectAccuracyDrop(recentAccuracy, historicalAccuracy),
      consecutiveWrong:  detectConsecutiveWrong(progress),
      masteryRegression: detectMasteryRegression(isCorrect, dotPoint, masteryProfile),
      shortResponse:     detectShortResponse(userInput),
      sessionFatigue:    detectSessionFatigue(sessionAttempts),
      sessionAttempts,
    };

    // ── 3. Compute overall load level ────────────────────────
    const { loadLevel, recommendation, reasons } = computeLoadLevel(signals);

    // ── 4. Return memoryUpdates ──────────────────────────────
    // The Coordinator reads this and may pass it to the Adaptive Feedback Engine.
    // The affective-history passive skill handles emotional state separately —
    // this skill is specifically about *cognitive* capacity, not emotion.
    return {
      memoryUpdates: {
        type: 'cognitiveLoad',
        signal: {
          loadLevel,            // "normal" | "elevated" | "overloaded"
          recommendation,       // "continue" | "simplify" | "break"
          reasons,              // string[] — for logging/debugging
          sessionAttempts,
          recentAccuracy,
          timestamp: new Date().toISOString(),
        },
      },
    };
  },
};