/**
 * Autonomy Spectrum
 * Determines optimal autonomy level based on student state
 *
 * @module teaching-models/autonomy-spectrum
 */

'use strict';

class AutonomySpectrumError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'AutonomySpectrumError';
    this.cause = cause;
  }
}

/**
 * Autonomy levels from student-led to teacher-led
 * @readonly
 * @enum {number}
 */
const AutonomyLevel = {
  STUDENT_LED: 0.0,      // Student controls everything
  GUIDED: 0.25,          // System suggests, student chooses
  COLLABORATIVE: 0.5,    // System and student co-plan
  MENTORED: 0.75,        // System guides, student executes
  TEACHER_LED: 1.0       // System controls the flow
};

/**
 * Autonomy Spectrum Calculator
 * Determines optimal teaching autonomy based on multiple factors
 */
class AutonomySpectrum {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.weights - Factor weights (optional)
   * @param {Object} options.thresholds - Autonomy thresholds (optional)
   * @param {Object} options.logger - Logger instance (optional)
   */
  constructor(options = {}) {
    this.levels = AutonomyLevel;

    // Default weights for each factor
    this.weights = {
      mastery: options.weights?.mastery ?? 0.30,
      affective: options.weights?.affective ?? 0.25,
      velocity: options.weights?.velocity ?? 0.20,
      urgency: options.weights?.urgency ?? 0.15,
      timeOfDay: options.weights?.timeOfDay ?? 0.05,
      sessionDuration: options.weights?.sessionDuration ?? 0.05
    };

    // Validate weights sum to approximately 1.0
    const totalWeight = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      console.warn('[AutonomySpectrum] Weights sum to', totalWeight, 'should be ~1.0');
    }

    this.thresholds = {
      studentLed: options.thresholds?.studentLed ?? 0.2,
      guided: options.thresholds?.guided ?? 0.4,
      collaborative: options.thresholds?.collaborative ?? 0.6,
      mentored: options.thresholds?.mentored ?? 0.8,
      teacherLed: options.thresholds?.teacherLed ?? 1.0
    };

    this.logger = options.logger || console;

    // Factor caches
    this._factorCache = new Map();
    this._cacheTimeout = 5 * 60 * 1000; // 5 minutes

