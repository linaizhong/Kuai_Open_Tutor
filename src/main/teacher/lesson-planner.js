// teacher/lesson-planner.js
// Lesson planning utilities for AI Teacher

'use strict';

class LessonPlanner {
  /**
   * @param {object} knowledgeBase - Current subject's knowledge base
   */
  constructor(knowledgeBase) {
    this.knowledgeBase = knowledgeBase;
  }

  /**
   * Create a detailed lesson plan for a topic
   * @param {string} topicCode - Topic code (e.g., 'MA-C1')
   * @param {object} studentModel - Current student model
   * @param {object} options - { pace, duration }
   * @returns {object} Detailed lesson plan
   */
  createLessonPlan(topicCode, studentModel, options = {}) {
    const pace = options.pace || 'standard';
    const duration = options.duration || 45;

    const topicDetails = this._getTopicDetails(topicCode);
    const dotPoints = this._getDotPointsForTopic(topicCode);

    // Adjust segment durations based on pace
    const paceFactors = {
      slow: { teaching: 1.3, practice: 1.2, assessment: 1.0 },
      standard: { teaching: 1.0, practice: 1.0, assessment: 1.0 },
      fast: { teaching: 0.8, practice: 1.0, assessment: 1.0 }
    };
    const factor = paceFactors[pace] || paceFactors.standard;

    return {
      topic: topicCode,
      name: topicDetails.name,
      objectives: this._generateObjectives(topicCode, studentModel),
      estimatedDuration: duration,
      phases: {
        teaching: {
          duration: Math.round(20 * factor.teaching),
          segments: this._createTeachingSegments(topicCode, dotPoints)
        },
        practice: {
          duration: Math.round(15 * factor.practice),
          exercises: this._planExercises(topicCode, studentModel)
        },
        assessment: {
          duration: Math.round(10 * factor.assessment),
          questions: this._planAssessmentQuestions(topicCode)
        }
      },
      commonMisconceptions: topicDetails.commonMisconceptions || [],
      prerequisites: this._getPrerequisites(topicCode)
    };
  }

  /**
   * Generate learning objectives for a topic
   * @param {string} topicCode
   * @param {object} studentModel
   * @returns {Array<string>}
   */
  _generateObjectives(topicCode, studentModel) {
    const objectives = {
      'MA-C1': [
        'Understand the definition of a derivative',
        'Find derivatives of simple functions using first principles',
        'Apply basic differentiation rules'
      ],
      'MA-F1': [
        'Simplify algebraic expressions',
        'Factorise quadratic expressions',
        'Solve linear and quadratic equations'
      ]
    };

    return objectives[topicCode] || [
      `Understand key concepts of ${topicCode}`,
      `Apply ${topicCode} to solve problems`,
      `Explain reasoning step by step`
    ];
  }

  /**
   * Create teaching segments for a topic
   * @param {string} topicCode
   * @param {Array} dotPoints
   * @returns {Array}
   */
  _createTeachingSegments(topicCode, dotPoints) {
    const segments = [
      {
        type: 'introduction',
        content: `Let's start with the basics of ${topicCode}.`,
        duration: 5
      },
      {
        type: 'concept',
        content: `The key idea is...`,
        duration: 8
      },
      {
        type: 'example',
        content: this._getExample(topicCode),
        duration: 7
      }
    ];

    return segments;
  }

  /**
   * Plan practice exercises for a topic
   * @param {string} topicCode
   * @param {object} studentModel
   * @returns {Array}
   */
  _planExercises(topicCode, studentModel) {
    const difficulty = this._determineDifficulty(studentModel);

    return [
      {
        type: 'basic',
        count: difficulty === 'easy' ? 3 : 2,
        questionTemplate: `Basic practice for ${topicCode}`
      },
      {
        type: 'application',
        count: difficulty === 'hard' ? 3 : 2,
        questionTemplate: `Applied problem for ${topicCode}`
      }
    ];
  }

  /**
   * Plan assessment questions
   * @param {string} topicCode
   * @returns {Array}
   */
  _planAssessmentQuestions(topicCode) {
    return [
      {
        type: 'conceptual',
        question: `Explain in your own words: ${topicCode}`
      },
      {
        type: 'procedural',
        question: `Solve: ${this._getExample(topicCode)}`
      }
    ];
  }

  /**
   * Determine appropriate difficulty based on student model
   * @param {object} studentModel
   * @returns {string} 'easy' | 'medium' | 'hard'
   */
  _determineDifficulty(studentModel) {
    const accuracy = studentModel.affectiveState?.recentSuccessRate;
    if (!accuracy) return 'medium';
    if (accuracy < 0.5) return 'easy';
    if (accuracy > 0.8) return 'hard';
    return 'medium';
  }

  _getTopicDetails(topicCode) {
    return this.knowledgeBase?.dotPoints?.[topicCode] || {
      name: topicCode,
      keyConcepts: [],
      commonMisconceptions: []
    };
  }

  _getDotPointsForTopic(topicCode) {
    const allPoints = this.knowledgeBase?.dotPoints || {};
    return Object.entries(allPoints)
      .filter(([code]) => code.startsWith(topicCode))
      .map(([code, data]) => ({ code, ...data }));
  }

  _getPrerequisites(topicCode) {
    const syllabusMap = this.knowledgeBase?.syllabusMap || {};
    return syllabusMap[topicCode]?.prerequisites || [];
  }

  _getExample(topicCode) {
    const examples = {
      'MA-C1': 'Find the derivative of f(x) = x² + 3x',
      'MA-F1': 'Simplify (x² + 5x + 6) / (x + 2)'
    };
    return examples[topicCode] || `Example for ${topicCode}`;
  }
}

module.exports = LessonPlanner;