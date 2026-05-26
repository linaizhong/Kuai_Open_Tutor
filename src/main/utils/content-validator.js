// utils/content-validator.js
// Validates generated content for quality and completeness
// Ensures all required fields are present and content meets standards

'use strict';

class ContentValidator {
  constructor(options = {}) {
    this.minExplanationLength = options.minExplanationLength || 100;
    this.maxExplanationLength = options.maxExplanationLength || 5000;
    this.minExamplesPerTopic = options.minExamplesPerTopic || 1;
    this.maxExamplesPerTopic = options.maxExamplesPerTopic || 5;
  }

  /**
   * Validate explanation content
   * @param {object} content - Generated explanation
   * @param {string} topicCode - Topic code for context
   * @returns {object} Validated content (with fixes if needed)
   */
  validateExplanation(content, topicCode) {
    const validated = {
      explanation: '',
      examples: [],
      keyPoints: [],
      commonMisconceptions: [],
      isValid: true,
      warnings: []
    };

    // Validate explanation text
    if (!content.explanation || typeof content.explanation !== 'string') {
      validated.warnings.push('Missing or invalid explanation text');
      validated.explanation = `Let's learn about ${topicCode}. This is an important concept.`;
      validated.isValid = false;
    } else if (content.explanation.length < this.minExplanationLength) {
      validated.warnings.push('Explanation is too short');
      validated.explanation = content.explanation;
      validated.isValid = false;
    } else if (content.explanation.length > this.maxExplanationLength) {
      validated.warnings.push('Explanation exceeds maximum length, truncating');
      validated.explanation = content.explanation.substring(0, this.maxExplanationLength);
    } else {
      validated.explanation = content.explanation;
    }

    // Validate examples
    if (Array.isArray(content.examples)) {
      validated.examples = content.examples
        .filter(ex => this._isValidExample(ex))
        .slice(0, this.maxExamplesPerTopic);

      if (validated.examples.length < this.minExamplesPerTopic) {
        validated.warnings.push(`Only ${validated.examples.length} valid examples provided`);
      }
    } else {
      validated.warnings.push('Examples must be an array');
      validated.examples = [];
    }

    // Validate key points
    if (Array.isArray(content.keyPoints)) {
      validated.keyPoints = content.keyPoints
        .filter(point => point && typeof point === 'string' && point.length > 10)
        .slice(0, 5);

      if (validated.keyPoints.length === 0) {
        validated.warnings.push('No valid key points provided');
        validated.keyPoints = [`Understand the core concepts of ${topicCode}`];
      }
    } else {
      validated.warnings.push('Key points must be an array');
      validated.keyPoints = [`Master ${topicCode} through practice`];
    }

    // Validate misconceptions
    if (Array.isArray(content.commonMisconceptions)) {
      validated.commonMisconceptions = content.commonMisconceptions
        .filter(m => this._isValidMisconception(m))
        .slice(0, 3);
    } else {
      validated.commonMisconceptions = [];
    }

    return validated;
  }

  /**
   * Validate questions array
   * @param {Array} questions - Generated questions
   * @param {number} expectedCount - Expected number of questions
   * @returns {Array} Validated questions
   */
  validateQuestions(questions, expectedCount) {
    if (!Array.isArray(questions)) {
      return this._generateFallbackQuestions(expectedCount);
    }

    const validated = questions
      .filter(q => this._isValidQuestion(q))
      .slice(0, expectedCount);

    // Fill missing questions with fallbacks
    while (validated.length < expectedCount) {
      validated.push(this._createFallbackQuestion());
    }

    return validated;
  }

  /**
   * Validate examples array
   * @param {Array} examples - Generated examples
   * @param {number} expectedCount - Expected number of examples
   * @returns {Array} Validated examples
   */
  validateExamples(examples, expectedCount) {
    if (!Array.isArray(examples)) {
      return this._generateFallbackExamples(expectedCount);
    }

    const validated = examples
      .filter(ex => this._isValidExample(ex))
      .slice(0, expectedCount);

    while (validated.length < expectedCount) {
      validated.push(this._createFallbackExample());
    }

    return validated;
  }

