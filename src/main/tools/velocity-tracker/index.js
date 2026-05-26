// tools/velocity-tracker/index.js
// Tracks learning velocity and improvement rates per topic

const BaseTool = require('../base');

class VelocityTrackerTool extends BaseTool {
  constructor() {
    super(
      'velocity-tracker',
      'Track learning velocity and improvement rates per topic',
      '1.0.0'
    );
  }

  getParameters() {
    return [
      {
        name: 'topicCode',
        type: 'string',
        description: 'Topic code (e.g., "TOEFL-R", "MA-C")',
        required: true,
      },
      {
        name: 'topicLabel',
        type: 'string',
        description: 'Human-readable topic name',
        required: false,
      },
      {
        name: 'score',
        type: 'number',
        description: 'Current score (0-1)',
        required: true,
      },
      {
        name: 'previousScore',
        type: 'number',
        description: 'Previous score for comparison',
        required: false,
      },
      {
        name: 'attempts',
        type: 'number',
        description: 'Number of attempts in this session',
        required: false,
        default: 1,
      },
      {
        name: 'studentId',
        type: 'string',
        description: 'Student ID for persistent tracking',
        required: true,
      },
    ];
  }

  async execute(params, context) {
    const { topicCode, topicLabel, score, previousScore, attempts, studentId } = params;
    const { memory } = context;

    if (!memory) {
      return this._calculateVelocityOnly(score, previousScore, attempts);
    }

    try {
      // Get existing velocity data
      const velocityData = memory.getVelocity ? memory.getVelocity(studentId) : null;

      // Calculate delta
      const delta = previousScore !== undefined ? score - previousScore : 0;

      // Determine trend
      const trend = this._determineTrend(delta, velocityData, topicCode);

      // Calculate velocity (improvement per session)
      const velocity = this._calculateVelocity(delta, attempts, trend);

      // Store in memory
      if (memory.updateVelocity) {
        memory.updateVelocity(studentId, topicCode, topicLabel || topicCode, velocity, attempts);
      }

      // Get stalling topics if any
      const stallingTopics = memory.getStallingTopics ? memory.getStallingTopics(studentId) : [];

      return {
        topicCode,
        topicLabel: topicLabel || topicCode,
        velocity,
        delta,
        trend,
        attempts,
        stallingTopics,
        needsIntervention: trend === 'declining' || trend === 'stalling',
        recommendedAction: this._getRecommendedAction(trend, velocity),
        history: velocityData?.topics?.[topicCode]?.sessionHistory || [],
      };

    } catch (err) {
      console.error('[VelocityTracker] Error:', err.message);
      return this._calculateVelocityOnly(score, previousScore, attempts);
    }
  }

  _calculateVelocityOnly(score, previousScore, attempts) {
    const delta = previousScore !== undefined ? score - previousScore : 0;
    const velocity = attempts > 0 ? delta / attempts : 0;
    const trend = this._determineTrendSimple(delta);

    return {
      velocity,
      delta,
      trend,
      attempts,
      needsIntervention: trend === 'declining' || trend === 'stalling',
      recommendedAction: this._getRecommendedAction(trend, velocity),
    };
  }

  _determineTrend(delta, velocityData, topicCode) {
    // Check history if available
    if (velocityData?.topics?.[topicCode]?.sessionHistory) {
      const history = velocityData.topics[topicCode].sessionHistory;
      const recentDeltas = history.slice(-3).map(h => h.delta);
      const avgRecent = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length;

      if (avgRecent > 0.05) return 'improving';
      if (avgRecent < -0.05) return 'declining';
      return 'stalling';
    }

    return this._determineTrendSimple(delta);
  }

  _determineTrendSimple(delta) {
    if (delta > 0.05) return 'improving';
    if (delta < -0.05) return 'declining';
    return 'stalling';
  }

  _calculateVelocity(delta, attempts, trend) {
    const baseVelocity = attempts > 0 ? delta / attempts : 0;

    // Adjust based on trend
    if (trend === 'improving') return Math.min(baseVelocity * 1.2, 0.5);
    if (trend === 'declining') return Math.max(baseVelocity * 0.8, -0.5);
    return baseVelocity;
  }

  _getRecommendedAction(trend, velocity) {
    const actions = {
      improving: 'Keep up the good work! This topic is improving well.',
      stalling: 'Try a different approach - maybe use more examples or visual aids.',
      declining: 'This topic needs attention. Consider reviewing fundamentals.',
    };

    if (Math.abs(velocity) < 0.01) {
      return 'Progress is very slow. Try breaking the topic into smaller pieces.';
    }

    return actions[trend] || 'Continue practicing consistently.';
  }
}

module.exports = VelocityTrackerTool;