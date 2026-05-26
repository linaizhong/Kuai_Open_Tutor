/**
 * Strategy Evolution Engine
 * Analyzes teaching patterns and generates new strategies
 *
 * @module memory/strategy-evolution
 */

'use strict';

const crypto = require('crypto');
const MetaLearningDB = require('./meta-learning-db');
const path = require('path');
const fs = require('fs').promises;

// Custom error classes
class EvolutionError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'EvolutionError';
    this.cause = cause;
    this.timestamp = new Date().toISOString();
  }
}

class StrategyGenerationError extends EvolutionError {
  constructor(message, cause = null) {
    super(message, cause);
    this.name = 'StrategyGenerationError';
  }
}

class ValidationError extends EvolutionError {
  constructor(message, cause = null) {
    super(message, cause);
    this.name = 'ValidationError';
  }
}

/**
 * Strategy Evolution Engine
 * Generates and validates new teaching strategies from patterns
 */
class StrategyEvolution {
  /**
   * @param {Object} options - Configuration options
   * @param {MetaLearningDB} options.metaDB - Meta-learning database instance
   * @param {Object} options.modelManager - ModelManager instance for LLM calls
   * @param {string} options.skillsRoot - Path to skills directory
   * @param {Object} options.logger - Logger instance (optional)
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    const { metaDB, modelManager, skillsRoot, logger = console, config = {} } = options;

    if (!metaDB) {
      throw new EvolutionError('MetaLearningDB is required');
    }
    if (!modelManager) {
      throw new EvolutionError('ModelManager is required');
    }
    if (!skillsRoot) {
      throw new EvolutionError('skillsRoot is required');
    }

    this.metaDB = metaDB;
    this.model = modelManager;
    this.skillsRoot = skillsRoot;
    this.logger = logger;

    this.config = {
      minPatternsForEvolution: config.minPatternsForEvolution || 10,
      maxStrategiesPerEvolution: config.maxStrategiesPerEvolution || 3,
      evolutionFrequency: config.evolutionFrequency || 100, // interactions
      confidenceThreshold: config.confidenceThreshold || 0.7,
      requireValidation: config.requireValidation !== false,
      validationRounds: config.validationRounds || 3,
      ...config
    };

    // Track evolved strategies
    this.evolvedStrategies = new Map(); // strategyName -> { spec, createdAt, successRate }
    this.evolutionHistory = [];

    // Track ongoing evolutions
    this.activeEvolutions = new Map();

    this.logger.info('[StrategyEvolution] Initialized', {
      config: this.config
    });
  }

  /**
   * Check if evolution should run
   *
   * @param {number} totalInteractions - Total interactions so far
   * @returns {boolean} Whether evolution should run
   */
  shouldEvolve(totalInteractions) {
    return totalInteractions > 0 &&
           totalInteractions % this.config.evolutionFrequency === 0;
  }

