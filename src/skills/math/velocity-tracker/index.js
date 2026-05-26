// Skill: velocity-tracker
// Type: passive
// Phase 4 — Silently track how fast the student's mastery is changing
// per topic after each interaction. Updates velocity.json via memoryUpdates.

'use strict';

// ── Topic code lookup from dot-point code ─────────────────────
// e.g. 'MA-C1.3' → 'MA-C'
function dotPointToTopic(dpCode) {
  if (!dpCode) return null;
  const m = dpCode.match(/^(MA-[A-Z])/);
  return m ? m[1] : null;
}

// ── Topic display names ───────────────────────────────────────
const TOPIC_LABELS = {
  'MA-F': 'Functions',
  'MA-T': 'Trigonometry',
  'MA-C': 'Calculus',
  'MA-E': 'Exponential & Logs',
  'MA-S': 'Statistics',
  'MA-M': 'Financial Maths',
};

// ── Trend constants ───────────────────────────────────────────
const TREND = {
  IMPROVING: 'improving',
  STALLING:  'stalling',
  DECLINING: 'declining',
  UNKNOWN:   'unknown',
};

// ── Smoothing factor for exponential moving average ───────────
// Lower = smoother (older data has more influence)
// Higher = more reactive (recent data dominates)
const EMA_ALPHA = 0.3;

// ── Minimum delta magnitude to count as a real change ─────────
const NOISE_THRESHOLD = 0.005;

// ── Trend determination from recent deltas ────────────────────
// Requires at least 3 delta observations to form a trend.
function determineTrend(deltas) {
  if (!deltas || deltas.length < 2) return TREND.UNKNOWN;

  const recent = deltas.slice(-5); // look at last 5 deltas
  const positives = recent.filter(d => d > NOISE_THRESHOLD).length;
  const negatives = recent.filter(d => d < -NOISE_THRESHOLD).length;
  const neutrals  = recent.length - positives - negatives;

  if (positives >= Math.ceil(recent.length * 0.6)) return TREND.IMPROVING;
  if (negatives >= Math.ceil(recent.length * 0.5)) return TREND.DECLINING;
  if (neutrals  >= Math.ceil(recent.length * 0.5)) return TREND.STALLING;

  // Mixed signals — lean towards the majority
  if (positives > negatives) return TREND.IMPROVING;
  if (negatives > positives) return TREND.DECLINING;
  return TREND.STALLING;
}

// ── Update the EMA velocity for a topic ──────────────────────
function updateEMA(currentEMA, newDelta) {
  if (currentEMA === null || currentEMA === undefined) return newDelta;
  return +(EMA_ALPHA * newDelta + (1 - EMA_ALPHA) * currentEMA).toFixed(5);
}

// ── Compute attempts-to-consolidate running average ──────────
function updateAttemptsToConsolidate(current, isCorrect, threshold = 0.70) {
  // We track a rolling window: how many attempts per "consolidation event"
  // A consolidation event = mastery crosses the 0.70 threshold for the first time
  if (!current) return { count: 1, avg: null, crossedThreshold: false };

  const newCount = (current.count || 0) + 1;
  // If this attempt was correct and mastery is near threshold, note it
  return { count: newCount, avg: current.avg, crossedThreshold: current.crossedThreshold };
}

// ═════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════
module.exports = {
  meta: {
    name: 'velocity-tracker',
    version: '1.0.0',
    type: 'passive',
  },

  execute: async function (params, context) {
    // ── 1. Extract inputs ──────────────────────────────────
    const {
      dotPoint     = null,   // e.g. 'MA-C1.3'
      isCorrect    = null,   // true | false | null
      masteryBefore= null,   // float 0–1, before this interaction
      masteryAfter = null,   // float 0–1, after this interaction
      attempts     = 1,      // attempts on this dot-point this interaction
    } = params || {};

    const { memory } = context || {};

    // ── 2. Determine topic ─────────────────────────────────
    const topicCode = dotPoint ? dotPointToTopic(dotPoint) : null;
    if (!topicCode) {
      // No dot-point context — nothing to update
      return { memoryUpdates: null };
    }

    const topicLabel = TOPIC_LABELS[topicCode] || topicCode;

    // ── 3. Compute mastery delta ───────────────────────────
    // Use provided before/after if available; otherwise infer from isCorrect.
    let delta = null;

    if (masteryBefore !== null && masteryAfter !== null) {
      delta = +(masteryAfter - masteryBefore).toFixed(5);
    } else if (isCorrect === true) {
      // No mastery data — use a conservative positive signal
      delta = 0.02;
    } else if (isCorrect === false) {
      // Incorrect answer — slight negative signal
      delta = -0.01;
    } else {
      // No signal available
      return { memoryUpdates: null };
    }

    // ── 4. Load existing velocity record for this topic ───
    const existingVelocity = (memory?.velocity?.topics || {})[topicCode] || {
      label:                  topicLabel,
      velocityPerSession:     null,
      deltaHistory:           [],
      trend:                  TREND.UNKNOWN,
      avgAttemptsToConsolidate: null,
      totalAttempts:          0,
      totalCorrect:           0,
      lastUpdated:            null,
    };

    // ── 5. Update running statistics ──────────────────────
    const deltaHistory = [
      ...(existingVelocity.deltaHistory || []),
      delta,
    ].slice(-20); // keep last 20 observations

    const emaVelocity = updateEMA(existingVelocity.velocityPerSession, delta);
    const trend       = determineTrend(deltaHistory);
    const totalAttempts = (existingVelocity.totalAttempts || 0) + attempts;
    const totalCorrect  = (existingVelocity.totalCorrect  || 0) + (isCorrect === true ? 1 : 0);

    // Efficiency: correct answers per attempt (lifetime)
    const efficiency = totalAttempts > 0
      ? +(totalCorrect / totalAttempts).toFixed(3)
      : null;

    // avgAttemptsToConsolidate: rough estimate — lower efficiency = more attempts needed
    const avgAttemptsToConsolidate = efficiency !== null && efficiency > 0
      ? Math.round(1 / efficiency)
      : existingVelocity.avgAttemptsToConsolidate;

    // ── 6. Build updated velocity record ──────────────────
    const updatedTopicVelocity = {
      label:                    topicLabel,
      velocityPerSession:       emaVelocity,
      deltaHistory,
      trend,
      efficiency,
      avgAttemptsToConsolidate,
      totalAttempts,
      totalCorrect,
      lastUpdated:              new Date().toISOString().slice(0, 10),
    };

    // ── 7. Merge into the full velocity topics map ─────────
    const updatedVelocityTopics = {
      ...(memory?.velocity?.topics || {}),
      [topicCode]: updatedTopicVelocity,
    };

    // ── 8. Return memoryUpdates (passive skill contract) ───
    return {
      memoryUpdates: {
        type:       'velocity',
        topicCode,
        topicLabel,
        delta,
        attempts,
        trend,
        value: {
          topics: updatedVelocityTopics,
        },
        // Expose key signals for the Student Model Module
        signal: {
          topicCode,
          topicLabel,
          delta,
          trend,
          velocityPerSession: emaVelocity,
          avgAttemptsToConsolidate,
        },
      },
    };
  },
};