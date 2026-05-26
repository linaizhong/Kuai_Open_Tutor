// teacher/curriculum-engine.js
// Manages curriculum progression and tracks student's place in the syllabus

'use strict';

const CurriculumLoader = require('../curriculum');

class CurriculumEngine {
  /**
   * @param {object} config
   * @param {string} config.subject - Subject ID (e.g., 'maths-advanced')
   * @param {object} config.memory - MemoryManager instance
   * @param {string} config.studentId - Student ID
   */
  constructor(config) {
    this.subject = config.subject;
    this.memory = config.memory;
    this.studentId = config.studentId;

    // Load curriculum data
    this.curriculum = CurriculumLoader.loadSubject(config.subject);
  }

  /**
   * Get student's current position in the curriculum
   * @param {object} masteryProfile - Student's mastery scores per dot point
   * @param {object} velocity - Student's learning velocity data
   * @returns {object} { completedTopics, currentTopic, nextTopics }
   */
  getCurrentPosition(masteryProfile, velocity) {
    const topics = this.curriculum.topics || {};
    const topicMastery = this._calculateTopicMastery(masteryProfile);

    const completedTopics = [];
    let currentTopic = null;
    const nextTopics = [];

    // Determine which topics are completed (mastery > 0.8)
    for (const [topicCode, topicData] of Object.entries(topics)) {
      const mastery = topicMastery[topicCode] || 0;

      if (mastery >= 0.8) {
        completedTopics.push(topicCode);
      } else if (!currentTopic && this._prerequisitesMet(topicCode, topicMastery)) {
        currentTopic = topicCode;
      }
    }

    // Find next topics that could be studied after current
    if (currentTopic) {
      for (const [topicCode, topicData] of Object.entries(topics)) {
        if (!completedTopics.includes(topicCode) && topicCode !== currentTopic) {
          if (this._prerequisitesMet(topicCode, topicMastery)) {
            nextTopics.push(topicCode);
          }
        }
      }
    }

    return {
      completedTopics,
      currentTopic,
      nextTopics: nextTopics.slice(0, 3) // Limit to top 3
    };
  }

  /**
   * Calculate mastery scores per topic (average of dot points)
   * @param {object} masteryProfile - Dot point mastery scores
   * @returns {object} Topic mastery scores
   */
  _calculateTopicMastery(masteryProfile) {
    const topicScores = {};

    for (const [dotPoint, score] of Object.entries(masteryProfile || {})) {
      const topic = this._extractTopicCode(dotPoint);
      if (!topic) continue;

      if (!topicScores[topic]) {
        topicScores[topic] = { total: 0, count: 0 };
      }
      topicScores[topic].total += score;
      topicScores[topic].count += 1;
    }

    const result = {};
    for (const [topic, { total, count }] of Object.entries(topicScores)) {
      result[topic] = total / count;
    }
    return result;
  }

  /**
   * Check if prerequisites for a topic are met
   * @param {string} topicCode
   * @param {object} topicMastery
   * @returns {boolean}
   */
  _prerequisitesMet(topicCode, topicMastery) {
    const topic = this.curriculum.topics?.[topicCode];
    if (!topic || !topic.prerequisites || topic.prerequisites.length === 0) {
      return true;
    }

    return topic.prerequisites.every(pre => {
      const mastery = topicMastery[pre] || 0;
      return mastery >= 0.6; // Need at least 60% mastery in prerequisites
    });
  }

  /**
   * Extract topic code from dot point (e.g., 'MA-C1.2' -> 'MA-C1')
   * @param {string} dotPoint
   * @returns {string|null}
   */
  _extractTopicCode(dotPoint) {
    const match = dotPoint.match(/^(MA-[A-Z]+\d*)/);
    return match ? match[1] : null;
  }

  /**
   * Get suggested learning pace based on exam date
   * @param {number} weeksRemaining - Weeks until exam
   * @param {number} topicsRemaining - Number of topics not yet mastered
   * @returns {object} Pace recommendations
   */
  suggestPace(weeksRemaining, topicsRemaining) {
    if (!weeksRemaining || weeksRemaining <= 0) {
      return { sessionsPerWeek: 5, urgency: 'critical' };
    }

    const sessionsNeeded = topicsRemaining * 3; // Assume 3 sessions per topic
    const sessionsPerWeek = Math.ceil(sessionsNeeded / weeksRemaining);

    let urgency = 'normal';
    if (sessionsPerWeek >= 7) urgency = 'critical';
    else if (sessionsPerWeek >= 5) urgency = 'high';
    else if (sessionsPerWeek >= 3) urgency = 'medium';

    return {
      sessionsPerWeek: Math.min(sessionsPerWeek, 7), // Cap at 7 sessions/week
      urgency,
      topicsPerWeek: (topicsRemaining / weeksRemaining).toFixed(1)
    };
  }
}

module.exports = CurriculumEngine;