  /**
   * Validate misconceptions array
   * @param {Array} misconceptions - Generated misconceptions
   * @returns {Array} Validated misconceptions
   */
  validateMisconceptions(misconceptions) {
    if (!Array.isArray(misconceptions)) {
      return [];
    }

    return misconceptions
      .filter(m => this._isValidMisconception(m))
      .slice(0, 3);
  }

  /**
   * Validate exam tips array
   * @param {Array} tips - Generated tips
   * @returns {Array} Validated tips
   */
  validateExamTips(tips) {
    if (!Array.isArray(tips)) {
      return ['Practice regularly', 'Review your mistakes', 'Ask questions when stuck'];
    }

    return tips
      .filter(tip => tip && typeof tip === 'string' && tip.length > 5)
      .slice(0, 5);
  }

  /**
   * Check if content is safe (no harmful content)
   * @param {string} text - Content to check
   * @returns {boolean} Is safe
   */
  isContentSafe(text) {
    if (!text || typeof text !== 'string') return false;

    const unsafePatterns = [
      /<script/i,
      /javascript:/i,
      /onclick/i,
      /onerror/i,
      /eval\(/i,
      /document\./i,
      /window\./i
    ];

    return !unsafePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if question object is valid
   * @private
   */
  _isValidQuestion(q) {
    if (!q || typeof q !== 'object') return false;
    if (!q.question || typeof q.question !== 'string') return false;
    if (q.question.length < 5) return false;

    if (q.type === 'multiple-choice') {
      return Array.isArray(q.options) &&
             q.options.length >= 2 &&
             q.correctAnswer &&
             typeof q.correctAnswer === 'string';
    }

    return true; // Open questions just need question text
  }

  /**
   * Check if example object is valid
   * @private
   */
  _isValidExample(ex) {
    if (!ex || typeof ex !== 'object') return false;
    if (!ex.problem || typeof ex.problem !== 'string') return false;
    if (!ex.solution || typeof ex.solution !== 'string') return false;

    return ex.problem.length > 5 && ex.solution.length > 5;
  }

  /**
   * Check if misconception object is valid
   * @private
   */
  _isValidMisconception(m) {
    if (!m || typeof m !== 'object') return false;
    if (!m.description || typeof m.description !== 'string') return false;
    if (!m.suggestion || typeof m.suggestion !== 'string') return false;

    return m.description.length > 10 && m.suggestion.length > 10;
  }

  /**
   * Generate fallback questions
   * @private
   */
  _generateFallbackQuestions(count) {
    const questions = [];
    for (let i = 0; i < count; i++) {
      questions.push({
        question: `Can you explain the key concept in your own words?`,
        type: 'open',
        difficulty: 'medium',
        expectedAnswer: 'Student should demonstrate understanding'
      });
    }
    return questions;
  }

  /**
   * Generate fallback examples
   * @private
   */
  _generateFallbackExamples(count) {
    const examples = [];
    for (let i = 0; i < count; i++) {
      examples.push({
        problem: 'Work through a practice problem',
        solution: 'Step-by-step solution showing the method',
        explanation: 'This demonstrates the key principles'
      });
    }
    return examples;
  }

  /**
   * Create a single fallback question
   * @private
   */
  _createFallbackQuestion() {
    return {
      question: 'Explain what you understand about this topic',
      type: 'open',
      difficulty: 'medium',
      expectedAnswer: 'Student demonstrates understanding'
    };
  }

  /**
   * Create a single fallback example
   * @private
   */
  _createFallbackExample() {
    return {
      problem: 'Practice applying this concept',
      solution: 'Follow the steps carefully',
      explanation: 'This reinforces learning'
    };
  }
}

module.exports = ContentValidator;