  /**
   * Run strategy evolution
   *
   * @param {Object} context - Evolution context
   * @param {string} context.studentId - Student ID (optional)
   * @param {Array} context.recentTopics - Recent topics (optional)
   * @returns {Promise<Object>} Evolution results
   */
  async evolveStrategies(context = {}) {
    const evolutionId = crypto.randomBytes(8).toString('hex');
    const startTime = Date.now();

    this.logger.info(`[StrategyEvolution:${evolutionId}] Starting evolution`);

    try {
      // Check if already evolving
      if (this.activeEvolutions.has('current')) {
        this.logger.warn(`[StrategyEvolution:${evolutionId}] Evolution already in progress`);
        return {
          success: false,
          reason: 'Evolution already in progress',
          evolutionId
        };
      }

      this.activeEvolutions.set('current', true);

      // Step 1: Analyze successful patterns
      this.logger.debug(`[StrategyEvolution:${evolutionId}] Analyzing patterns...`);
      const patterns = await this._analyzeSuccessfulPatterns();

      if (patterns.length < this.config.minPatternsForEvolution) {
        this.logger.info(`[StrategyEvolution:${evolutionId}] Not enough patterns (${patterns.length}/${this.config.minPatternsForEvolution})`);
        this.activeEvolutions.delete('current');
        return {
          success: false,
          reason: 'Insufficient patterns',
          patternsFound: patterns.length,
          required: this.config.minPatternsForEvolution,
          evolutionId
        };
      }

      // Step 2: Generate new strategies
      this.logger.debug(`[StrategyEvolution:${evolutionId}] Generating strategies from ${patterns.length} patterns...`);
      const candidates = await this._generateStrategies(patterns, evolutionId);

      // Step 3: Validate candidates
      this.logger.debug(`[StrategyEvolution:${evolutionId}] Validating ${candidates.length} candidates...`);
      const validated = await this._validateStrategies(candidates, evolutionId);

      // Step 4: Deploy validated strategies
      this.logger.debug(`[StrategyEvolution:${evolutionId}] Deploying ${validated.length} strategies...`);
      const deployed = await this._deployStrategies(validated, context, evolutionId);

      // Step 5: Record evolution
      const evolution = {
        id: evolutionId,
        timestamp: new Date().toISOString(),
        patternsAnalyzed: patterns.length,
        candidatesGenerated: candidates.length,
        strategiesValidated: validated.length,
        strategiesDeployed: deployed.length,
        deployedStrategies: deployed.map(d => d.name),
        context,
        duration: Date.now() - startTime
      };

      this.evolutionHistory.push(evolution);

      // Keep last 100 evolutions
      if (this.evolutionHistory.length > 100) {
        this.evolutionHistory = this.evolutionHistory.slice(-100);
      }

      this.activeEvolutions.delete('current');

      this.logger.info(`[StrategyEvolution:${evolutionId}] Evolution complete`, {
        deployed: deployed.length,
        duration: evolution.duration
      });

      return {
        success: true,
        evolution,
        strategies: deployed,
        evolutionId
      };

    } catch (err) {
      this.activeEvolutions.delete('current');
      this.logger.error(`[StrategyEvolution:${evolutionId}] Evolution failed:`, err);

      if (err instanceof EvolutionError) {
        throw err;
      }
      throw new EvolutionError('Strategy evolution failed', err);
    }
  }

  /**
   * Analyze successful teaching patterns
   * @private
   */
  async _analyzeSuccessfulPatterns() {
    const patterns = [];
    const stats = this.metaDB.getStats();

    // Get all strategies
    const strategies = this.metaDB.getTopStrategies(null, 100);

    for (const strategy of strategies) {
      // Only consider strategies with enough samples
      if (strategy.totalSamples < this.config.minPatternsForEvolution) {
        continue;
      }

      // Only consider successful strategies
      if (strategy.successRate < 0.7) {
        continue;
      }

      // Get detailed data
      const effectiveness = this.metaDB.getStrategyEffectiveness({
        type: strategy.type,
        topic: strategy.topic
      });

      if (!effectiveness) continue;

      // Find student profiles where this strategy worked well
      const strategyKey = this._createStrategyKey({
        type: strategy.type,
        topic: strategy.topic
      });

      const strategyData = this.metaDB.data.teachingStrategies[strategyKey];
      if (!strategyData) continue;

      // Group successful outcomes by student profile
      const successfulProfiles = strategyData.studentProfiles
        .filter(p => p.outcome.success)
        .map(p => ({
          masteryLevel: p.masteryLevel,
          learningStyle: p.learningStyle,
          affectiveState: p.affectiveState,
          outcome: p.outcome
        }));

      if (successfulProfiles.length < this.config.minPatternsForEvolution) {
        continue;
      }

      patterns.push({
        strategyType: strategy.type,
        topic: strategy.topic,
        successRate: strategy.successRate,
        averageScore: strategy.averageScore,
        averageEngagement: strategy.averageEngagement,
        averageLearningGain: strategy.averageLearningGain,
        successfulProfiles: successfulProfiles.slice(0, 50), // Limit for analysis
        totalSamples: strategy.totalSamples
      });
    }

    // Sort by success rate
    patterns.sort((a, b) => b.successRate - a.successRate);

    return patterns;
  }

