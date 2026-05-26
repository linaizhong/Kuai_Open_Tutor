// student-model/velocity-analyser.js
//
// Responsibility:
//   Analyses raw velocity.json data to produce per-topic momentum signals.
//   Determines whether each topic is improving, stalling, or declining,
//   and identifies which topics the student is making the best progress on
//   vs. which ones are stuck.
//
//   Also computes a "momentum score" (0.0–1.0) per topic for the AFE to use
//   when deciding whether to keep pushing or to switch approach.

'use strict';

// Thresholds for trend classification
const IMPROVING_THRESHOLD  =  0.02;   // velocity >= +0.02/session = improving
const DECLINING_THRESHOLD  = -0.01;   // velocity <= -0.01/session = declining
// Between these = stalling

// A topic that has needed this many attempts per correct answer is "slow to consolidate"
const SLOW_CONSOLIDATION_THRESHOLD = 10;

/**
 * Analyses velocity data and returns enriched momentum model.
 *
 * @param {object} velocityData  — raw data from memory.getContext().velocity
 * @returns {object}
 */
function analyse(velocityData) {
  const topics = velocityData?.topics || {};

  const enriched     = {};
  const improving    = [];
  const stalling     = [];
  const declining    = [];

  for (const [topicCode, data] of Object.entries(topics)) {
    const vel   = data.velocityPerSession || 0;
    const avg   = data.avgAttemptsToConsolidate || null;
    const trend = classifyTrend(vel, data.trend);

    // Momentum score: high velocity + low attempts = high momentum
    const momentumScore = computeMomentumScore(vel, avg);

    const enrichedTopic = {
      label:                   data.label || topicCode,
      velocityPerSession:      vel,
      trend,
      avgAttemptsToConsolidate: avg,
      momentumScore,
      isSlowToConsolidate:     avg !== null && avg >= SLOW_CONSOLIDATION_THRESHOLD,
    };

    enriched[topicCode] = enrichedTopic;

    if (trend === 'improving') improving.push({ code: topicCode, ...enrichedTopic });
    else if (trend === 'declining') declining.push({ code: topicCode, ...enrichedTopic });
    else stalling.push({ code: topicCode, ...enrichedTopic });
  }

  // Sort improving by velocity desc, stalling/declining by momentum asc
  improving.sort((a, b) => b.velocityPerSession - a.velocityPerSession);
  stalling.sort((a, b) => a.momentumScore - b.momentumScore);
  declining.sort((a, b) => a.momentumScore - b.momentumScore);

  // Topics that need a strategy change: stalling or declining with low momentum
  const needsIntervention = [
    ...declining,
    ...stalling.filter(t => t.momentumScore < 0.3),
  ].map(t => t.code);

  return {
    topics:             enriched,
    improvingTopics:    improving.map(t => t.code),
    stallingTopics:     stalling.map(t => t.code),
    decliningTopics:    declining.map(t => t.code),
    needsIntervention,
  };
}

/**
 * Classifies a velocity reading into a trend label.
 * Prefers the stored trend if available (set by velocity-tracker passive skill),
 * but recalculates from velocity if missing.
 */
function classifyTrend(velocityPerSession, storedTrend) {
  if (storedTrend && ['improving', 'stalling', 'declining'].includes(storedTrend)) {
    return storedTrend;
  }
  if (velocityPerSession >= IMPROVING_THRESHOLD)  return 'improving';
  if (velocityPerSession <= DECLINING_THRESHOLD)  return 'declining';
  return 'stalling';
}

/**
 * Computes a 0.0–1.0 momentum score for a topic.
 *
 * High velocity + low attempts per consolidation = high momentum (good progress).
 * Low velocity + high attempts = low momentum (stuck).
 */
function computeMomentumScore(velocityPerSession, avgAttemptsToConsolidate) {
  // Velocity component: normalise against typical range 0.0–0.08
  const velScore = Math.min(1.0, Math.max(0.0, velocityPerSession / 0.08));

  // Attempts component: fewer attempts to consolidate = better
  let attScore = 0.5;  // default if unknown
  if (avgAttemptsToConsolidate !== null) {
    // Normalise: 1 attempt = 1.0, 20+ attempts = 0.0
    attScore = Math.max(0, 1 - (avgAttemptsToConsolidate - 1) / 19);
  }

  // Weighted average: velocity slightly more important
  return Math.round((velScore * 0.6 + attScore * 0.4) * 100) / 100;
}

module.exports = { analyse };