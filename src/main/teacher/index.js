// teacher/index.js
// AI Teacher Core - Handles all teaching decisions and content generation

'use strict';

class AITeacher {
  /**
   * @param {object} config
   * @param {string} config.studentId
   * @param {object} config.memory - MemoryManager instance
   * @param {object} config.model - ModelManager instance
   * @param {object} config.skillManager - SkillManager instance
   * @param {object} config.knowledgeBase - Current subject's knowledge base
   */
  constructor(config) {
    this.studentId = config.studentId;
    this.memory = config.memory;
    this.model = config.model;
    this.skillManager = config.skillManager;
    this.knowledgeBase = config.knowledgeBase;
  }

  /**
   * Get topic name from knowledge base
   * @param {string} topicCode
   * @returns {string}
   * @private
   */
  _getTopicName(topicCode) {
    // Try to get from knowledge base first
    const syllabusMap = this.knowledgeBase?.syllabusMap;
    if (syllabusMap && syllabusMap[topicCode]) {
      return syllabusMap[topicCode].name || topicCode;
    }

    // Fallback to topic code
    return topicCode;
  }

  /**
   * Get topic objectives from knowledge base
   * @param {string} topicCode
   * @returns {Array}
   * @private
   */
  _getTopicObjectives(topicCode) {
    // Try to get from knowledge base first
    const syllabusMap = this.knowledgeBase?.syllabusMap;
    if (syllabusMap && syllabusMap[topicCode] && syllabusMap[topicCode].objectives) {
      return syllabusMap[topicCode].objectives;
    }

    // Default objectives for any topic
    return [
      'Understand key concepts',
      'Apply to solve problems',
      'Explain your reasoning'
    ];
  }

  /**
   * Get topic details from knowledge base
   * @param {string} topicCode
   * @returns {object}
   * @private
   */
  _getTopicDetails(topicCode) {
    const syllabusMap = this.knowledgeBase?.syllabusMap;
    return syllabusMap?.[topicCode] || {
      name: topicCode,
      objectives: this._getTopicObjectives(topicCode)
    };
  }

  /**
   * Plan a lesson for a topic
   * @param {object} options
   * @param {string} options.topic - Topic code (e.g., 'MA-C1')
   * @param {object} options.studentModel - Current student model
   * @param {string} options.subject - Subject ID
   * @returns {Promise<object>} Lesson plan
   */
  async planLesson({ topic, studentModel, subject }) {
    const topicDetails = this._getTopicDetails(topic);
    const topicName = this._getTopicName(topic);
    const objectives = this._getTopicObjectives(topic);

    // Create lesson plan
    return {
      topic,
      name: topicName,
      objectives,
      estimatedDuration: 45,
      teachingPoints: [
        `Introduction to ${topicName}`,
        `Key concepts and definitions`,
        `Worked examples`,
        `Common mistakes to avoid`
      ],
      examples: this._getExamples(topic)
    };
  }

  /**
   * Continue teaching the current lesson
   * @param {object} lesson - Current lesson plan
   * @param {number} progress - Current progress (0-100)
   * @param {object} studentModel - Current student model
   * @returns {Promise<object>} Next teaching segment
   */
  async continueTeaching(lesson, progress, studentModel) {
    // Generate next teaching segment based on progress
    const segments = [
      {
        content: `Let's start with the basics of ${lesson.name}.`,
        progress: 25,
        shouldCheck: false
      },
      {
        content: `Here's a key concept: ${lesson.teachingPoints[1] || 'understanding the core ideas'}.`,
        progress: 50,
        shouldCheck: false
      },
      {
        content: `Let's look at an example: ${lesson.examples?.[0] || 'work through a sample problem'}.`,
        progress: 75,
        shouldCheck: true
      },
      {
        content: `Now you try: Can you explain this concept in your own words?`,
        progress: 100,
        shouldCheck: true,
        isComplete: true
      }
    ];

    const nextSegment = segments.find(s => s.progress > progress) || segments[segments.length - 1];

    return {
      content: nextSegment.content,
      newProgress: nextSegment.progress,
      shouldCheck: nextSegment.shouldCheck || false,
      isComplete: nextSegment.isComplete || false
    };
  }

  /**
   * Explain a concept to the student
   * @param {string} topic - Topic code or name
   * @param {string} question - Student's question
   * @param {object} studentModel - Current student model
   * @returns {Promise<string>} Explanation
   */
  async explainConcept(topic, question, studentModel) {
    const topicName = this._getTopicName(topic);

    const prompt = [
      {
        role: 'system',
        content: `You are a patient HSC ${this.knowledgeBase?.subjectId || 'Maths'} tutor.
          Explain concepts clearly with examples.
          Keep explanations concise and easy to understand.
          Learning style: ${studentModel.learningStyle?.preferredRepresentation || 'balanced'}`
      },
      {
        role: 'user',
        content: `Topic: ${topicName}\nQuestion: ${question}\n\nProvide a clear explanation with an example:`
      }
    ];

    return await this.model.chat(prompt, { temperature: 0.5 });
  }

