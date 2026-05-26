// services/knowledge-enhancer.js
// Dynamically generates teaching content from knowledge base
// Uses LLM to create explanations, questions, examples and feedback

'use strict';

const PromptTemplates = require('./prompt-templates');
const ContentValidator = require('../utils/content-validator');
const StudentLevelDetector = require('../utils/student-level-detector');

class KnowledgeEnhancer {
  /**
   * @param {object} model - ModelManager instance
   * @param {object} knowledgeBase - Current subject's knowledge base
   * @param {object} cache - CacheService instance (optional)
   */
  constructor(model, knowledgeBase, cache = null) {
    this.model = model;
    this.knowledgeBase = knowledgeBase;
    this.cache = cache;
    this.validator = new ContentValidator();
    this.levelDetector = new StudentLevelDetector();
  }

  /**
   * Generate a complete explanation for a topic
   * @param {string} topicCode - Topic code (e.g., 'MA-C1')
   * @param {object} studentModel - Current student model
   * @param {object} options - Generation options
   * @returns {Promise<object>} Generated explanation content
   */
  async generateExplanation(topicCode, studentModel, options = {}) {
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get(`explanation:${topicCode}:${studentModel?.studentId}`);
      if (cached) return cached;
    }

    // Get topic data from knowledge base
    const topicData = this._getTopicData(topicCode);
    if (!topicData) {
      throw new Error(`Topic not found: ${topicCode}`);
    }

    // Detect student level
    const studentLevel = this.levelDetector.detect(studentModel);

    // Get prompt template
    const prompt = PromptTemplates.explanation({
      topicName: topicData.name,
      topicDescription: topicData.description,
      subject: this.knowledgeBase.subjectId,
      studentLevel,
      learningStyle: studentModel?.learningStyle?.preferredRepresentation || 'balanced',
      difficulty: options.difficulty || 'medium'
    });

    // Call LLM
    const response = await this.model.chat(prompt, {
      temperature: options.temperature || 0.5,
      maxTokens: options.maxTokens || 1200,
      skillName: 'knowledge-enhancer-explanation'
    });

    // Parse and validate response
    let content;
    try {
      content = JSON.parse(response);
    } catch (err) {
      // If not JSON, use as plain text explanation
      content = {
        explanation: response,
        examples: [],
        keyPoints: [],
        commonMisconceptions: []
      };
    }

    // Validate content
    const validated = this.validator.validateExplanation(content, topicCode);

    // Cache if enabled
    if (this.cache && validated) {
      await this.cache.set(`explanation:${topicCode}:${studentModel?.studentId}`, validated);
    }

