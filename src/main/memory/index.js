/**
 * Memory Manager — Main Entry Point
 * Exposes the complete Memory Manager API to the Agent Coordinator.
 * All student data is stored under: data/students/{studentId}/
 *
 * UPDATED: Added meta-learning support and evolution tracking
 *
 * This module is the ONLY entry point the rest of the application should use.
 * Internal sub-modules (student.js, mistakes.js, etc.) are not imported directly.
 */

'use strict';

const path = require('path');
const fs = require('fs');

const student        = require('./student');
const mistakes       = require('./mistakes');
const progress       = require('./progress');
const mastery        = require('./syllabus-mastery');
const examReadiness  = require('./exam-readiness');
const learningStyle  = require('./learning-style');
const velocity       = require('./velocity');
const affective      = require('./affective-history');

// Meta-learning imports (new)
const MetaLearningDB = require('./meta-learning-db');

class MemoryManager {
  /**
   * @param {string} dataRoot - Absolute path to the data/ directory
   *                            e.g. path.join(__dirname, '../../../data')
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance (optional)
   * @param {boolean} options.enableMetaLearning - Whether to enable meta-learning (default: true)
   */
  constructor(dataRoot, options = {}) {
    if (!dataRoot) throw new Error('MemoryManager: dataRoot is required');

    this.dataRoot = dataRoot;
    this.logger = options.logger || console;
    this.enableMetaLearning = options.enableMetaLearning !== false;

    // Cache for meta-learning instance
    this._metaDB = null;
    this._metaDBPromise = null;

    // Ensure the base students directory exists
    const studentsDir = path.join(dataRoot, 'students');
    if (!fs.existsSync(studentsDir)) {
      fs.mkdirSync(studentsDir, { recursive: true });
    }

    // Ensure meta-learning directory exists
    if (this.enableMetaLearning) {
      const metaDir = path.join(dataRoot, 'meta');
      if (!fs.existsSync(metaDir)) {
        fs.mkdirSync(metaDir, { recursive: true });
      }
    }

    this.logger.info('[MemoryManager] Initialized', {
      dataRoot,
      enableMetaLearning: this.enableMetaLearning
    });
  }

  // ============================================================
  // CONTEXT — used by the Student Model Module
  // ============================================================

  /**
   * Returns all raw student data in one call.
   * This is the primary method called by the Agent Coordinator
   * before passing data to the Student Model Module.
   *
   * @param {string} studentId
   * @returns {object} Full raw student context
   */
  getContext(studentId) {
    student.ensureStudentExists(this.dataRoot, studentId);

    const context = {
      studentId,
      profile:          student.getProfileParsed(this.dataRoot, studentId),
      mistakes:         mistakes.getMistakes(this.dataRoot, studentId),
      mistakeSummary:   mistakes.getMistakeSummary(this.dataRoot, studentId),
      progress:         progress.getProgress(this.dataRoot, studentId),
      syllabusMastery:  mastery.getSyllabusMastery(this.dataRoot, studentId),
      masteryProfile:   mastery.getMasteryProfile(this.dataRoot, studentId),
      masteryByTopic:   mastery.getMasteryByTopic(this.dataRoot, studentId),
      weakDotPoints:    mastery.getWeakDotPoints(this.dataRoot, studentId),
      examReadiness:    examReadiness.getExamReadiness(this.dataRoot, studentId),
      learningStyle:    learningStyle.getLearningStyle(this.dataRoot, studentId),
      velocity:         velocity.getVelocity(this.dataRoot, studentId),
      stallingTopics:   velocity.getStallingTopics(this.dataRoot, studentId),
      affectiveHistory: affective.getAffectiveHistory(this.dataRoot, studentId),
      currentAffective: affective.getCurrentAffectiveState(this.dataRoot, studentId),
    };

    // Add meta-learning data if enabled
    if (this.enableMetaLearning) {
      context.metaLearning = this._getMetaLearningContext(studentId);
    }

    return context;
  }