  /**
   * Generate new strategies from patterns
   * @private
   */
  async _generateStrategies(patterns, evolutionId) {
    const candidates = [];

    for (let i = 0; i < Math.min(patterns.length, 10); i++) {
      const pattern = patterns[i];

      try {
        const prompt = this._buildEvolutionPrompt(pattern);

        const messages = [
          {
            role: 'system',
            content: `You are OpenTutor's strategy evolution engine. Your task is to generate new, innovative teaching strategies based on patterns of what works well.

A good teaching strategy should:
1. Be specific and actionable
2. Have clear steps
3. Adapt to different student states
4. Include variations for different learning styles
5. Be measurable (we can tell if it worked)

Return a JSON object with EXACTLY this structure:
{
  "strategy": {
    "name": "descriptive-name-with-dashes",
    "type": "explain|practice|assess|motivate|scaffold",
    "description": "Clear one-sentence description",
    "triggers": {
      "keywords": ["word1", "word2", "phrase with spaces"],
      "studentStates": ["frustrated", "confident", "stuck"],
      "topicTypes": ["conceptual", "procedural", "application"]
    },
    "workflow": [
      "Step 1: ...",
      "Step 2: ...",
      "Step 3: ..."
    ],
    "variations": [
      {
        "condition": "When student is frustrated",
        "adaptation": "Add extra encouragement and simpler examples"
      }
    ],
    "expectedOutcomes": {
      "success": "What success looks like",
      "engagement": "Expected engagement level",
      "learningGain": "Expected learning improvement"
    },
    "parameters": {
      "difficulty": "easy|medium|hard",
      "scaffolding": "minimal|moderate|heavy",
      "pace": "slow|normal|fast"
    },
    "examples": [
      "Example usage scenario"
    ]
  },
  "confidence": 0.0-1.0,
  "reasoning": "Why this strategy might work"
}`
          },
          {
            role: 'user',
            content: this._buildPatternDescription(pattern)
          }
        ];

        const response = await this.model.chat(messages, {
          temperature: 0.7, // Higher temperature for creativity
          maxTokens: 2000,
          skillName: 'strategy-evolution'
        });

        // Parse response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          this.logger.warn(`[StrategyEvolution:${evolutionId}] No JSON in response for pattern ${i}`);
          continue;
        }

        const result = JSON.parse(jsonMatch[0]);

        // Validate structure
        if (this._validateStrategySpec(result.strategy)) {
          candidates.push({
            ...result.strategy,
            _source: pattern,
            _generated: new Date().toISOString(),
            _evolutionId: evolutionId
          });
        }

      } catch (err) {
        this.logger.warn(`[StrategyEvolution:${evolutionId}] Failed to generate strategy from pattern ${i}:`, err.message);
      }

      // Small delay between generations
      await new Promise(r => setTimeout(r, 100));
    }