    return validated;
  }

  /**
   * Generate check questions for a topic
   * @param {string} topicCode - Topic code
   * @param {number} count - Number of questions to generate
   * @param {string} difficulty - 'easy' | 'medium' | 'hard'
   * @param {object} studentModel - Current student model
   * @returns {Promise<Array>} Array of question objects
   */
  async generateQuestions(topicCode, count = 3, difficulty = 'medium', studentModel = null) {
    const cacheKey = `questions:${topicCode}:${difficulty}:${count}`;

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const topicData = this._getTopicData(topicCode);
    const studentLevel = studentModel ? this.levelDetector.detect(studentModel) : 'intermediate';

    const prompt = PromptTemplates.questions({
      topicName: topicData.name,
      topicDescription: topicData.description,
      subject: this.knowledgeBase.subjectId,
      count,
      difficulty,
      studentLevel
    });

    const response = await this.model.chat(prompt, {
      temperature: 0.7,
      maxTokens: 800,
      skillName: 'knowledge-enhancer-questions'
    });

    let questions;
    try {
      questions = JSON.parse(response);
    } catch (err) {
      // Fallback to simple questions
      questions = this._generateFallbackQuestions(topicData, count);
    }

    const validated = this.validator.validateQuestions(questions, count);

    if (this.cache) {
      await this.cache.set(cacheKey, validated);
    }

    return validated;
  }

  /**
   * Generate examples for a topic
   * @param {string} topicCode - Topic code
   * @param {number} count - Number of examples
   * @param {string} difficulty - 'easy' | 'medium' | 'hard'
   * @returns {Promise<Array>} Array of example objects
   */
  async generateExamples(topicCode, count = 2, difficulty = 'medium') {
    const cacheKey = `examples:${topicCode}:${difficulty}:${count}`;

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const topicData = this._getTopicData(topicCode);

    const prompt = PromptTemplates.examples({
      topicName: topicData.name,
      topicDescription: topicData.description,
      subject: this.knowledgeBase.subjectId,
      count,
      difficulty
    });

    const response = await this.model.chat(prompt, {
      temperature: 0.6,
      maxTokens: 1000,
      skillName: 'knowledge-enhancer-examples'
    });

    let examples;
    try {
      examples = JSON.parse(response);
    } catch (err) {
      examples = this._generateFallbackExamples(topicData, count);
    }

    if (this.cache) {
      await this.cache.set(cacheKey, examples);
    }

    return examples;
  }

  /**
   * Generate common misconceptions for a topic
   * @param {string} topicCode - Topic code
   * @returns {Promise<Array>} Array of misconception objects
   */
  async generateMisconceptions(topicCode) {
    const cacheKey = `misconceptions:${topicCode}`;

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const topicData = this._getTopicData(topicCode);

    const prompt = PromptTemplates.misconceptions({
      topicName: topicData.name,
      topicDescription: topicData.description,
      subject: this.knowledgeBase.subjectId
    });

    const response = await this.model.chat(prompt, {
      temperature: 0.5,
      maxTokens: 600,
      skillName: 'knowledge-enhancer-misconceptions'
    });

    let misconceptions;
    try {
      misconceptions = JSON.parse(response);
    } catch (err) {
      misconceptions = [
        {
          description: `Common misunderstanding about ${topicData.name}`,
          suggestion: 'Review the core concepts carefully'
        }
      ];
    }

    if (this.cache) {
      await this.cache.set(cacheKey, misconceptions);
    }

    return misconceptions;
  }

  /**
   * Generate exam tips for a topic
   * @param {string} topicCode - Topic code
   * @returns {Promise<Array>} Array of tip strings
   */
  async generateExamTips(topicCode) {
    const cacheKey = `tips:${topicCode}`;

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const topicData = this._getTopicData(topicCode);

    const prompt = PromptTemplates.examTips({
      topicName: topicData.name,
      topicDescription: topicData.description,
      subject: this.knowledgeBase.subjectId
    });

    const response = await this.model.chat(prompt, {
      temperature: 0.5,
      maxTokens: 400,
      skillName: 'knowledge-enhancer-tips'
    });

    let tips;
    try {
      tips = JSON.parse(response);
    } catch (err) {
      tips = [
        `Practice problems involving ${topicData.name} regularly`,
        'Check your working step by step',
        'Review common mistakes'
      ];
    }

    if (this.cache) {
      await this.cache.set(cacheKey, tips);
    }

    return tips;
  }

  /**
   * Generate a complete lesson plan for a topic
   * @param {string} topicCode - Topic code
   * @param {object} studentModel - Current student model
   * @returns {Promise<object>} Complete lesson plan
   */
  async generateLessonPlan(topicCode, studentModel) {
    const [
      explanation,
      questions,
      examples,
      misconceptions,
      tips
    ] = await Promise.all([
      this.generateExplanation(topicCode, studentModel),
      this.generateQuestions(topicCode, 3, 'medium', studentModel),
      this.generateExamples(topicCode, 2, 'medium'),
      this.generateMisconceptions(topicCode),
      this.generateExamTips(topicCode)
    ]);

    const topicData = this._getTopicData(topicCode);

    return {
      topic: topicCode,
      name: topicData.name,
      description: topicData.description,
      explanation,
      questions,
      examples,
      misconceptions,
      tips,
      prerequisites: topicData.prerequisites || [],
      difficulty: topicData.difficulty || 'medium'
    };
  }

  /**
   * Get topic data from knowledge base
   * @private
   */
  _getTopicData(topicCode) {
    const syllabusMap = this.knowledgeBase?.syllabusMap || {};
    return syllabusMap[topicCode] || {
      name: topicCode,
      description: `Topic ${topicCode}`,
      difficulty: 'medium',
      prerequisites: []
    };
  }

  /**
   * Generate fallback questions
   * @private
   */
  _generateFallbackQuestions(topicData, count) {
    const questions = [];
    for (let i = 0; i < count; i++) {
      questions.push({
        question: `Explain the key concept of ${topicData.name}`,
        type: 'open',
        difficulty: 'medium',
        expectedAnswer: 'Student should demonstrate understanding of main ideas'
      });
    }
    return questions;
  }

  /**
   * Generate fallback examples
   * @private
   */
  _generateFallbackExamples(topicData, count) {
    const examples = [];
    for (let i = 0; i < count; i++) {
      examples.push({
        problem: `Practice example for ${topicData.name}`,
        solution: 'Work through step by step',
        explanation: 'This demonstrates the key principle'
      });
    }
    return examples;
  }
}

module.exports = KnowledgeEnhancer;