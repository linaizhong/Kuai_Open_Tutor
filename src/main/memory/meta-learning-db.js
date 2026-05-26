/**
 * Meta-Learning Database
 * Tracks teaching strategy effectiveness and learns from patterns
 *
 * @module memory/meta-learning-db
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Custom error classes
class MetaLearningError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'MetaLearningError';
    this.cause = cause;
    this.timestamp = new Date().toISOString();
  }
}

class DatabaseError extends MetaLearningError {
  constructor(message, cause = null) {
    super(message, cause);
    this.name = 'DatabaseError';
  }
}

class ValidationError extends MetaLearningError {
  constructor(message, cause = null) {
    super(message, cause);
    this.name = 'ValidationError';
  }
}

/**
 * Meta-Learning Database
 * Persists and queries teaching strategy effectiveness data
 */
class MetaLearningDB {
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.dataRoot - Absolute path to data directory
   * @param {Object} options.logger - Logger instance (optional)
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    const { dataRoot, logger = console, config = {} } = options;

    if (!dataRoot) {
      throw new MetaLearningError('dataRoot is required');
    }

    this.dataRoot = dataRoot;
    this.logger = logger;
    this.config = {
      maxHistoryPerStrategy: config.maxHistoryPerStrategy || 100,
      minSamplesForPrediction: config.minSamplesForPrediction || 10,
      cacheTimeout: config.cacheTimeout || 5 * 60 * 1000, // 5 minutes
      autoSaveInterval: config.autoSaveInterval || 60 * 1000, // 1 minute
      ...config
    };

    this.dbPath = path.join(dataRoot, 'meta-learning.json');
    this.data = null;
    this.cache = new Map();
    this.dirty = false;
    this.saveTimer = null;

