// tools/exam-readiness/index.js
// Forecasts exam readiness based on mastery, velocity, and time remaining

const BaseTool = require('../base');

class ExamReadinessTool extends BaseTool {
  constructor() {
    super(
      'exam-readiness',
      'Forecast exam readiness based on mastery, velocity, and time remaining',
      '1.0.0'
    );
  }

  getParameters() {
    return [
      {
        name: 'masteryProfile',
        type: 'object',
        description: 'Current mastery scores per topic',
        required: true,
      },
      {
        name: 'velocityData',
        type: 'object',
        description: 'Learning velocity per topic',
        required: true,
      },
      {
        name: 'examDate',
        type: 'string',
        description: 'Exam date (ISO string)',
        required: true,
      },
      {
        name: 'sessionsPerWeek',
        type: 'number',
        description: 'Expected study sessions per week',
        required: false,
        default: 3,
      },
      {
        name: 'targetMastery',
        type: 'number',
        description: 'Target mastery score (0-1)',
        required: false,
        default: 0.8,
      },
    ];
  }

  async execute(params, context) {
    const { masteryProfile, velocityData, examDate, sessionsPerWeek = 3, targetMastery = 0.8 } = params;
    const { memory, studentId } = context;

    // Calculate time remaining
    const now = new Date();
    const exam = new Date(examDate);
    const daysRemaining = Math.max(0, Math.floor((exam - now) / (1000 * 60 * 60 * 24)));
    const weeksRemaining = Math.floor(daysRemaining / 7);
    const sessionsRemaining = weeksRemaining * sessionsPerWeek;

    // Analyze each topic
    const topicReadiness = {};
    const priorities = [];

    for (const [topicCode, mastery] of Object.entries(masteryProfile)) {
      const velocity = velocityData?.topics?.[topicCode]?.velocityPerSession || 0.02;
      const trend = velocityData?.topics?.[topicCode]?.trend || 'stalling';

      // Project future mastery
      const projectedMastery = this._projectMastery(mastery, velocity, sessionsRemaining);

      // Calculate readiness score
      const readiness = this._calculateReadiness(mastery, projectedMastery, targetMastery, daysRemaining);

      // Determine priority
      const priority = this._calculatePriority(mastery, projectedMastery, trend, daysRemaining);

      topicReadiness[topicCode] = {
        currentMastery: mastery,
        projectedMastery,
        readiness,
        priority,
        trend,
        sessionsNeeded: this._sessionsNeeded(mastery, targetMastery, velocity),
        recommended: this._getRecommendation(priority, trend, mastery),
      };

      if (priority > 0.5) {
        priorities.push({
          topicCode,
          priority,
          currentMastery: mastery,
          projectedMastery,
        });
      }
    }

    // Sort priorities
    priorities.sort((a, b) => b.priority - a.priority);

    // Calculate overall readiness
    const overallReadiness = this._calculateOverallReadiness(topicReadiness, targetMastery);

    // Determine readiness band
    const band = this._getReadinessBand(overallReadiness);

    // Check if urgent
    const isUrgent = daysRemaining < 30 || overallReadiness < 0.4 && daysRemaining < 60;

    // Store in memory if available
    if (memory?.updateExamReadiness) {
      memory.updateExamReadiness(studentId, overallReadiness, topicReadiness);
    }

    return {
      overall: overallReadiness,
      band,
      isUrgent,
      daysRemaining,
      weeksRemaining,
      sessionsRemaining,
      byTopic: topicReadiness,
      priorities: priorities.slice(0, 5), // Top 5 priorities
      studyPlan: this._generateStudyPlan(priorities, sessionsRemaining, topicReadiness),
      recommendations: this._generateRecommendations(priorities, daysRemaining, isUrgent),
    };
  }

  _projectMastery(currentMastery, velocityPerSession, sessionsRemaining) {
    const projected = currentMastery + (velocityPerSession * sessionsRemaining);
    return Math.min(1, Math.max(0, projected));
  }

  _calculateReadiness(current, projected, target, daysRemaining) {
    // Weighted combination of current and projected
    const timeWeight = Math.min(1, daysRemaining / 90); // Less weight if far away
    const readiness = (current * (1 - timeWeight)) + (projected * timeWeight);

    // Scale relative to target
    return Math.min(1, readiness / target);
  }