    this.logger.info('[AutonomySpectrum] Initialized', {
      weights: this.weights,
      thresholds: this.thresholds
    });
  }

  /**
   * Get available autonomy levels
   * @returns {Object} Autonomy level constants
   */
  getLevels() {
    return { ...this.levels };
  }

  /**
   * Determine optimal autonomy level based on student state
   *
   * @param {Object} studentModel - Current student model
   * @param {Object} sessionContext - Current session context
   * @param {string} sessionContext.studentId - Student ID
   * @param {number} sessionContext.sessionDuration - Session duration in ms
   * @param {Array} sessionContext.recentInteractions - Recent interactions
   * @returns {Promise<Object>} Autonomy decision with factors and level
   */
  async determineAutonomy(studentModel, sessionContext) {
    const startTime = Date.now();
    const decisionId = this._generateDecisionId();

    this.logger.info(`[AutonomySpectrum:${decisionId}] Determining autonomy`, {
      studentId: sessionContext.studentId
    });

    try {
      // Validate inputs
      this._validateInputs(studentModel, sessionContext);

      // Calculate each factor
      const factors = {
        mastery: await this._calculateMasteryFactor(studentModel),
        affective: await this._calculateAffectiveFactor(studentModel),
        velocity: await this._calculateVelocityFactor(studentModel),
        urgency: await this._calculateUrgencyFactor(studentModel),
        timeOfDay: this._calculateTimeOfDayFactor(),
        sessionDuration: this._calculateSessionDurationFactor(sessionContext)
      };

      // Calculate weighted score
      let totalScore = 0;
      const contributions = {};

      for (const [factor, value] of Object.entries(factors)) {
        const contribution = value * this.weights[factor];
        contributions[factor] = {
          value,
          weight: this.weights[factor],
          contribution
        };
        totalScore += contribution;
      }

      // Clamp score between 0 and 1
      totalScore = Math.max(0, Math.min(1, totalScore));

      // Determine autonomy level
      const level = this._scoreToLevel(totalScore);
      const levelName = this._levelToName(level);

      const duration = Date.now() - startTime;

      this.logger.info(`[AutonomySpectrum:${decisionId}] Decision complete`, {
        score: totalScore,
        level,
        levelName,
        factors: contributions,
        duration
      });

      return {
        score: totalScore,
        level,
        levelName,
        factors: contributions,
        timestamp: new Date().toISOString(),
        decisionId
      };

    } catch (err) {
      this.logger.error(`[AutonomySpectrum:${decisionId}] Failed:`, {
        error: err.message,
        stack: err.stack
      });

      if (err instanceof AutonomySpectrumError) {
        throw err;
      }
      throw new AutonomySpectrumError('Autonomy determination failed', err);
    }
  }

  /**
   * Validate inputs
   * @private
   */
  _validateInputs(studentModel, sessionContext) {
    if (!studentModel || typeof studentModel !== 'object') {
      throw new AutonomySpectrumError('studentModel must be an object');
    }

    if (!sessionContext || typeof sessionContext !== 'object') {
      throw new AutonomySpectrumError('sessionContext must be an object');
    }

    if (!sessionContext.studentId) {
      throw new AutonomySpectrumError('sessionContext.studentId is required');
    }
  }

  /**
   * Generate decision ID
   * @private
   */
  _generateDecisionId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Calculate mastery factor
   * @private
   */
  async _calculateMasteryFactor(studentModel) {
    const cacheKey = `mastery-${studentModel.studentId}`;
    const cached = this._getCached(cacheKey);
    if (cached !== null) return cached;

    let value = 0.5; // Default

    try {
      const overall = studentModel.overallMastery;
      if (overall !== undefined && overall !== null) {
        // Low mastery (0) → need guidance → low autonomy score
        // High mastery (1) → can be autonomous → high autonomy score
        value = overall;
      }

      // Adjust for weak topics
      const weakTopics = studentModel.weakestTopics?.length || 0;
      if (weakTopics > 3) {
        value *= 0.8; // Reduce autonomy if many weak topics
      }

      // Adjust for at-risk topics
      const atRisk = studentModel.atRiskTopics?.length || 0;
      if (atRisk > 0) {
        value *= 0.9; // Slightly reduce autonomy for at-risk topics
      }

      value = Math.max(0, Math.min(1, value));
      this._cacheFactor(cacheKey, value);

    } catch (err) {
      this.logger.warn('[AutonomySpectrum] Mastery factor calculation failed:', err.message);
    }

    return value;
  }

  /**
   * Calculate affective factor
   * @private
   */
  async _calculateAffectiveFactor(studentModel) {
    const cacheKey = `affective-${studentModel.studentId}`;
    const cached = this._getCached(cacheKey);
    if (cached !== null) return cached;

    let value = 0.5; // Default

    try {
      const state = studentModel.affectiveState?.currentEngagement;

      const stateMap = {
        'frustrated': 0.2,  // Needs guidance
        'fatigued': 0.3,     // Needs guidance
        'disengaged': 0.1,   // Needs motivation/guidance
        'focused': 0.6,      // Can be autonomous
        'confident': 0.8,    // Ready for autonomy
        'curious': 0.7,      // Good for exploration
        'bored': 0.3         // Needs engagement/change
      };

      value = stateMap[state] ?? 0.5;

      // Adjust for frustration depth
      const depth = studentModel.affectiveState?.frustrationDepth;
      if (depth === 'severe') value *= 0.5;
      if (depth === 'moderate') value *= 0.7;

      // Adjust for recent success rate
      const successRate = studentModel.affectiveState?.recentSuccessRate;
      if (successRate !== undefined && successRate !== null) {
        value = (value + successRate) / 2;
      }

      value = Math.max(0, Math.min(1, value));
      this._cacheFactor(cacheKey, value);

    } catch (err) {
      this.logger.warn('[AutonomySpectrum] Affective factor calculation failed:', err.message);
    }

    return value;
  }

  /**
   * Calculate velocity factor
   * @private
   */
  async _calculateVelocityFactor(studentModel) {
    const cacheKey = `velocity-${studentModel.studentId}`;
    const cached = this._getCached(cacheKey);
    if (cached !== null) return cached;

    let value = 0.5; // Default

    try {
      const velocity = studentModel.velocity || {};

      const improving = velocity.improvingTopics?.length || 0;
      const stalling = velocity.stallingTopics?.length || 0;
      const declining = velocity.decliningTopics?.length || 0;

      if (improving + stalling + declining > 0) {
        // Ratio of positive to total signals
        const positive = improving;
        const total = improving + stalling + declining;
        value = positive / total;
      }

      // Boost if many improving topics
      if (improving > 3) value = Math.min(1, value * 1.2);

      // Reduce if many stalling topics
      if (stalling > 2) value *= 0.8;

      value = Math.max(0, Math.min(1, value));
      this._cacheFactor(cacheKey, value);

    } catch (err) {
      this.logger.warn('[AutonomySpectrum] Velocity factor calculation failed:', err.message);
    }

    return value;
  }

  /**
   * Calculate urgency factor
   * @private
   */
  async _calculateUrgencyFactor(studentModel) {
    const cacheKey = `urgency-${studentModel.studentId}`;
    const cached = this._getCached(cacheKey);
    if (cached !== null) return cached;

    let value = 0.5; // Default

    try {
      const weeksLeft = studentModel.weeksRemaining;

      if (weeksLeft !== undefined && weeksLeft !== null) {
        // More weeks left → less urgency → more autonomy
        // Fewer weeks left → more urgency → less autonomy
        if (weeksLeft < 2) {
          value = 0.9; // High urgency, need efficient teaching
        } else if (weeksLeft < 4) {
          value = 0.7;
        } else if (weeksLeft < 8) {
          value = 0.5;
        } else if (weeksLeft < 12) {
          value = 0.3;
        } else {
          value = 0.2; // Lots of time, can explore
        }
      }

      // Adjust for critical topics
      const criticalTopics = studentModel.examReadinessForecast?.criticalTopics?.length || 0;
      if (criticalTopics > 0) {
        value = Math.min(1, value + (criticalTopics * 0.1));
      }

      // Adjust for exam readiness band
      const band = studentModel.examReadinessForecast?.overallBand;
      if (band === 'at risk') value = Math.min(1, value + 0.2);
      if (band === 'needs work') value = Math.min(1, value + 0.1);

      value = Math.max(0, Math.min(1, value));
      this._cacheFactor(cacheKey, value);

    } catch (err) {
      this.logger.warn('[AutonomySpectrum] Urgency factor calculation failed:', err.message);
    }

    return value;
  }

  /**
   * Calculate time of day factor
   * @private
   */
  _calculateTimeOfDayFactor() {
    const hour = new Date().getHours();

    // Mornings: more focused → more autonomy
    // Afternoons: less focused → more guidance
    // Evenings: variable

    if (hour >= 8 && hour <= 11) {
      return 0.7; // Morning peak
    } else if (hour >= 14 && hour <= 16) {
      return 0.4; // Afternoon slump
    } else if (hour >= 19 && hour <= 21) {
      return 0.5; // Evening
    } else if (hour >= 22 || hour <= 5) {
      return 0.3; // Late night - likely tired
    } else {
      return 0.5; // Default
    }
  }

  /**
   * Calculate session duration factor
   * @private
   */
  _calculateSessionDurationFactor(sessionContext) {
    const duration = sessionContext.sessionDuration || 0;

    // Convert to minutes
    const minutes = duration / (60 * 1000);

    if (minutes < 10) {
      return 0.7; // Fresh, ready for autonomy
    } else if (minutes < 25) {
      return 0.5; // Good focus
    } else if (minutes < 40) {
      return 0.4; // Starting to fade
    } else if (minutes < 60) {
      return 0.3; // Tired, need guidance
    } else {
      return 0.2; // Very tired, need support
    }
  }

  /**
   * Convert numerical score to autonomy level
   * @private
   */
  _scoreToLevel(score) {
    if (score <= this.thresholds.studentLed) return this.levels.STUDENT_LED;
    if (score <= this.thresholds.guided) return this.levels.GUIDED;
    if (score <= this.thresholds.collaborative) return this.levels.COLLABORATIVE;
    if (score <= this.thresholds.mentored) return this.levels.MENTORED;
    return this.levels.TEACHER_LED;
  }

  /**
   * Convert level number to human-readable name
   * @private
   */
  _levelToName(level) {
    const map = {
      [this.levels.STUDENT_LED]: 'Student-Led',
      [this.levels.GUIDED]: 'Guided',
      [this.levels.COLLABORATIVE]: 'Collaborative',
      [this.levels.MENTORED]: 'Mentored',
      [this.levels.TEACHER_LED]: 'Teacher-Led'
    };
    return map[level] || 'Unknown';
  }

  /**
   * Get cached factor value
   * @private
   */
  _getCached(key) {
    const cached = this._factorCache.get(key);
    if (cached && Date.now() - cached.timestamp < this._cacheTimeout) {
      return cached.value;
    }
    return null;
  }

  /**
   * Cache factor value
   * @private
   */
  _cacheFactor(key, value) {
    this._factorCache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Clear factor cache
   */
  clearCache() {
    this._factorCache.clear();
    this.logger.info('[AutonomySpectrum] Cache cleared');
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return {
      weights: { ...this.weights },
      thresholds: { ...this.thresholds },
      cacheTimeout: this._cacheTimeout
    };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    if (newConfig.weights) {
      this.weights = { ...this.weights, ...newConfig.weights };
    }
    if (newConfig.thresholds) {
      this.thresholds = { ...this.thresholds, ...newConfig.thresholds };
    }
    if (newConfig.cacheTimeout !== undefined) {
      this._cacheTimeout = newConfig.cacheTimeout;
    }

    // Clear cache on config change
    this.clearCache();

    this.logger.info('[AutonomySpectrum] Config updated', this.getConfig());
  }
}

module.exports = AutonomySpectrum;
module.exports.AutonomyLevel = AutonomyLevel;