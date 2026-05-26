// utils/student-level-detector.js
// Detects student learning level from student model
// Used to adapt content difficulty and teaching approach

'use strict';

class StudentLevelDetector {
  constructor() {
    this.levelThresholds = {
      beginner: 0.4,
      intermediate: 0.7,
      advanced: 0.9
    };
  }

  /**
   * Detect student's overall learning level
   * @param {object} studentModel - Complete student model
   * @returns {string} 'beginner' | 'intermediate' | 'advanced'
   */
  detect(studentModel) {
    if (!studentModel) return 'intermediate';

    // Combine multiple factors for more accurate detection
    const scores = [
      this._getMasteryScore(studentModel),
      this._getVelocityScore(studentModel),
      this._getConfidenceScore(studentModel),
      this._getExamReadinessScore(studentModel)
    ];

    const validScores = scores.filter(s => s !== null);
    if (validScores.length === 0) return 'intermediate';

    const averageScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;

    if (averageScore < this.levelThresholds.beginner) return 'beginner';
    if (averageScore < this.levelThresholds.intermediate) return 'intermediate';
    return 'advanced';
  }

  /**
   * Detect level for specific topic
   * @param {object} studentModel - Complete student model
   * @param {string} topicCode - Topic code
   * @returns {string} Topic-specific level
   */
  detectForTopic(studentModel, topicCode) {
    if (!studentModel || !topicCode) return 'intermediate';

    const masteryScore = studentModel.masteryProfile?.[topicCode];
    if (masteryScore === undefined) return 'intermediate';

    if (masteryScore < this.levelThresholds.beginner) return 'beginner';
    if (masteryScore < this.levelThresholds.intermediate) return 'intermediate';
    return 'advanced';
  }

  /**
   * Get recommended difficulty for next content
   * @param {object} studentModel - Complete student model
   * @param {string} topicCode - Optional topic code
   * @returns {string} 'easy' | 'medium' | 'hard'
   */
  getRecommendedDifficulty(studentModel, topicCode = null) {
    const level = topicCode
      ? this.detectForTopic(studentModel, topicCode)
      : this.detect(studentModel);

    switch (level) {
      case 'beginner':
        return 'easy';
      case 'advanced':
        return 'hard';
      default:
        return 'medium';
    }
  }

  /**
   * Get learning pace recommendation
   * @param {object} studentModel - Complete student model
   * @returns {string} 'slow' | 'normal' | 'fast'
   */
  getRecommendedPace(studentModel) {
    if (!studentModel) return 'normal';

    const velocity = studentModel.velocity?.topics || {};
    const velocities = Object.values(velocity)
      .map(v => v.velocityPerSession)
      .filter(v => v !== undefined);

    if (velocities.length === 0) return 'normal';

    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;

    if (avgVelocity < 0.02) return 'slow';
    if (avgVelocity > 0.05) return 'fast';
    return 'normal';
  }

  /**
   * Get content depth recommendation
   * @param {object} studentModel - Complete student model
   * @returns {string} 'basic' | 'standard' | 'deep'
   */
  getRecommendedDepth(studentModel) {
    const level = this.detect(studentModel);

    switch (level) {
      case 'beginner':
        return 'basic';
      case 'advanced':
        return 'deep';
      default:
        return 'standard';
    }
  }

  /**
   * Check if student needs review
   * @param {object} studentModel - Complete student model
   * @param {string} topicCode - Topic to check
   * @returns {boolean} True if needs review
   */
  needsReview(studentModel, topicCode) {
    if (!studentModel || !topicCode) return false;

    const mastery = studentModel.masteryProfile?.[topicCode];
    if (mastery === undefined) return true;

    const lastAttempt = this._getLastAttemptTime(studentModel, topicCode);
    if (!lastAttempt) return true;

    const daysSinceLastAttempt = (Date.now() - lastAttempt) / (1000 * 60 * 60 * 24);

    // Review if mastery is low or haven't practiced in a while
    return mastery < 0.6 || daysSinceLastAttempt > 7;
  }

  /**
   * Get student's learning style adaptation
   * @param {object} studentModel - Complete student model
   * @returns {object} Style preferences
   */
  getStylePreferences(studentModel) {
    const defaultStyle = {
      representation: 'balanced',
      examples: true,
      analogies: true,
      visual: false,
      pace: 'normal'
    };

    if (!studentModel?.learningStyle) return defaultStyle;

    const style = studentModel.learningStyle;

    return {
      representation: style.preferredRepresentation || 'balanced',
      examples: style.respondsWellTo?.includes('examples') || true,
      analogies: style.respondsWellTo?.includes('analogies') || true,
      visual: style.preferredRepresentation === 'visual',
      pace: this.getRecommendedPace(studentModel)
    };
  }

  /**
   * Extract mastery score from student model
   * @private
   */
  _getMasteryScore(studentModel) {
    const overall = studentModel.overallMastery;
    if (overall !== null && overall !== undefined) return overall;

    const masteryProfile = studentModel.masteryProfile;
    if (!masteryProfile) return null;

    const scores = Object.values(masteryProfile);
    if (scores.length === 0) return null;

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Extract velocity score from student model
   * @private
   */
  _getVelocityScore(studentModel) {
    const velocity = studentModel.velocity?.topics;
    if (!velocity) return null;

    const values = Object.values(velocity)
      .map(v => v.velocityPerSession)
      .filter(v => v !== undefined);

    if (values.length === 0) return null;

    const avgVelocity = values.reduce((a, b) => a + b, 0) / values.length;

    // Convert velocity to 0-1 scale
    return Math.min(1, avgVelocity * 20);
  }

  /**
   * Extract confidence score from student model
   * @private
   */
  _getConfidenceScore(studentModel) {
    const confidence = studentModel.profile?.confidenceLevel;
    if (!confidence) return null;

    if (typeof confidence === 'number') return confidence;

    // If confidence is per-topic, average it
    if (typeof confidence === 'object') {
      const values = Object.values(confidence);
      if (values.length > 0) {
        return values.reduce((a, b) => a + b, 0) / values.length;
      }
    }

    return null;
  }

  /**
   * Extract exam readiness score from student model
   * @private
   */
  _getExamReadinessScore(studentModel) {
    const forecast = studentModel.examReadinessForecast;
    if (!forecast) return null;

    // Use overall forecast if available
    if (forecast.overall !== null && forecast.overall !== undefined) {
      return forecast.overall;
    }

    // Average topic forecasts
    const byTopic = forecast.byTopic;
    if (!byTopic) return null;

    const values = Object.values(byTopic)
      .map(v => typeof v === 'number' ? v : v.forecastedMastery)
      .filter(v => v !== undefined);

    if (values.length === 0) return null;

    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Get last attempt time for topic
   * @private
   */
  _getLastAttemptTime(studentModel, topicCode) {
    const progress = studentModel.progress;
    if (!progress?.sessions) return null;

    for (const session of progress.sessions) {
      const attempt = session.attempts?.find(a => a.dotPoint === topicCode);
      if (attempt?.timestamp) {
        return new Date(attempt.timestamp).getTime();
      }
    }

    return null;
  }
}

module.exports = StudentLevelDetector;