  /**
   * Get meta-learning context for a student
   * @private
   */
  _getMetaLearningContext(studentId) {
    try {
      const metaPath = path.join(this.dataRoot, 'meta', `${studentId}-patterns.json`);
      if (fs.existsSync(metaPath)) {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      }
    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to load meta-learning context:', err.message);
    }
    return null;
  }

  // ============================================================
  // ATTEMPTS & PROGRESS
  // ============================================================

  /**
   * Records a student's attempt on a problem.
   * Updates progress.json and mastery score for the dot-point.
   *
   * @param {string} studentId
   * @param {string} dotPoint   - NESA dot-point code e.g. "MA-C2.1"
   * @param {string} problem    - problem text or ID
   * @param {string} result     - student's answer summary
   * @param {boolean} isCorrect
   * @param {number} [scoreSignal] - optional 0.0–1.0 partial credit score (defaults to 0 or 1)
   * @param {string} [skillUsed] - name of skill that handled this attempt
   */
  recordAttempt(studentId, dotPoint, problem, result, isCorrect, scoreSignal = null, skillUsed = null) {
    // Record in progress log
    const attempt = progress.recordAttempt(
      this.dataRoot,
      studentId,
      dotPoint,
      problem,
      result,
      isCorrect,
      { skillUsed } // Pass additional metadata
    );

    // Update mastery score
    const signal = scoreSignal !== null ? scoreSignal : (isCorrect ? 1.0 : 0.0);
    mastery.updateDotPointMastery(this.dataRoot, studentId, dotPoint, signal, skillUsed);

    // Update velocity
    this._updateVelocityFromAttempt(studentId, dotPoint, isCorrect, signal);

    this.logger.debug('[MemoryManager] Recorded attempt', {
      studentId,
      dotPoint,
      isCorrect,
      skillUsed
    });
  }

  /**
   * Update velocity based on attempt
   * @private
   */
  _updateVelocityFromAttempt(studentId, dotPoint, isCorrect, scoreSignal) {
    try {
      // Extract topic from dot point (e.g., "MA-C2.1" -> "MA-C")
      const topicCode = dotPoint.split('.')[0];

      // Get topic label from syllabus if available
      const masteryData = mastery.getSyllabusMastery(this.dataRoot, studentId);
      const topicLabel = masteryData?.topics?.[topicCode]?.name || topicCode;

      // Calculate delta (change in mastery)
      const currentMastery = mastery.getMasteryProfile(this.dataRoot, studentId)[dotPoint] || 0;
      const delta = scoreSignal - currentMastery;

      // Update velocity
      velocity.updateVelocity(
        this.dataRoot,
        studentId,
        topicCode,
        topicLabel,
        delta,
        1 // One attempt
      );
    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to update velocity:', err.message);
    }
  }

  /**
   * Returns progress data for a student.
   */
  getProgress(studentId) {
    return progress.getProgress(this.dataRoot, studentId);
  }

  /**
   * Returns overall accuracy rate for a student.
   */
  getOverallAccuracy(studentId) {
    return progress.getOverallAccuracy(this.dataRoot, studentId);
  }

  /**
   * Get recent attempts for a student
   * @param {string} studentId
   * @param {number} limit - Maximum number of attempts to return
   * @returns {Array} Recent attempts
   */
  getRecentAttempts(studentId, limit = 20) {
    try {
      const progressData = progress.getProgress(this.dataRoot, studentId);
      const allAttempts = [];

      for (const session of progressData.sessions || []) {
        for (const attempt of session.attempts || []) {
          allAttempts.push({
            ...attempt,
            sessionDate: session.date
          });
        }
      }

      return allAttempts.slice(-limit).reverse();
    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to get recent attempts:', err.message);
      return [];
    }
  }

  // ============================================================
  // MISTAKES
  // ============================================================

  /**
   * Records a mistake entry.
   * @param {string} studentId
   * @param {object} mistake - { dotPoint, problem, studentAnswer, errorType, notes }
   */
  recordMistake(studentId, mistake) {
    mistakes.recordMistake(this.dataRoot, studentId, mistake);
  }

  /**
   * Returns all mistakes for a student.
   */
  getMistakes(studentId) {
    return mistakes.getMistakes(this.dataRoot, studentId);
  }

