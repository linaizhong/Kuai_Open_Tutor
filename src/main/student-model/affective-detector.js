// student-model/affective-detector.js
//
// Responsibility:
//   Detects the student's current emotional/engagement state by synthesising
//   signals from three sources:
//     1. affective-history.json  — signals written by engagement-tracker (passive)
//     2. session stats           — recent accuracy and attempt count
//     3. cognitive load signal   — latest load level from cognitive-load-monitor
//
//   Output engagement states:
//     "focused"     — on task, normal progress
//     "confident"   — high accuracy, in flow
//     "frustrated"  — low accuracy, repeated errors or explicit frustration signals
//     "fatigued"    — long session, dropping accuracy, short responses
//     "disengaged"  — very short responses, skipping, low effort
//
//   The detector uses a priority-weighted fusion: the most recent explicit signal
//   wins if it was recorded in this session; otherwise falls back to derived signals
//   from session stats.

'use strict';

// Session stats thresholds for derived state
const HIGH_ACCURACY_THRESHOLD  = 0.75;
const LOW_ACCURACY_THRESHOLD   = 0.40;
const FATIGUE_ATTEMPTS_THRESHOLD = 18;

// How many recent affective history entries to consider "current session"
const RECENT_SIGNAL_WINDOW = 5;

/**
 * Detects current affective state from raw memory and session data.
 *
 * @param {object} affectiveHistory   — raw data from memory.getContext().affectiveHistory
 * @param {object} progressData       — raw data from memory.getContext().progress
 * @param {object} sessionStats       — { sessionAttempts, recentAccuracy } from Coordinator
 * @returns {object}
 */
function detect(affectiveHistory, progressData, sessionStats) {
  const history  = affectiveHistory?.history || [];
  const dominant = affectiveHistory?.dominantState || null;

  const sessionAttempts  = sessionStats?.sessionAttempts  ?? 0;
  const recentAccuracy   = sessionStats?.recentAccuracy   ?? null;
  const recentSuccessRate = recentAccuracy;

  // ── 1. Most recent explicit signal ───────────────────────
  // The engagement-tracker passive skill writes signals with a timestamp.
  // Take the most recent N signals from this session.
  const recentSignals = history.slice(-RECENT_SIGNAL_WINDOW);
  const latestExplicit = recentSignals.length > 0
    ? recentSignals[recentSignals.length - 1]
    : null;

  // ── 2. Derive state from session stats ────────────────────
  let derivedState = 'focused';

  if (sessionAttempts >= FATIGUE_ATTEMPTS_THRESHOLD) {
    derivedState = 'fatigued';
  } else if (recentSuccessRate !== null) {
    if (recentSuccessRate >= HIGH_ACCURACY_THRESHOLD) {
      derivedState = 'confident';
    } else if (recentSuccessRate <= LOW_ACCURACY_THRESHOLD) {
      derivedState = 'frustrated';
    }
  }

  // ── 3. Fuse signals ───────────────────────────────────────
  // Priority: explicit recent signal > derived from stats > stored dominant
  let currentEngagement = derivedState;

  if (latestExplicit?.engagement) {
    // Explicit signal from engagement-tracker wins unless it's stale
    const signalAge = latestExplicit.timestamp
      ? Date.now() - new Date(latestExplicit.timestamp).getTime()
      : Infinity;

    const STALE_MS = 30 * 60 * 1000;  // 30 minutes
    if (signalAge < STALE_MS) {
      currentEngagement = latestExplicit.engagement;
    }
  }

  // If explicit signal says frustrated but stats say confident, trust stats
  // (the student may have recovered since the last signal)
  if (currentEngagement === 'frustrated' && derivedState === 'confident') {
    currentEngagement = 'confident';
  }

  // ── 4. Frustration depth ─────────────────────────────────
  // Count how many of the recent signals show negative states
  const negativeStates = ['frustrated', 'fatigued', 'disengaged'];
  const recentNegative = recentSignals
    .filter(s => negativeStates.includes(s.engagement))
    .length;

  const frustrationDepth =
    recentNegative === 0 ? 'none'   :
    recentNegative <= 2  ? 'mild'   :
    recentNegative <= 4  ? 'moderate' :
                           'severe';

  return {
    currentEngagement,               // primary state for skills and AFE
    frustrationDepth,                // for AFE tone calibration
    derivedFromStats:   derivedState,
    dominantHistorical: dominant,
    sessionAttempts,
    recentSuccessRate,
    recentSignalCount:  recentSignals.length,
  };
}

module.exports = { detect };