    return candidates;
  }

  /**
   * Build evolution prompt
   * @private
   */
  _buildEvolutionPrompt(pattern) {
    return `
Pattern Analysis:
- Strategy type: ${pattern.strategyType}
- Topic: ${pattern.topic}
- Success rate: ${(pattern.successRate * 100).toFixed(1)}%
- Average engagement: ${(pattern.averageEngagement * 100).toFixed(1)}%
- Average learning gain: ${(pattern.averageLearningGain * 100).toFixed(1)}%

Sample of successful student profiles (first 5):
${pattern.successfulProfiles.slice(0, 5).map(p =>
  `- Mastery: ${p.masteryLevel.toFixed(2)}, Style: ${p.learningStyle}, State: ${p.affectiveState}`
).join('\n')}

Based on this pattern, generate a NEW teaching strategy that:
1. Captures what made this pattern successful
2. Could work for a broader range of students
3. Has clear, actionable steps
4. Includes variations for different situations
`;
  }

  /**
   * Build pattern description
   * @private
   */
  _buildPatternDescription(pattern) {
    return JSON.stringify(pattern, null, 2);
  }

  /**
   * Validate strategy specification
   * @private
   */
  _validateStrategySpec(spec) {
    if (!spec) return false;

    // Required fields
    const required = ['name', 'type', 'description', 'workflow'];
    for (const field of required) {
      if (!spec[field]) {
        this.logger.debug(`Strategy missing required field: ${field}`);
        return false;
      }
    }

    // Name format
    if (!/^[a-z][a-z0-9-]+$/.test(spec.name)) {
      this.logger.debug(`Invalid strategy name format: ${spec.name}`);
      return false;
    }

    // Valid type
    const validTypes = ['explain', 'practice', 'assess', 'motivate', 'scaffold'];
    if (!validTypes.includes(spec.type)) {
      this.logger.debug(`Invalid strategy type: ${spec.type}`);
      return false;
    }

    // Workflow must have steps
    if (!Array.isArray(spec.workflow) || spec.workflow.length === 0) {
      this.logger.debug(`Workflow must be non-empty array`);
      return false;
    }

    return true;
  }

  /**
   * Validate generated strategies
   * @private
   */
  async _validateStrategies(candidates, evolutionId) {
    const validated = [];

    for (const candidate of candidates) {
      try {
        this.logger.debug(`[StrategyEvolution:${evolutionId}] Validating: ${candidate.name}`);

        // Run multiple validation rounds
        const results = [];
        for (let round = 0; round < this.config.validationRounds; round++) {
          const result = await this._validateStrategy(candidate, round);
          results.push(result);
        }

        // Calculate consensus
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        const avgEngagement = results.reduce((sum, r) => sum + r.expectedEngagement, 0) / results.length;
        const avgLearningGain = results.reduce((sum, r) => sum + r.expectedLearningGain, 0) / results.length;

        const issues = results.flatMap(r => r.issues || []);
        const uniqueIssues = [...new Set(issues)];

        if (avgScore >= this.config.confidenceThreshold && uniqueIssues.length === 0) {
          validated.push({
            ...candidate,
            _validation: {
              score: avgScore,
              expectedEngagement: avgEngagement,
              expectedLearningGain: avgLearningGain,
              rounds: results,
              issues: uniqueIssues,
              validatedAt: new Date().toISOString()
            }
          });
          this.logger.debug(`[StrategyEvolution:${evolutionId}] ✅ ${candidate.name} validated (score: ${avgScore.toFixed(2)})`);
        } else {
          this.logger.debug(`[StrategyEvolution:${evolutionId}] ❌ ${candidate.name} failed validation (score: ${avgScore.toFixed(2)})`);
        }

      } catch (err) {
        this.logger.warn(`[StrategyEvolution:${evolutionId}] Validation failed for ${candidate.name}:`, err.message);
      }
    }

    // Limit number of strategies to deploy
    return validated.slice(0, this.config.maxStrategiesPerEvolution);
  }

  /**
   * Validate a single strategy
   * @private
   */
  async _validateStrategy(strategy, round) {
    const prompt = [
      {
        role: 'system',
        content: `You are an expert in educational strategy validation. Evaluate this teaching strategy:

Strategy: ${strategy.name}
Type: ${strategy.type}
Description: ${strategy.description}
Workflow:
${strategy.workflow.map((s, i) => `${i+1}. ${s}`).join('\n')}

Evaluate on these criteria (0-1 scale):
1. Effectiveness: How likely is this to help students learn?
2. Clarity: Are the steps clear and actionable?
3. Adaptability: Can it work for different students?
4. Novelty: Does it offer something new?
5. Safety: Any risk of confusing or frustrating students?

Return JSON:
{
  "score": 0.0-1.0,
  "expectedEngagement": 0.0-1.0,
  "expectedLearningGain": 0.0-1.0,
  "issues": ["issue1", "issue2"],
  "strengths": ["strength1", "strength2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`
      },
      {
        role: 'user',
        content: `Evaluate this strategy (round ${round + 1}): ${strategy.name}`
      }
    ];

    const response = await this.model.chat(prompt, {
      temperature: 0.3,
      maxTokens: 800,
      skillName: 'strategy-validation'
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new ValidationError('No JSON in validation response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Deploy validated strategies
   * @private
   */
  async _deployStrategies(strategies, context, evolutionId) {
    const deployed = [];

    for (const strategy of strategies) {
      try {
        this.logger.info(`[StrategyEvolution:${evolutionId}] Deploying: ${strategy.name}`);

        // Create skill directory
        const skillName = `evolved-${strategy.name}`;
        const skillDir = path.join(this.skillsRoot, skillName);
        await fs.mkdir(skillDir, { recursive: true });

        // Generate skill implementation
        const skillCode = await this._generateSkillCode(strategy);

        // Write index.js
        await fs.writeFile(
          path.join(skillDir, 'index.js'),
          skillCode,
          'utf8'
        );

        // Generate SKILL.md
        const skillMd = this._generateSkillMarkdown(strategy);
        await fs.writeFile(
          path.join(skillDir, 'SKILL.md'),
          skillMd,
          'utf8'
        );

        // Track deployment
        const deployment = {
          name: skillName,
          strategy,
          deployedAt: new Date().toISOString(),
          evolutionId,
          path: skillDir
        };

        this.evolvedStrategies.set(skillName, deployment);
        deployed.push(deployment);

        this.logger.info(`[StrategyEvolution:${evolutionId}] ✅ Deployed: ${skillName}`);

      } catch (err) {
        this.logger.error(`[StrategyEvolution:${evolutionId}] Failed to deploy ${strategy.name}:`, err);
      }
    }

    return deployed;
  }

  /**
   * Generate skill code from strategy
   * @private
   */
  async _generateSkillCode(strategy) {
    const prompt = [
      {
        role: 'system',
        content: `Generate a complete OpenTutor skill implementation for this strategy:

Strategy: ${JSON.stringify(strategy, null, 2)}

The skill should:
1. Export a module with meta and execute function
2. Include clear JSDoc comments
3. Handle errors gracefully
4. Log important steps
5. Return proper result structure

Use this template:
\`\`\`javascript
/**
 * Evolved Strategy: ${strategy.name}
 * Automatically generated from successful teaching patterns
 */

'use strict';

module.exports = {
  meta: {
    name: 'evolved-${strategy.name}',
    version: '1.0.0',
    type: 'active',
    category: 'evolved',
    description: '${strategy.description}'
  },

  /**
   * Execute evolved strategy
   * @param {Object} params - Strategy parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Result
   */
  execute: async function(params, context) {
    const { studentId, memory, studentModel, model, knowledgeBase } = context;

    console.log(\`[Evolved:${strategy.name}] Executing\`, {
      studentId,
      params: Object.keys(params)
    });

    try {
      // Strategy workflow implementation
      ${this._generateWorkflowCode(strategy)}

      // Return result
      return {
        result: response,
        strategy: '${strategy.name}',
        timestamp: new Date().toISOString()
      };

    } catch (err) {
      console.error(\`[Evolved:${strategy.name}] Failed:\`, err);
      throw err;
    }
  }
};
\`\`\`

Return ONLY the code, no explanation.`
      },
      {
        role: 'user',
        content: `Generate skill for: ${strategy.name}`
      }
    ];

    const response = await this.model.chat(prompt, {
      temperature: 0.3,
      maxTokens: 3000,
      skillName: 'skill-generation'
    });

    const codeMatch = response.match(/```javascript\s*([\s\S]*?)```/);
    if (!codeMatch) {
      throw new StrategyGenerationError('No code block in response');
    }

    return codeMatch[1].trim();
  }

  /**
   * Generate workflow code
   * @private
   */
  _generateWorkflowCode(strategy) {
    // This is a placeholder - in practice, the LLM generates this
    return `
      // Implement strategy workflow
      let response = '';

      // Step 1: Assess student state
      const studentState = studentModel?.affectiveState?.currentEngagement || 'focused';

      // Step 2: Select appropriate variation
      let variation = 'standard';
      ${this._generateVariationLogic(strategy)}

      // Step 3: Execute strategy steps
      ${strategy.workflow.map((step, i) =>
        `// Step ${i+1}: ${step}\n      // TODO: Implement step ${i+1}`
      ).join('\n      ')}

      // Step 4: Generate response
      response = \`Implementing ${strategy.name} strategy...\`;`;
  }

  /**
   * Generate variation logic
   * @private
   */
  _generateVariationLogic(strategy) {
    if (!strategy.variations || strategy.variations.length === 0) {
      return '// No variations defined';
    }

    const conditions = strategy.variations.map(v =>
      `if (${this._convertCondition(v.condition)}) {
        // ${v.adaptation}
        variation = 'adapted';
      }`
    ).join(' else ');

    return conditions;
  }

  /**
   * Convert condition string to code
   * @private
   */
  _convertCondition(condition) {
    // Simple conversion - in practice, LLM generates appropriate code
    if (condition.includes('frustrated')) {
      return "studentState === 'frustrated'";
    }
    if (condition.includes('confident')) {
      return "studentState === 'confident'";
    }
    if (condition.includes('stuck')) {
      return "params.difficulty === 'hard' && studentState === 'focused'";
    }
    return 'true'; // Default
  }

  /**
   * Generate skill markdown
   * @private
   */
  _generateSkillMarkdown(strategy) {
    return `# Skill: evolved-${strategy.name}

## Meta
- **Name**: evolved-${strategy.name}
- **Type**: active
- **Category**: evolved
- **Version**: 1.0.0

## Description
${strategy.description}

## Triggers
\`\`\`json
{
  "keywords": ${JSON.stringify(strategy.triggers?.keywords || [])},
  "studentStates": ${JSON.stringify(strategy.triggers?.studentStates || [])},
  "topicTypes": ${JSON.stringify(strategy.triggers?.topicTypes || [])}
}
\`\`\`

## Workflow
${strategy.workflow.map((step, i) => `${i+1}. ${step}`).join('\n')}

## Variations
${strategy.variations ? strategy.variations.map(v =>
  `- **${v.condition}**: ${v.adaptation}`
).join('\n') : 'None defined'}

## Parameters
- **difficulty**: ${strategy.parameters?.difficulty || 'medium'}
- **scaffolding**: ${strategy.parameters?.scaffolding || 'moderate'}
- **pace**: ${strategy.parameters?.pace || 'normal'}

## Expected Outcomes
- **Success**: ${strategy.expectedOutcomes?.success || 'Student demonstrates understanding'}
- **Engagement**: ${(strategy.expectedOutcomes?.engagement * 100 || 70)}%
- **Learning Gain**: ${(strategy.expectedOutcomes?.learningGain * 100 || 20)}%

## Examples
${strategy.examples ? strategy.examples.map(ex => `- ${ex}`).join('\n') : 'To be determined'}

## Notes
This skill was automatically evolved from successful teaching patterns on ${new Date().toISOString().split('T')[0]}.
It represents a novel teaching approach generated by analyzing what works well for similar students.
`;
  }

  /**
   * Get evolution history
   * @returns {Array} Evolution history
   */
  getEvolutionHistory() {
    return this.evolutionHistory;
  }

  /**
   * Get evolved strategies
   * @returns {Array} Evolved strategies
   */
  getEvolvedStrategies() {
    return Array.from(this.evolvedStrategies.values());
  }

  /**
   * Get strategy performance
   *
   * @param {string} strategyName - Name of evolved strategy
   * @returns {Object|null} Performance metrics
   */
  async getStrategyPerformance(strategyName) {
    const deployment = this.evolvedStrategies.get(strategyName);
    if (!deployment) return null;

    // Query meta-learning DB for this strategy's performance
    const effectiveness = this.metaDB.getStrategyEffectiveness({
      type: strategyName,
      topic: 'general'
    });

    return {
      deployment,
      effectiveness,
      successRate: effectiveness?.successRate || 0,
      totalUses: effectiveness?.totalSamples || 0
    };
  }

  /**
   * Create strategy key
   * @private
   */
  _createStrategyKey(strategy) {
    return `${strategy.type}:${strategy.topic}`;
  }

  /**
   * Clean up resources
   */
  async shutdown() {
    this.activeEvolutions.clear();
    this.logger.info('[StrategyEvolution] Shutdown complete');
  }
}

module.exports = StrategyEvolution;