  /**
   * Returns mistakes for a specific dot-point.
   */
  getMistakesForDotPoint(studentId, dotPointCode) {
    return mistakes.getMistakesForDotPoint(this.dataRoot, studentId, dotPointCode);
  }

  /**
   * Returns mistake count by dot-point (for gap analysis).
   */
  getMistakeSummary(studentId) {
    return mistakes.getMistakeSummary(this.dataRoot, studentId);
  }

  // ============================================================
  // SYLLABUS MASTERY
  // ============================================================

  /**
   * Returns full syllabus mastery object.
   */
  getSyllabusMastery(studentId) {
    return mastery.getSyllabusMastery(this.dataRoot, studentId);
  }

  /**
   * Returns flat map of dotPointCode → score.
   */
  getMasteryProfile(studentId) {
    return mastery.getMasteryProfile(this.dataRoot, studentId);
  }

  /**
   * Returns mastery averaged by topic (MA-F, MA-C, etc.)
   */
  getMasteryByTopic(studentId) {
    return mastery.getMasteryByTopic(this.dataRoot, studentId);
  }

  /**
   * Returns dot-points below the given mastery threshold.
   */
  getWeakDotPoints(studentId, threshold = 0.6) {
    return mastery.getWeakDotPoints(this.dataRoot, studentId, threshold);
  }

  /**
   * Directly updates the mastery score for a dot-point.
   * Use this when a skill (e.g. marking-guideline-feedback) returns a scored result.
   */
  updateDotPointMastery(studentId, dotPointCode, scoreSignal, source) {
    return mastery.updateDotPointMastery(this.dataRoot, studentId, dotPointCode, scoreSignal, source);
  }

  /**
   * Get mastery history for a dot point
   * @param {string} studentId
   * @param {string} dotPointCode
   * @returns {Array} Mastery history
   */
  getMasteryHistory(studentId, dotPointCode) {
    try {
      const masteryData = mastery.getSyllabusMastery(this.dataRoot, studentId);
      return masteryData.history?.[dotPointCode] || [];
    } catch (err) {
      return [];
    }
  }

  // ============================================================
  // EXAM READINESS
  // ============================================================

  /**
   * Returns exam readiness data for a student.
   */
  getExamReadiness(studentId) {
    return examReadiness.getExamReadiness(this.dataRoot, studentId);
  }

  /**
   * Updates exam readiness scores (called by Student Model Module).
   */
  updateExamReadiness(studentId, overall, byTopic) {
    return examReadiness.updateExamReadiness(this.dataRoot, studentId, overall, byTopic);
  }

  // ============================================================
  // LEARNING STYLE
  // ============================================================

  /**
   * Returns the learning style profile for a student.
   */
  getLearningStyle(studentId) {
    return learningStyle.getLearningStyle(this.dataRoot, studentId);
  }

  /**
   * Updates the learning style based on a new observation.
   * Called by the detect-learning-style passive skill.
   */
  updateLearningStyle(studentId, signal) {
    return learningStyle.updateLearningStyle(this.dataRoot, studentId, signal);
  }

  // ============================================================
  // VELOCITY
  // ============================================================

  /**
   * Returns the velocity profile for a student.
   */
  getVelocity(studentId) {
    return velocity.getVelocity(this.dataRoot, studentId);
  }

  /**
   * Records a velocity update for a topic.
   * Called by the velocity-tracker passive skill.
   */
  updateVelocity(studentId, topicCode, topicLabel, delta, attempts) {
    return velocity.updateVelocity(this.dataRoot, studentId, topicCode, topicLabel, delta, attempts);
  }

  /**
   * Returns topics currently stalling or declining.
   */
  getStallingTopics(studentId) {
    return velocity.getStallingTopics(this.dataRoot, studentId);
  }