  _calculatePriority(currentMastery, projectedMastery, trend, daysRemaining) {
    let priority = 0;

    // Low current mastery = high priority
    if (currentMastery < 0.4) priority += 0.5;
    else if (currentMastery < 0.6) priority += 0.3;

    // Poor projection = high priority
    if (projectedMastery < 0.6) priority += 0.4;

    // Declining trend = high priority
    if (trend === 'declining') priority += 0.3;
    else if (trend === 'stalling') priority += 0.2;

    // Time factor - more urgent if exam close
    if (daysRemaining < 30) priority *= 1.5;
    else if (daysRemaining < 60) priority *= 1.2;

    return Math.min(1, priority);
  }

  _sessionsNeeded(currentMastery, targetMastery, velocityPerSession) {
    if (velocityPerSession <= 0) return Infinity;
    const gap = targetMastery - currentMastery;
    return Math.ceil(gap / velocityPerSession);
  }

  _getRecommendation(priority, trend, mastery) {
    if (priority > 0.8) {
      if (trend === 'declining') return 'CRITICAL: Review fundamentals immediately';
      if (mastery < 0.3) return 'HIGH PRIORITY: Start from basics';
      return 'HIGH PRIORITY: Intensive practice needed';
    }
    if (priority > 0.5) {
      if (trend === 'stalling') return 'Medium priority: Try different learning approach';
      return 'Medium priority: Regular practice recommended';
    }
    return 'Low priority: Maintain with occasional review';
  }

  _calculateOverallReadiness(topicReadiness, targetMastery) {
    const topics = Object.values(topicReadiness);
    if (topics.length === 0) return 0;

    const total = topics.reduce((sum, t) => sum + t.readiness, 0);
    return total / topics.length;
  }

  _getReadinessBand(overallReadiness) {
    if (overallReadiness >= 0.8) return 'excellent';
    if (overallReadiness >= 0.6) return 'good';
    if (overallReadiness >= 0.4) return 'fair';
    if (overallReadiness >= 0.2) return 'needs work';
    return 'critical';
  }

  _generateStudyPlan(priorities, sessionsRemaining, topicReadiness) {
    if (sessionsRemaining <= 0) return 'No time remaining before exam!';

    const plan = [];
    let sessionsAllocated = 0;

    // Allocate sessions to priority topics
    for (const p of priorities.slice(0, 3)) {
      const sessionsNeeded = Math.min(
        topicReadiness[p.topicCode].sessionsNeeded,
        Math.ceil(sessionsRemaining * 0.4) // Max 40% of remaining time
      );

      if (sessionsNeeded > 0 && sessionsNeeded < Infinity) {
        plan.push({
          topicCode: p.topicCode,
          sessions: sessionsNeeded,
          focus: topicReadiness[p.topicCode].recommended,
        });
        sessionsAllocated += sessionsNeeded;
      }
    }

    // Remaining sessions for maintenance
    const maintenanceSessions = Math.max(0, sessionsRemaining - sessionsAllocated);
    if (maintenanceSessions > 0) {
      plan.push({
        topicCode: 'maintenance',
        sessions: maintenanceSessions,
        focus: 'Review all topics, focus on weaker areas',
      });
    }

    return plan;
  }

  _generateRecommendations(priorities, daysRemaining, isUrgent) {
    const recommendations = [];

    if (isUrgent) {
      recommendations.push('⚠️ URGENT: Exam is approaching quickly! Focus on high-priority topics.');
    }

    if (priorities.length > 0) {
      const topTopics = priorities.slice(0, 3).map(p => p.topicCode).join(', ');
      recommendations.push(`Priority topics: ${topTopics}`);
    }

    if (daysRemaining < 7) {
      recommendations.push('Final review: Practice past papers and review mistakes only');
    } else if (daysRemaining < 30) {
      recommendations.push('Intensive review: Focus on weak areas, take practice tests');
    } else {
      recommendations.push('Steady progress: Maintain regular practice sessions');
    }

    return recommendations;
  }
}

module.exports = ExamReadinessTool;