  /**
   * Generate practice exercises for a topic
   * @param {string} topic - Topic code
   * @param {number} count - Number of exercises
   * @param {object} studentModel - Current student model
   * @returns {Promise<Array>} Array of exercise objects
   */
  async generateExercises(topic, count = 3, studentModel) {
    const topicName = this._getTopicName(topic);

    // Try to use generate-quiz skill if available
    const generateQuizSkill = this.skillManager.getSkill('generate-quiz');

    if (generateQuizSkill) {
      try {
        const context = {
          studentId: this.studentId,
          memory: this.memory,
          studentModel,
          model: this.model,
          knowledgeBase: this.knowledgeBase
        };

        const result = await generateQuizSkill.module.execute(
          { topic: topicName, count, difficulty: 'medium' },
          context
        );

        return result.questions || this._getDefaultExercises(topic, count);
      } catch (err) {
        console.warn('[AITeacher] generate-quiz skill failed, using defaults');
      }
    }

    return this._getDefaultExercises(topic, count);
  }

  /**
   * Evaluate student's answer to an exercise
   * @param {object} exercise - Exercise object
   * @param {string} studentAnswer - Student's answer
   * @param {object} studentModel - Current student model
   * @returns {Promise<object>} Evaluation result
   */
  async evaluateAnswer(exercise, studentAnswer, studentModel) {
    // Simple evaluation for MVP
    const isCorrect = this._simpleCompare(studentAnswer, exercise.answer);

    return {
      isCorrect,
      feedback: isCorrect
        ? '✅ Correct! Well done.'
        : '❌ Not quite right. Try again or ask for a hint.',
      score: isCorrect ? 1.0 : 0.0,
      misconception: null
    };
  }

  /**
   * Provide a hint for an exercise
   * @param {object} exercise - Exercise object
   * @param {string} studentAnswer - Student's attempt
   * @param {string} misconception - Identified misconception
   * @param {object} studentModel - Current student model
   * @returns {Promise<string>} Hint
   */
  async provideHint(exercise, studentAnswer, misconception, studentModel) {
    return exercise.hint || "Try breaking the problem down into smaller steps. What's the first thing you need to do?";
  }

  /**
   * Assess student's mastery of a topic
   * @param {string} topic - Topic code
   * @param {string} response - Student's response to assessment
   * @param {object} studentModel - Current student model
   * @returns {Promise<object>} Assessment result
   */
  async assessMastery(topic, response, studentModel) {
    // Simple assessment - check if response is substantial
    const isComplete = response.length > 20;

    return {
      isComplete,
      masteryLevel: isComplete ? 0.8 : 0.5,
      feedback: isComplete
        ? 'Great understanding!'
        : 'Let\'s review this again next time.'
    };
  }

  /**
   * Generate homework based on lesson
   * @param {string} topic - Topic code
   * @param {object} studentModel - Current student model
   * @returns {Promise<object>} Homework assignment
   */
  async generateHomework(topic, studentModel) {
    const exercises = await this.generateExercises(topic, 2, studentModel);
    const topicName = this._getTopicName(topic);

    return {
      topic: topicName,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      exercises: exercises.map((e, i) => ({
        question: e.question,
        hint: e.hint
      }))
    };
  }

  /**
   * Get default exercises for a topic
   * @param {string} topic
   * @param {number} count
   * @returns {Array}
   * @private
   */
  _getDefaultExercises(topic, count) {
    const exercises = [];
    const topicName = this._getTopicName(topic);

    for (let i = 0; i < count; i++) {
      exercises.push({
        id: `ex-${Date.now()}-${i}`,
        question: `Practice question ${i + 1} for ${topicName}`,
        answer: 'Check your working',
        hint: 'Break it down step by step',
        difficulty: 'medium',
        dotPoint: topic
      });
    }
    return exercises;
  }

  /**
   * Get example for a topic
   * @param {string} topic
   * @returns {Array}
   * @private
   */
  _getExamples(topic) {
    // This could be extended to pull from knowledge base
    return [`Work through a sample problem for ${this._getTopicName(topic)}`];
  }

  _simpleCompare(studentAnswer, correctAnswer) {
    // Very simplified comparison
    if (!studentAnswer || !correctAnswer) return false;
    const normalize = (s) => s.toLowerCase().replace(/\s+/g, '').replace(/[^\w]/g, '');
    return normalize(studentAnswer).includes(normalize(correctAnswer)) ||
           normalize(correctAnswer).includes(normalize(studentAnswer));
  }
}

module.exports = AITeacher;