  /**
   * Get learning velocity trends
   * @param {string} studentId
   * @returns {Object} Velocity trends
   */
  getVelocityTrends(studentId) {
    try {
      const velocityData = velocity.getVelocity(this.dataRoot, studentId);
      const trends = {
        improving: [],
        stalling: [],
        declining: [],
        accelerating: [],
        decelerating: []
      };

      for (const [topic, data] of Object.entries(velocityData.topics || {})) {
        if (data.trend === 'improving') {
          if (data.velocityPerSession > 0.05) {
            trends.accelerating.push(topic);
          } else {
            trends.improving.push(topic);
          }
        } else if (data.trend === 'declining') {
          if (data.velocityPerSession < -0.05) {
            trends.decelerating.push(topic);
          } else {
            trends.declining.push(topic);
          }
        } else {
          trends.stalling.push(topic);
        }
      }

      return trends;
    } catch (err) {
      return {
        improving: [],
        stalling: [],
        declining: [],
        accelerating: [],
        decelerating: []
      };
    }
  }

  // ============================================================
  // AFFECTIVE STATE
  // ============================================================

  /**
   * Returns the full affective history for a student.
   */
  getAffectiveHistory(studentId) {
    return affective.getAffectiveHistory(this.dataRoot, studentId);
  }

  /**
   * Returns the current session's affective state.
   */
  getCurrentAffectiveState(studentId) {
    return affective.getCurrentAffectiveState(this.dataRoot, studentId);
  }

  /**
   * Records a new affective state signal.
   * Called by the engagement-tracker passive skill.
   */
  updateAffectiveState(studentId, signal) {
    return affective.updateAffectiveState(this.dataRoot, studentId, signal);
  }

  /**
   * Get affective trends over time
   * @param {string} studentId
   * @param {number} days - Number of days to analyze
   * @returns {Object} Affective trends
   */
  getAffectiveTrends(studentId, days = 7) {
    try {
      const history = affective.getAffectiveHistory(this.dataRoot, studentId);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const recent = history.sessions?.filter(s => new Date(s.date) >= cutoff) || [];

      const trends = {
        dominantStates: {},
        engagementTrend: 'stable',
        frustrationEpisodes: 0,
        confidenceEpisodes: 0
      };

      for (const session of recent) {
        trends.dominantStates[session.dominantState] =
          (trends.dominantStates[session.dominantState] || 0) + 1;

        for (const signal of session.signals || []) {
          if (signal.engagement === 'frustrated') {
            trends.frustrationEpisodes++;
          }
          if (signal.engagement === 'confident') {
            trends.confidenceEpisodes++;
          }
        }
      }

      // Determine engagement trend
      const recentSessions = recent.slice(-3);
      const recentStates = recentSessions.map(s => s.dominantState);

      if (recentStates.includes('frustrated') && recentStates.length >= 2) {
        trends.engagementTrend = 'declining';
      } else if (recentStates.includes('confident') && recentStates.length >= 2) {
        trends.engagementTrend = 'improving';
      }

      return trends;
    } catch (err) {
      return {
        dominantStates: {},
        engagementTrend: 'unknown',
        frustrationEpisodes: 0,
        confidenceEpisodes: 0
      };
    }
  }

  // ============================================================
  // STUDENT PROFILE
  // ============================================================

  /**
   * Returns the parsed student profile object.
   */
  getProfile(studentId) {
    return student.getProfileParsed(this.dataRoot, studentId);
  }

  /**
   * Saves an updated student profile.
   * @param {string} studentId
   * @param {object} profileData - { name, examDate, weeklyStudyHours, ... }
   */
  saveProfile(studentId, profileData) {
    return student.saveProfile(this.dataRoot, studentId, profileData);
  }

  // ============================================================
  // CONFIGURATION
  // ============================================================

  /**
   * Get configuration for a student
   * @param {string} studentId
   * @returns {Object} Configuration object
   */
  getConfig(studentId) {
    try {
      const configPath = path.join(this.dataRoot, 'students', studentId, 'config.json');
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to load config:', err.message);
    }
    return {};
  }