    // Initialize
    this._initialize();
  }

  /**
   * Initialize database
   * @private
   */
  async _initialize() {
    try {
      await this._ensureDataDirectory();
      await this._load();
      this._startAutoSave();

      this.logger.info('[MetaLearningDB] Initialized', {
        path: this.dbPath,
        stats: this.getStats()
      });
    } catch (err) {
      this.logger.error('[MetaLearningDB] Initialization failed:', err);
      throw new DatabaseError('Failed to initialize database', err);
    }
  }

  /**
   * Ensure data directory exists
   * @private
   */
  async _ensureDataDirectory() {
    try {
      const dir = path.dirname(this.dbPath);
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      throw new DatabaseError('Failed to create data directory', err);
    }
  }

  /**
   * Load database from disk
   * @private
   */
  async _load() {
    try {
      const exists = await fs.access(this.dbPath).then(() => true).catch(() => false);

      if (exists) {
        const content = await fs.readFile(this.dbPath, 'utf8');
        this.data = JSON.parse(content);
        this.logger.debug('[MetaLearningDB] Loaded from disk');
      } else {
        this.data = this._createEmptyData();
        this.logger.debug('[MetaLearningDB] Created new database');
      }

      this.dirty = false;
    } catch (err) {
      throw new DatabaseError('Failed to load database', err);
    }
  }

  /**
   * Create empty database structure
   * @private
   */
  _createEmptyData() {
    return {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),

      // Teaching strategies and their effectiveness
      teachingStrategies: {},

      // Student patterns across sessions
      studentPatterns: {},

      // Strategy effectiveness metrics
      strategyEffectiveness: {},

      // Historical adaptations
      adaptations: [],

      // Global statistics
      stats: {
        totalInteractions: 0,
        totalStrategies: 0,
        totalPatterns: 0,
        totalAdaptations: 0
      }
    };
  }

  /**
   * Start auto-save timer
   * @private
   */
  _startAutoSave() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }

    this.saveTimer = setInterval(async () => {
      if (this.dirty) {
        await this.save().catch(err => {
          this.logger.error('[MetaLearningDB] Auto-save failed:', err);
        });
      }
    }, this.config.autoSaveInterval);
  }

  /**
   * Save database to disk
   * @returns {Promise<boolean>} Success
   */
  async save() {
    if (!this.dirty) return true;

    try {
      this.data.lastUpdated = new Date().toISOString();

      // Write to temp file first
      const tempPath = `${this.dbPath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.data, null, 2), 'utf8');

      // Rename temp to actual (atomic on most systems)
      await fs.rename(tempPath, this.dbPath);

      this.dirty = false;
      this.logger.debug('[MetaLearningDB] Saved to disk');

      return true;
    } catch (err) {
      throw new DatabaseError('Failed to save database', err);
    }
  }

  /**
   * Record teaching strategy outcome
   *
   * @param {Object} strategy - Strategy used
   * @param {string} strategy.type - Strategy type (e.g., 'explain-concept')
   * @param {string} strategy.topic - Topic code
   * @param {Object} strategy.parameters - Strategy parameters
   * @param {Object} studentContext - Student context
   * @param {number} studentContext.masteryLevel - Current mastery (0-1)
   * @param {string} studentContext.learningStyle - Learning style
   * @param {string} studentContext.affectiveState - Affective state
   * @param {Object} outcome - Outcome metrics
   * @param {boolean} outcome.success - Whether strategy succeeded
   * @param {number} outcome.score - Success score (0-1)
   * @param {number} outcome.engagement - Engagement level (0-1)
   * @param {number} outcome.learningGain - Learning gain (0-1)
   * @returns {Promise<Object>} Recorded outcome
   */
  async recordStrategyOutcome(strategy, studentContext, outcome) {
    const recordId = crypto.randomBytes(8).toString('hex');
    const timestamp = new Date().toISOString();

    this.logger.info(`[MetaLearningDB:${recordId}] Recording strategy outcome`, {
      strategy: strategy.type,
      topic: strategy.topic
    });

    try {
      // Validate inputs
      this._validateStrategy(strategy);
      this._validateStudentContext(studentContext);
      this._validateOutcome(outcome);

      // Create composite key
      const strategyKey = this._createStrategyKey(strategy);

      // Initialize strategy record if needed
      if (!this.data.teachingStrategies[strategyKey]) {
        this.data.teachingStrategies[strategyKey] = {
          type: strategy.type,
          topic: strategy.topic,
          parameters: strategy.parameters,
          firstUsed: timestamp,
          lastUsed: timestamp,
          totalAttempts: 0,
          totalSuccesses: 0,
          totalScore: 0,
          totalEngagement: 0,
          totalLearningGain: 0,
          studentProfiles: [],
          outcomes: []
        };
        this.data.stats.totalStrategies++;
      }

      const record = this.data.teachingStrategies[strategyKey];
      record.lastUsed = timestamp;
      record.totalAttempts++;

      if (outcome.success) {
        record.totalSuccesses++;
      }

      record.totalScore += outcome.score || 0;
      record.totalEngagement += outcome.engagement || 0;
      record.totalLearningGain += outcome.learningGain || 0;

      // Create student profile snapshot
      const studentProfile = {
        id: `${studentContext.studentId}-${Date.now()}`,
        masteryLevel: studentContext.masteryLevel,
        learningStyle: studentContext.learningStyle,
        affectiveState: studentContext.affectiveState,
        outcome: {
          success: outcome.success,
          score: outcome.score,
          engagement: outcome.engagement,
          learningGain: outcome.learningGain
        },
        timestamp
      };

      // Store outcome
      const outcomeRecord = {
        id: recordId,
        strategy: strategy.type,
        topic: strategy.topic,
        studentId: studentContext.studentId,
        studentProfile: {
          masteryLevel: studentContext.masteryLevel,
          learningStyle: studentContext.learningStyle,
          affectiveState: studentContext.affectiveState
        },
        outcome: {
          success: outcome.success,
          score: outcome.score,
          engagement: outcome.engagement,
          learningGain: outcome.learningGain
        },
        context: {
          sessionDuration: studentContext.sessionDuration,
          interactionCount: studentContext.interactionCount
        },
        timestamp
      };

      record.studentProfiles.push(studentProfile);
      record.outcomes.push(outcomeRecord);

      // Enforce size limits
      if (record.studentProfiles.length > this.config.maxHistoryPerStrategy) {
        record.studentProfiles = record.studentProfiles.slice(-this.config.maxHistoryPerStrategy);
        record.outcomes = record.outcomes.slice(-this.config.maxHistoryPerStrategy);
      }

      // Update strategy effectiveness metrics
      await this._updateStrategyEffectiveness(strategyKey);

      // Update student pattern if studentId exists
      if (studentContext.studentId) {
        await this._updateStudentPattern(studentContext.studentId, strategy, outcome);
      }

      // Update global stats
      this.data.stats.totalInteractions++;
      this.data.stats.totalAdaptations = this.data.adaptations.length;

      // Mark as dirty
      this.dirty = true;

      // Invalidate cache for this strategy
      this.cache.delete(`strategy:${strategyKey}`);
      this.cache.delete(`effectiveness:${strategyKey}`);

      return outcomeRecord;

    } catch (err) {
      this.logger.error(`[MetaLearningDB:${recordId}] Failed to record outcome:`, err);

      if (err instanceof ValidationError) {
        throw err;
      }
      throw new DatabaseError('Failed to record strategy outcome', err);
    }
  }

  /**
   * Find best strategy for given student and topic
   *
   * @param {Object} studentProfile - Student profile
   * @param {string} topic - Topic code
   * @param {Array} availableStrategies - Available strategy types
   * @returns {Promise<Object|null>} Best strategy recommendation
   */
  async findBestStrategy(studentProfile, topic, availableStrategies) {
    const startTime = Date.now();
    const searchId = crypto.randomBytes(4).toString('hex');

    this.logger.info(`[MetaLearningDB:${searchId}] Finding best strategy`, {
      topic,
      studentMastery: studentProfile.masteryLevel,
      learningStyle: studentProfile.learningStyle
    });

    try {
      // Check cache
      const cacheKey = `best:${topic}:${studentProfile.learningStyle}:${studentProfile.masteryLevel}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
        this.logger.debug(`[MetaLearningDB:${searchId}] Cache hit`);
        return cached.value;
      }

      let bestStrategy = null;
      let bestScore = -1;
      const recommendations = [];

      // Build candidate strategies for this topic
      const candidates = this._buildCandidates(topic, availableStrategies);

      for (const candidate of candidates) {
        const strategyKey = this._createStrategyKey(candidate);
        const effectiveness = this.data.strategyEffectiveness[strategyKey];

        if (!effectiveness || effectiveness.totalSamples < this.config.minSamplesForPrediction) {
          continue; // Not enough data yet
        }

        // Find similar students who used this strategy
        const similarOutcomes = await this._findSimilarOutcomes(
          candidate,
          studentProfile,
          effectiveness
        );

        if (similarOutcomes.length === 0) {
          continue;
        }

        // Calculate expected success
        const expectedScore = similarOutcomes.reduce((sum, o) => sum + o.score, 0) / similarOutcomes.length;
        const confidence = Math.min(1, similarOutcomes.length / 20); // More samples = higher confidence

        const totalScore = expectedScore * confidence;

        recommendations.push({
          strategy: candidate,
          expectedScore,
          confidence,
          totalScore,
          sampleSize: similarOutcomes.length
        });

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestStrategy = candidate;
        }
      }

      const result = {
        strategy: bestStrategy,
        score: bestScore,
        recommendations: recommendations.sort((a, b) => b.totalScore - a.totalScore),
        timestamp: new Date().toISOString()
      };

      // Cache result
      this.cache.set(cacheKey, {
        value: result,
        timestamp: Date.now()
      });

      const duration = Date.now() - startTime;
      this.logger.info(`[MetaLearningDB:${searchId}] Found best strategy`, {
        hasStrategy: !!bestStrategy,
        recommendations: recommendations.length,
        duration
      });

      return result;

    } catch (err) {
      this.logger.error(`[MetaLearningDB:${searchId}] Failed to find best strategy:`, err);
      return null;
    }
  }

  /**
   * Record an adaptation (when system changes strategy)
   *
   * @param {Object} adaptation - Adaptation record
   * @param {string} adaptation.fromStrategy - Previous strategy
   * @param {string} adaptation.toStrategy - New strategy
   * @param {string} adaptation.reason - Why adaptation occurred
   * @param {Object} adaptation.context - Context at adaptation time
   * @returns {Promise<Object>} Recorded adaptation
   */
  async recordAdaptation(adaptation) {
    const adaptationId = crypto.randomBytes(8).toString('hex');
    const timestamp = new Date().toISOString();

    try {
      const record = {
        id: adaptationId,
        fromStrategy: adaptation.fromStrategy,
        toStrategy: adaptation.toStrategy,
        reason: adaptation.reason,
        context: adaptation.context,
        timestamp,
        effectiveness: null // To be filled later
      };

      this.data.adaptations.push(record);

      // Keep last 1000 adaptations
      if (this.data.adaptations.length > 1000) {
        this.data.adaptations = this.data.adaptations.slice(-1000);
      }

      this.dirty = true;

      return record;

    } catch (err) {
      this.logger.error('[MetaLearningDB] Failed to record adaptation:', err);
      throw new DatabaseError('Failed to record adaptation', err);
    }
  }

  /**
   * Update adaptation with effectiveness outcome
   *
   * @param {string} adaptationId - Adaptation ID
   * @param {Object} effectiveness - Effectiveness metrics
   */
  async updateAdaptationEffectiveness(adaptationId, effectiveness) {
    try {
      const adaptation = this.data.adaptations.find(a => a.id === adaptationId);
      if (adaptation) {
        adaptation.effectiveness = effectiveness;
        adaptation.evaluatedAt = new Date().toISOString();
        this.dirty = true;
      }
    } catch (err) {
      this.logger.error('[MetaLearningDB] Failed to update adaptation:', err);
    }
  }

  /**
   * Get strategy effectiveness metrics
   *
   * @param {Object} strategy - Strategy to analyze
   * @returns {Object} Effectiveness metrics
   */
  getStrategyEffectiveness(strategy) {
    const strategyKey = this._createStrategyKey(strategy);
    return this.data.strategyEffectiveness[strategyKey] || null;
  }

  /**
   * Get global statistics
   * @returns {Object} Database statistics
   */
  getStats() {
    return {
      ...this.data.stats,
      strategiesCount: Object.keys(this.data.teachingStrategies).length,
      patternsCount: Object.keys(this.data.studentPatterns).length,
      adaptationsCount: this.data.adaptations.length,
      cacheSize: this.cache.size,
      dirty: this.dirty
    };
  }

  /**
   * Get learning patterns for a student
   *
   * @param {string} studentId - Student ID
   * @returns {Object|null} Student learning patterns
   */
  getStudentPatterns(studentId) {
    return this.data.studentPatterns[studentId] || null;
  }

  /**
   * Get recent adaptations
   *
   * @param {number} limit - Maximum number to return
   * @returns {Array} Recent adaptations
   */
  getRecentAdaptations(limit = 50) {
    return this.data.adaptations.slice(-limit).reverse();
  }

  /**
   * Get top performing strategies
   *
   * @param {string} topic - Topic code (optional)
   * @param {number} limit - Maximum number to return
   * @returns {Array} Top strategies
   */
  getTopStrategies(topic = null, limit = 10) {
    const strategies = Object.entries(this.data.strategyEffectiveness)
      .map(([key, effectiveness]) => ({
        key,
        ...effectiveness
      }))
      .filter(s => !topic || s.topic === topic)
      .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
      .slice(0, limit);

    return strategies;
  }

  /**
   * Update strategy effectiveness metrics
   * @private
   */
  async _updateStrategyEffectiveness(strategyKey) {
    const strategy = this.data.teachingStrategies[strategyKey];
    if (!strategy || strategy.totalAttempts === 0) return;

    const effectiveness = {
      strategyKey,
      type: strategy.type,
      topic: strategy.topic,
      totalSamples: strategy.totalAttempts,
      successRate: strategy.totalSuccesses / strategy.totalAttempts,
      averageScore: strategy.totalScore / strategy.totalAttempts,
      averageEngagement: strategy.totalEngagement / strategy.totalAttempts,
      averageLearningGain: strategy.totalLearningGain / strategy.totalAttempts,
      lastUpdated: new Date().toISOString()
    };

    this.data.strategyEffectiveness[strategyKey] = effectiveness;
  }

  /**
   * Update student pattern
   * @private
   */
  async _updateStudentPattern(studentId, strategy, outcome) {
    if (!this.data.studentPatterns[studentId]) {
      this.data.studentPatterns[studentId] = {
        studentId,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        totalInteractions: 0,
        strategiesUsed: {},
        effectiveness: {},
        patterns: []
      };
      this.data.stats.totalPatterns++;
    }

    const pattern = this.data.studentPatterns[studentId];
    pattern.lastSeen = new Date().toISOString();
    pattern.totalInteractions++;

    // Track strategy usage
    const strategyKey = this._createStrategyKey(strategy);
    if (!pattern.strategiesUsed[strategyKey]) {
      pattern.strategiesUsed[strategyKey] = {
        count: 0,
        successes: 0,
        totalScore: 0
      };
    }

    const usage = pattern.strategiesUsed[strategyKey];
    usage.count++;
    if (outcome.success) {
      usage.successes++;
    }
    usage.totalScore += outcome.score || 0;

    // Store learning pattern
    pattern.patterns.push({
      strategy: strategy.type,
      topic: strategy.topic,
      outcome: outcome.success,
      score: outcome.score,
      timestamp: new Date().toISOString()
    });

    // Keep last 100 patterns
    if (pattern.patterns.length > 100) {
      pattern.patterns = pattern.patterns.slice(-100);
    }
  }

  /**
   * Find similar outcomes for a candidate strategy
   * @private
   */
  async _findSimilarOutcomes(strategy, studentProfile, effectiveness) {
    const strategyKey = this._createStrategyKey(strategy);
    const strategyData = this.data.teachingStrategies[strategyKey];

    if (!strategyData) return [];

    return strategyData.studentProfiles
      .filter(profile => this._isProfileSimilar(profile, studentProfile))
      .map(profile => profile.outcome);
  }

  /**
   * Check if two student profiles are similar
   * @private
   */
  _isProfileSimilar(profileA, profileB) {
    let similarity = 0;

    // Learning style match (high weight)
    if (profileA.learningStyle === profileB.learningStyle) {
      similarity += 0.4;
    }

    // Affective state match (medium weight)
    if (profileA.affectiveState === profileB.affectiveState) {
      similarity += 0.3;
    }

    // Mastery level similarity (lower weight, but consider proximity)
    const masteryDiff = Math.abs(profileA.masteryLevel - profileB.masteryLevel);
    if (masteryDiff < 0.1) {
      similarity += 0.3;
    } else if (masteryDiff < 0.2) {
      similarity += 0.2;
    } else if (masteryDiff < 0.3) {
      similarity += 0.1;
    }

    return similarity >= 0.5; // Threshold for "similar"
  }

  /**
   * Build candidate strategies for topic
   * @private
   */
  _buildCandidates(topic, availableStrategies) {
    const candidates = [];

    for (const strategyType of availableStrategies) {
      // Check if we have data for this strategy+topic combination
      const strategyKey = this._createStrategyKey({ type: strategyType, topic });

      if (this.data.strategyEffectiveness[strategyKey]) {
        candidates.push({
          type: strategyType,
          topic
        });
      }
    }

    // If no candidates with data, return all available strategies
    if (candidates.length === 0) {
      return availableStrategies.map(type => ({
        type,
        topic
      }));
    }

    return candidates;
  }

  /**
   * Create unique key for strategy
   * @private
   */
  _createStrategyKey(strategy) {
    return `${strategy.type}:${strategy.topic}`;
  }

  /**
   * Validate strategy object
   * @private
   */
  _validateStrategy(strategy) {
    if (!strategy || typeof strategy !== 'object') {
      throw new ValidationError('Strategy must be an object');
    }

    if (!strategy.type || typeof strategy.type !== 'string') {
      throw new ValidationError('Strategy type is required and must be a string');
    }

    if (!strategy.topic || typeof strategy.topic !== 'string') {
      throw new ValidationError('Strategy topic is required and must be a string');
    }
  }

  /**
   * Validate student context
   * @private
   */
  _validateStudentContext(context) {
    if (!context || typeof context !== 'object') {
      throw new ValidationError('Student context must be an object');
    }

    if (context.masteryLevel !== undefined &&
        (typeof context.masteryLevel !== 'number' ||
         context.masteryLevel < 0 || context.masteryLevel > 1)) {
      throw new ValidationError('masteryLevel must be a number between 0 and 1');
    }

    if (context.learningStyle && typeof context.learningStyle !== 'string') {
      throw new ValidationError('learningStyle must be a string');
    }

    if (context.affectiveState && typeof context.affectiveState !== 'string') {
      throw new ValidationError('affectiveState must be a string');
    }
  }

  /**
   * Validate outcome object
   * @private
   */
  _validateOutcome(outcome) {
    if (!outcome || typeof outcome !== 'object') {
      throw new ValidationError('Outcome must be an object');
    }

    if (typeof outcome.success !== 'boolean') {
      throw new ValidationError('outcome.success must be a boolean');
    }

    if (outcome.score !== undefined &&
        (typeof outcome.score !== 'number' || outcome.score < 0 || outcome.score > 1)) {
      throw new ValidationError('outcome.score must be a number between 0 and 1');
    }

    if (outcome.engagement !== undefined &&
        (typeof outcome.engagement !== 'number' || outcome.engagement < 0 || outcome.engagement > 1)) {
      throw new ValidationError('outcome.engagement must be a number between 0 and 1');
    }

    if (outcome.learningGain !== undefined &&
        (typeof outcome.learningGain !== 'number' || outcome.learningGain < -1 || outcome.learningGain > 1)) {
      throw new ValidationError('outcome.learningGain must be a number between -1 and 1');
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.logger.debug('[MetaLearningDB] Cache cleared');
  }

  /**
   * Close database (cleanup)
   */
  async close() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }

    if (this.dirty) {
      await this.save();
    }

    this.logger.info('[MetaLearningDB] Closed');
  }
}

module.exports = MetaLearningDB;