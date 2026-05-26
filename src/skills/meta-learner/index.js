/**
 * Meta-Learner Skill
 * Passive skill that observes interactions and feeds data into meta-learning system
 *
 * @module skills/meta-learner
 */

'use strict';

const path = require('path');
const MetaLearningDB = require('../../memory/meta-learning-db');
const StrategyEvolution = require('../../memory/strategy-evolution');

// Custom error class - but always fail gracefully (passive skill)
class MetaLearnerError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'MetaLearnerError';
    this.cause = cause;
  }
}

module.exports = {
  meta: {
    name: 'meta-learner',
    version: '1.0.0',
    type: 'passive',
    category: 'core',
    description: 'Observes teaching interactions and learns patterns to improve future teaching'
  },

  /**
   * Execute meta-learner passive skill
   * Runs after every interaction to collect data and trigger evolution when needed
   *
   * @param {Object} params - Skill parameters
   * @param {string} params.userInput - Student's input
   * @param {string} params.response - System's response
   * @param {boolean} params.isCorrect - Whether answer was correct
   * @param {number} params.scoreSignal - Score if available (0-1)
   * @param {string} params.dotPoint - Dot point code if applicable
   * @param {string} params.skillUsed - Name of skill that was used
   * @param {number} params.sessionAttempts - Total attempts this session
   * @param {number} params.recentAccuracy - Recent accuracy rate
   * @param {Object} params.masteryBefore - Mastery before interaction
   * @param {Object} params.masteryAfter - Mastery after interaction
   * @param {Object} context - Execution context
   * @param {string} context.studentId - Student ID
   * @param {Object} context.memory - MemoryManager instance
   * @param {Object} context.studentModel - Current student model
   * @param {Object} context.model - ModelManager instance
   * @param {Object} context.knowledgeBase - Knowledge base
   * @param {Object} context.skillManager - SkillManager instance
   * @returns {Promise<Object>} Always returns { memoryUpdates: null } - never interrupts flow
   */
  execute: async function(params, context) {
    // Start time for performance tracking
    const startTime = Date.now();
    const logPrefix = `[MetaLearner:${context.studentId}]`;

    console.log(`${logPrefix} Observing interaction`);

    try {
      // Validate minimal required data
      if (!context.studentId || !context.memory) {
        console.warn(`${logPrefix} Missing required context - skipping`);
        return { memoryUpdates: null };
      }

      // Initialize meta-learning components
      const dataRoot = context.memory.dataRoot;
      if (!dataRoot) {
        console.warn(`${logPrefix} No dataRoot available - skipping`);
        return { memoryUpdates: null };
      }

      const metaDB = new MetaLearningDB({
        dataRoot,
        logger: console,
        config: {
          maxHistoryPerStrategy: 100,
          minSamplesForPrediction: 10
        }
      });

      // Ensure metaDB is ready
      await metaDB._initialize();

      // Step 1: Record this interaction if we have a skill
      if (params.skillUsed && params.dotPoint) {
        await this._recordInteraction(params, context, metaDB, logPrefix);
      }

      // Step 2: Check if we should run evolution
      const stats = metaDB.getStats();
      const shouldEvolve = this._shouldRunEvolution(stats, params, context);

      if (shouldEvolve) {
        console.log(`${logPrefix} Evolution threshold reached, triggering...`);

        // Run evolution in background - never block
        setImmediate(async () => {
          try {
            await this._runEvolution(context, metaDB, logPrefix);
          } catch (err) {
            console.error(`${logPrefix} Background evolution failed:`, err);
          }
        });
      }

      // Step 3: Check for learning opportunities
      const opportunities = await this._detectLearningOpportunities(
        params, context, metaDB, logPrefix
      );

      if (opportunities.length > 0) {
        console.log(`${logPrefix} Found ${opportunities.length} learning opportunities`);

        // Store opportunities for later use
        await this._storeOpportunities(context.studentId, opportunities, metaDB);
      }

      const duration = Date.now() - startTime;
      console.log(`${logPrefix} Completed in ${duration}ms`);

      // Always return null - passive skills never modify memory directly
      return { memoryUpdates: null };

    } catch (err) {
      // Passive skills must NEVER crash the main flow
      console.error(`${logPrefix} Error (suppressed):`, err.message);
      return { memoryUpdates: null };
    }
  },

  /**
   * Record interaction in meta-learning database
   * @private
   */
  _recordInteraction: async function(params, context, metaDB, logPrefix) {
    try {
      const { studentModel } = context;

      // Calculate learning gain if we have before/after mastery
      let learningGain = 0;
      if (params.masteryBefore && params.masteryAfter && params.dotPoint) {
        const before = params.masteryBefore[params.dotPoint] || 0;
        const after = params.masteryAfter[params.dotPoint] || 0;
        learningGain = after - before;
      }

      // Calculate engagement based on response time and length
      const engagement = this._calculateEngagement(params, context);

      // Determine success
      const success = params.isCorrect === true ||
                     (params.scoreSignal !== undefined && params.scoreSignal > 0.7);

      await metaDB.recordStrategyOutcome(
        {
          type: params.skillUsed,
          topic: params.dotPoint || 'general',
          parameters: {
            difficulty: params.difficulty || 'medium',
            scaffolding: params.scaffolding || 'normal'
          }
        },
        {
          studentId: context.studentId,
          masteryLevel: studentModel?.overallMastery || 0.5,
          learningStyle: studentModel?.learningStyle?.preferredRepresentation || 'unknown',
          affectiveState: studentModel?.affectiveState?.currentEngagement || 'focused',
          sessionDuration: context.sessionState?.sessionDuration || 0,
          interactionCount: params.sessionAttempts || 0
        },
        {
          success,
          score: params.scoreSignal !== undefined ? params.scoreSignal : (success ? 1.0 : 0.0),
          engagement,
          learningGain: Math.max(-1, Math.min(1, learningGain))
        }
      );

      console.log(`${logPrefix} Recorded outcome for ${params.skillUsed} (success: ${success})`);

    } catch (err) {
      console.warn(`${logPrefix} Failed to record interaction:`, err.message);
      // Non-fatal, continue
    }
  },

  /**
   * Calculate engagement level from interaction
   * @private
   */
  _calculateEngagement: function(params, context) {
    let engagement = 0.5; // Default

    try {
      // Factor 1: Response length (compared to average)
      const responseLength = params.response?.length || 0;
      if (responseLength > 500) {
        engagement += 0.2;
      } else if (responseLength < 50) {
        engagement -= 0.1;
      }

      // Factor 2: Student response time
      const responseTime = params.responseTimeMs;
      if (responseTime) {
        if (responseTime < 5000) {
          engagement += 0.1; // Quick response = engaged
        } else if (responseTime > 30000) {
          engagement -= 0.2; // Slow response = distracted/fatigued
        }
      }

      // Factor 3: Session attempts
      const attempts = params.sessionAttempts || 0;
      if (attempts > 20) {
        engagement -= 0.1; // May be fatigued
      } else if (attempts < 5) {
        engagement += 0.1; // Fresh and engaged
      }

      // Clamp between 0 and 1
      engagement = Math.max(0, Math.min(1, engagement));

    } catch (err) {
      // Use default
    }

    return engagement;
  },

  /**
   * Determine if evolution should run
   * @private
   */
  _shouldRunEvolution: function(stats, params, context) {
    // Don't run if we don't have enough data
    if (stats.totalInteractions < 50) {
      return false;
    }

    // Don't run if we recently evolved
    const lastEvolution = context.memory?.getLastEvolutionTime?.();
    if (lastEvolution && (Date.now() - lastEvolution) < 3600000) { // 1 hour
      return false;
    }

    // Run every 100 interactions
    if (stats.totalInteractions % 100 === 0) {
      return true;
    }

    // Run if we have many new patterns
    if (stats.totalStrategies > 20 && stats.totalStrategies % 10 === 0) {
      return true;
    }

    return false;
  },

  /**
   * Run strategy evolution
   * @private
   */
  _runEvolution: async function(context, metaDB, logPrefix) {
    console.log(`${logPrefix} Starting strategy evolution`);

    try {
      // Get skills root path
      const skillsRoot = path.join(process.cwd(), 'src', 'skills');

      // Initialize evolution engine
      const evolution = new StrategyEvolution({
        metaDB,
        modelManager: context.model,
        skillsRoot,
        logger: console,
        config: {
          minPatternsForEvolution: 10,
          maxStrategiesPerEvolution: 2,
          confidenceThreshold: 0.7
        }
      });

      // Build evolution context
      const evolutionContext = {
        studentId: context.studentId,
        recentTopics: await this._getRecentTopics(context),
        recentSkills: await this._getRecentSkills(context)
      };

      // Run evolution
      const result = await evolution.evolveStrategies(evolutionContext);

      if (result.success) {
        console.log(`${logPrefix} Evolution successful`, {
          strategiesDeployed: result.strategies.length,
          duration: result.evolution.duration
        });

        // Record evolution time
        if (context.memory?.recordEvolutionTime) {
          await context.memory.recordEvolutionTime(Date.now());
        }

        // Notify if any new strategies were created
        if (result.strategies.length > 0) {
          await this._notifyNewStrategies(result.strategies, context);
        }
      } else {
        console.log(`${logPrefix} Evolution not needed: ${result.reason}`);
      }

    } catch (err) {
      console.error(`${logPrefix} Evolution failed:`, err);
    }
  },

  /**
   * Get recent topics from memory
   * @private
   */
  _getRecentTopics: async function(context) {
    try {
      const progress = await context.memory.getProgress(context.studentId);
      const recentSessions = progress.sessions?.slice(-5) || [];

      const topics = new Set();
      for (const session of recentSessions) {
        for (const attempt of session.attempts || []) {
          if (attempt.dotPoint) {
            topics.add(attempt.dotPoint);
          }
        }
      }

      return Array.from(topics).slice(0, 10);
    } catch (err) {
      return [];
    }
  },

  /**
   * Get recent skills from memory
   * @private
   */
  _getRecentSkills: async function(context) {
    try {
      const progress = await context.memory.getProgress(context.studentId);
      const recentSessions = progress.sessions?.slice(-5) || [];

      const skills = new Set();
      for (const session of recentSessions) {
        for (const attempt of session.attempts || []) {
          if (attempt.skillUsed) {
            skills.add(attempt.skillUsed);
          }
        }
      }

      return Array.from(skills);
    } catch (err) {
      return [];
    }
  },

  /**
   * Detect learning opportunities from patterns
   * @private
   */
  _detectLearningOpportunities: async function(params, context, metaDB, logPrefix) {
    const opportunities = [];

    try {
      const studentId = context.studentId;
      const studentModel = context.studentModel;

      // Opportunity 1: Student struggling with a topic
      if (params.isCorrect === false && params.dotPoint) {
        const topic = params.dotPoint;
        const attempts = await this._getAttemptCountForTopic(studentId, topic, context);

        if (attempts > 3) {
          opportunities.push({
            type: 'struggling',
            topic,
            attempts,
            suggestedAction: 'try_different_approach',
            confidence: 0.8
          });
        }
      }

      // Opportunity 2: Student ready for challenge
      if (params.isCorrect === true && params.recentAccuracy > 0.8) {
        opportunities.push({
          type: 'ready_for_challenge',
          topic: params.dotPoint,
          suggestedAction: 'increase_difficulty',
          confidence: 0.7
        });
      }

      // Opportunity 3: Pattern from similar students
      if (params.dotPoint && studentModel) {
        const bestStrategy = await metaDB.findBestStrategy(
          {
            masteryLevel: studentModel.overallMastery || 0.5,
            learningStyle: studentModel.learningStyle?.preferredRepresentation,
            affectiveState: studentModel.affectiveState?.currentEngagement
          },
          params.dotPoint,
          await this._getAvailableStrategies(params.dotPoint, context)
        );

        if (bestStrategy && bestStrategy.strategy &&
            bestStrategy.strategy.type !== params.skillUsed) {
          opportunities.push({
            type: 'better_strategy_available',
            topic: params.dotPoint,
            currentStrategy: params.skillUsed,
            recommendedStrategy: bestStrategy.strategy.type,
            expectedImprovement: bestStrategy.score,
            confidence: bestStrategy.confidence || 0.6
          });
        }
      }

    } catch (err) {
      console.warn(`${logPrefix} Failed to detect opportunities:`, err.message);
    }

    return opportunities;
  },

  /**
   * Get attempt count for a topic
   * @private
   */
  _getAttemptCountForTopic: async function(studentId, topic, context) {
    try {
      const progress = await context.memory.getProgress(studentId);
      let count = 0;

      for (const session of progress.sessions || []) {
        for (const attempt of session.attempts || []) {
          if (attempt.dotPoint === topic) {
            count++;
          }
        }
      }

      return count;
    } catch (err) {
      return 0;
    }
  },

  /**
   * Get available strategies for a topic
   * @private
   */
  _getAvailableStrategies: async function(topic, context) {
    // Get all skills that could handle this topic
    const skills = context.skillManager?.getAllSkills() || [];

    return skills
      .filter(s => s.type === 'active')
      .map(s => s.name)
      .slice(0, 10); // Limit to avoid overwhelming
  },

  /**
   * Store opportunities for later use
   * @private
   */
  _storeOpportunities: async function(studentId, opportunities, metaDB) {
    try {
      // Store in a separate file or in memory
      const opportunitiesPath = path.join(
        path.dirname(metaDB.dbPath),
        'opportunities.json'
      );

      let existing = [];
      try {
        const content = await fs.readFile(opportunitiesPath, 'utf8');
        existing = JSON.parse(content);
      } catch {
        // File doesn't exist yet
      }

      // Add new opportunities with timestamps
      const newOpportunities = opportunities.map(opp => ({
        ...opp,
        studentId,
        detectedAt: new Date().toISOString(),
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      }));

      existing.push(...newOpportunities);

      // Keep only last 100
      if (existing.length > 100) {
        existing = existing.slice(-100);
      }

      await fs.writeFile(opportunitiesPath, JSON.stringify(existing, null, 2));

    } catch (err) {
      console.warn(`[MetaLearner] Failed to store opportunities:`, err.message);
    }
  },

  /**
   * Notify about new evolved strategies
   * @private
   */
  _notifyNewStrategies: async function(strategies, context) {
    try {
      // Log to console
      console.log('[MetaLearner] 🎉 New teaching strategies evolved!', {
        count: strategies.length,
        names: strategies.map(s => s.name)
      });

      // Store notification for UI
      const notificationPath = path.join(
        context.memory.dataRoot,
        'notifications.json'
      );

      let notifications = [];
      try {
        const content = await fs.readFile(notificationPath, 'utf8');
        notifications = JSON.parse(content);
      } catch {
        // File doesn't exist
      }

      notifications.push({
        type: 'strategies_evolved',
        timestamp: new Date().toISOString(),
        strategies: strategies.map(s => ({
          name: s.name,
          description: s.strategy?.description || 'New teaching strategy'
        })),
        message: `🎉 ${strategies.length} new teaching ${strategies.length === 1 ? 'strategy has' : 'strategies have'} been evolved from learning patterns!`
      });

      // Keep last 20 notifications
      if (notifications.length > 20) {
        notifications = notifications.slice(-20);
      }

      await fs.writeFile(notificationPath, JSON.stringify(notifications, null, 2));

    } catch (err) {
      console.warn('[MetaLearner] Failed to store notification:', err.message);
    }
  },

  /**
   * Get meta-learning statistics
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Statistics
   */
  getStats: async function(context) {
    try {
      const dataRoot = context.memory?.dataRoot;
      if (!dataRoot) return { error: 'No data root' };

      const metaDB = new MetaLearningDB({ dataRoot, logger: console });
      await metaDB._initialize();

      const stats = metaDB.getStats();

      // Add evolution history
      const evolutionPath = path.join(dataRoot, 'evolutions.json');
      try {
        const content = await fs.readFile(evolutionPath, 'utf8');
        stats.evolutions = JSON.parse(content);
      } catch {
        stats.evolutions = [];
      }

      // Add opportunities
      const opportunitiesPath = path.join(dataRoot, 'opportunities.json');
      try {
        const content = await fs.readFile(opportunitiesPath, 'utf8');
        stats.opportunities = JSON.parse(content).length;
      } catch {
        stats.opportunities = 0;
      }

      return stats;

    } catch (err) {
      return { error: err.message };
    }
  }
};

// Import fs for file operations (used in functions above)
const fs = require('fs').promises;