  /**
   * Save configuration for a student
   * @param {string} studentId
   * @param {Object} config - Configuration to save
   */
  saveConfig(studentId, config) {
    try {
      const studentDir = path.join(this.dataRoot, 'students', studentId);
      if (!fs.existsSync(studentDir)) {
        fs.mkdirSync(studentDir, { recursive: true });
      }

      const configPath = path.join(studentDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (err) {
      this.logger.error('[MemoryManager] Failed to save config:', err);
    }
  }

  // ============================================================
  // META-LEARNING METHODS (NEW)
  // ============================================================

  /**
   * Get meta-learning database instance
   * @private
   */
  async _getMetaDB() {
    if (!this.enableMetaLearning) {
      return null;
    }

    if (this._metaDB) {
      return this._metaDB;
    }

    if (this._metaDBPromise) {
      return this._metaDBPromise;
    }

    this._metaDBPromise = (async () => {
      try {
        const db = new MetaLearningDB({
          dataRoot: path.join(this.dataRoot, 'meta'),
          logger: this.logger,
          config: {
            maxHistoryPerStrategy: 100,
            minSamplesForPrediction: 10,
            autoSaveInterval: 60000 // 1 minute
          }
        });

        await db._initialize();
        this._metaDB = db;
        this._metaDBPromise = null;

        this.logger.debug('[MemoryManager] Meta-learning DB initialized');
        return db;
      } catch (err) {
        this.logger.error('[MemoryManager] Failed to initialize meta-learning DB:', err);
        this._metaDBPromise = null;
        return null;
      }
    })();

    return this._metaDBPromise;
  }

  /**
   * Record teaching strategy outcome
   * @param {string} studentId
   * @param {Object} strategy - Strategy used
   * @param {Object} outcome - Outcome metrics
   */
  async recordStrategyOutcome(studentId, strategy, outcome) {
    if (!this.enableMetaLearning) return;

    try {
      const db = await this._getMetaDB();
      if (!db) return;

      // Get student context
      const profile = this.getProfile(studentId);
      const learningStyle = this.getLearningStyle(studentId);
      const affective = this.getCurrentAffectiveState(studentId);

      await db.recordStrategyOutcome(
        strategy,
        {
          studentId,
          masteryLevel: this.getOverallAccuracy(studentId) || 0.5,
          learningStyle: learningStyle?.preferredRepresentation || 'unknown',
          affectiveState: affective?.currentEngagement || 'focused',
          sessionDuration: this._getSessionDuration(studentId),
          interactionCount: this._getInteractionCount(studentId)
        },
        outcome
      );

    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to record strategy outcome:', err.message);
    }
  }

  /**
   * Find best strategy for student and topic
   * @param {string} studentId
   * @param {string} topic
   * @param {Array} availableStrategies
   * @returns {Promise<Object|null>}
   */
  async findBestStrategy(studentId, topic, availableStrategies) {
    if (!this.enableMetaLearning) return null;

    try {
      const db = await this._getMetaDB();
      if (!db) return null;

      const profile = this.getProfile(studentId);
      const learningStyle = this.getLearningStyle(studentId);
      const affective = this.getCurrentAffectiveState(studentId);

      const studentProfile = {
        masteryLevel: this.getOverallAccuracy(studentId) || 0.5,
        learningStyle: learningStyle?.preferredRepresentation || 'unknown',
        affectiveState: affective?.currentEngagement || 'focused'
      };

      return await db.findBestStrategy(studentProfile, topic, availableStrategies);

    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to find best strategy:', err.message);
      return null;
    }
  }

  /**
   * Get learning opportunities for a student
   * @param {string} studentId
   * @returns {Promise<Array>}
   */
  async getLearningOpportunities(studentId) {
    try {
      const oppPath = path.join(this.dataRoot, 'meta', `${studentId}-opportunities.json`);
      if (fs.existsSync(oppPath)) {
        return JSON.parse(fs.readFileSync(oppPath, 'utf8'));
      }
    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to load opportunities:', err.message);
    }
    return [];
  }

  /**
   * Store learning opportunities for a student
   * @param {string} studentId
   * @param {Array} opportunities
   */
  async storeLearningOpportunities(studentId, opportunities) {
    try {
      const metaDir = path.join(this.dataRoot, 'meta');
      if (!fs.existsSync(metaDir)) {
        fs.mkdirSync(metaDir, { recursive: true });
      }

      const oppPath = path.join(metaDir, `${studentId}-opportunities.json`);

      let existing = [];
      if (fs.existsSync(oppPath)) {
        existing = JSON.parse(fs.readFileSync(oppPath, 'utf8'));
      }

      // Add new opportunities with timestamps
      const newOpps = opportunities.map(opp => ({
        ...opp,
        studentId,
        detectedAt: new Date().toISOString(),
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      }));

      const all = [...existing, ...newOpps];

      // Keep only last 100
      if (all.length > 100) {
        all.splice(0, all.length - 100);
      }

      fs.writeFileSync(oppPath, JSON.stringify(all, null, 2), 'utf8');

    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to store opportunities:', err.message);
    }
  }

  /**
   * Get last evolution time
   * @param {string} studentId
   * @returns {number|null}
   */
  getLastEvolutionTime(studentId) {
    try {
      const metaPath = path.join(this.dataRoot, 'meta', 'evolution.json');
      if (!fs.existsSync(metaPath)) return null;

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      return meta.lastEvolutionTime || null;
    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to get last evolution time:', err.message);
      return null;
    }
  }

  /**
   * Record evolution time
   * @param {string} studentId
   * @param {number} timestamp
   */
  recordEvolutionTime(studentId, timestamp) {
    try {
      const metaPath = path.join(this.dataRoot, 'meta', 'evolution.json');
      let meta = {};

      if (fs.existsSync(metaPath)) {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      }

      meta.lastEvolutionTime = timestamp;
      meta.lastEvolutionDate = new Date(timestamp).toISOString();
      meta.lastEvolutionStudent = studentId;

      // Track evolution history
      if (!meta.history) meta.history = [];
      meta.history.push({
        timestamp,
        date: new Date(timestamp).toISOString(),
        studentId
      });

      // Keep last 50 evolutions
      if (meta.history.length > 50) {
        meta.history = meta.history.slice(-50);
      }

      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

      this.logger.info('[MemoryManager] Recorded evolution', { studentId, timestamp });

    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to record evolution time:', err.message);
    }
  }

  /**
   * Get meta-learning statistics
   * @param {string} studentId
   * @returns {Promise<Object>}
   */
  async getMetaLearningStats(studentId) {
    if (!this.enableMetaLearning) {
      return { enabled: false };
    }

    try {
      const db = await this._getMetaDB();
      if (!db) {
        return { enabled: true, error: 'Database not available' };
      }

      const stats = db.getStats();

      // Add student-specific stats
      const opportunities = await this.getLearningOpportunities(studentId);

      return {
        enabled: true,
        ...stats,
        studentOpportunities: opportunities.length,
        lastEvolution: this.getLastEvolutionTime(studentId)
      };

    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to get meta-learning stats:', err.message);
      return { enabled: true, error: err.message };
    }
  }

  /**
   * Get session duration for a student
   * @private
   */
  _getSessionDuration(studentId) {
    try {
      const progress = this.getProgress(studentId);
      const today = new Date().toISOString().split('T')[0];
      const session = progress.sessions?.find(s => s.date === today);

      if (session && session.attempts?.length > 0) {
        const firstAttempt = new Date(session.attempts[0].timestamp);
        const lastAttempt = new Date(session.attempts[session.attempts.length - 1].timestamp);
        return lastAttempt - firstAttempt;
      }
    } catch (err) {
      // Ignore
    }
    return 0;
  }

  /**
   * Get interaction count for a student
   * @private
   */
  _getInteractionCount(studentId) {
    try {
      const progress = this.getProgress(studentId);
      return progress.totalAttempts || 0;
    } catch (err) {
      return 0;
    }
  }

  /**
   * Clear all data for a student (for testing)
   * @param {string} studentId
   */
  clearStudentData(studentId) {
    try {
      const studentDir = path.join(this.dataRoot, 'students', studentId);
      if (fs.existsSync(studentDir)) {
        fs.rmSync(studentDir, { recursive: true, force: true });
        this.logger.info('[MemoryManager] Cleared student data', { studentId });
      }
    } catch (err) {
      this.logger.error('[MemoryManager] Failed to clear student data:', err);
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage stats
   */
  getStorageStats() {
    try {
      const studentsDir = path.join(this.dataRoot, 'students');
      if (!fs.existsSync(studentsDir)) {
        return { students: 0, totalSize: 0 };
      }

      const students = fs.readdirSync(studentsDir);
      let totalSize = 0;

      for (const student of students) {
        const studentPath = path.join(studentsDir, student);
        const stats = fs.statSync(studentPath);
        totalSize += stats.size;
      }

      return {
        students: students.length,
        totalSize,
        dataRoot: this.dataRoot
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ============================================================
  // SESSION PERSISTENCE
  // ============================================================

  /**
   * Save a teaching model's sessionState to disk.
   * Called after each question answered so students can resume mid-test.
   *
   * @param {string} studentId
   * @param {string} modelId   - e.g. 'test-led', 'teacher-led'
   * @param {object} state     - the model's full sessionState object
   */
  saveSessionState(studentId, modelId, state) {
    try {
      const dir = path.join(this.dataRoot, 'students', studentId, 'sessions');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const filePath = path.join(dir, `${modelId}-session.json`);

      // Sanitise state before serialising — strip any circular references or
      // non-serialisable objects (class instances, functions, skill managers, etc.)
      // The sessionState may contain back-references to the teaching model itself.
      const sanitised = JSON.parse(JSON.stringify(state, (key, value) => {
        // Drop keys that are known to hold circular refs or non-serialisable objects
        if (key === 'teachingModel' || key === 'memory' || key === 'skillManager' ||
            key === 'model' || key === 'knowledgeBase' || key === 'studentModel') {
          return undefined;
        }
        // Drop class instances (anything with a constructor that isn't plain Object/Array)
        if (value !== null && typeof value === 'object' &&
            value.constructor && value.constructor !== Object && value.constructor !== Array) {
          return undefined;
        }
        // Drop functions
        if (typeof value === 'function') return undefined;
        return value;
      }));

      const payload = {
        modelId,
        studentId,
        savedAt: new Date().toISOString(),
        state: sanitised,
      };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
      this.logger.debug('[MemoryManager] Session saved', { studentId, modelId });
    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to save session state:', err.message);
    }
  }

  /**
   * Load a previously saved sessionState from disk.
   * Returns null if no saved session exists or if it has expired (> 24 hours).
   *
   * @param {string} studentId
   * @param {string} modelId
   * @param {number} [maxAgeMs=86400000] - Max age before session is considered stale (default 24h)
   * @returns {object|null} The saved state, or null
   */
  loadSessionState(studentId, modelId, maxAgeMs = 24 * 60 * 60 * 1000) {
    try {
      const filePath = path.join(
        this.dataRoot, 'students', studentId, 'sessions', `${modelId}-session.json`
      );
      if (!fs.existsSync(filePath)) return null;

      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Reject stale sessions
      const age = Date.now() - new Date(payload.savedAt).getTime();
      if (age > maxAgeMs) {
        this.logger.info('[MemoryManager] Stale session discarded', { studentId, modelId, ageHours: (age / 3600000).toFixed(1) });
        fs.unlinkSync(filePath);
        return null;
      }

      this.logger.info('[MemoryManager] Session restored', { studentId, modelId, savedAt: payload.savedAt });
      return payload.state;
    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to load session state:', err.message);
      return null;
    }
  }

  /**
   * Delete a saved session (call after test completes or session ends cleanly).
   *
   * @param {string} studentId
   * @param {string} modelId
   */
  clearSessionState(studentId, modelId) {
    try {
      const filePath = path.join(
        this.dataRoot, 'students', studentId, 'sessions', `${modelId}-session.json`
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug('[MemoryManager] Session cleared', { studentId, modelId });
      }
    } catch (err) {
      this.logger.warn('[MemoryManager] Failed to clear session state:', err.message);
    }
  }

  /**
   * Clean up resources (call on app shutdown)
   */
  async shutdown() {
    if (this._metaDB) {
      await this._metaDB.close();
      this._metaDB = null;
    }
    this.logger.info('[MemoryManager] Shutdown complete');
  }
}

module.exports = MemoryManager;