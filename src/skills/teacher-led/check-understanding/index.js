// Skill: check-understanding
// Type: active
// Phase: Teacher-Led mode - Check student understanding after explanation
//
// MODIFIED: Added dynamic question generation using KnowledgeEnhancer
//
// Responsibility:
//   Generate questions to check student understanding of a concept.
//   Evaluate student responses and provide feedback.
//   Supports both multiple-choice and open-ended questions.
//   Personalises question difficulty based on student model.
//   Uses KnowledgeEnhancer to dynamically generate relevant questions.

'use strict';

// ─────────────────────────────────────────────────────────────
// Dynamic content enhancer
// ─────────────────────────────────────────────────────────────

let KnowledgeEnhancer = null;
try {
  KnowledgeEnhancer = require('../../main/services/knowledge-enhancer');
} catch (err) {
  // KnowledgeEnhancer not available - will use traditional methods
  console.warn('[CheckUnderstanding] KnowledgeEnhancer not available, using traditional questions');
}

// ─────────────────────────────────────────────────────────────
// Subject detection
// ─────────────────────────────────────────────────────────────

function isEnglishSubject(activeSubject) {
  return activeSubject === 'english-advanced';
}

function isMathsSubject(activeSubject) {
  return activeSubject?.startsWith('maths') || activeSubject === 'maths-advanced';
}

// ─────────────────────────────────────────────────────────────
// Question generators
// ─────────────────────────────────────────────────────────────

/**
 * Generate a check question using KnowledgeEnhancer
 */
async function generateEnhancedQuestion(topic, studentModel, knowledgeBase, model, params) {
  const { questionType = 'auto', difficulty = 'medium', count = 1 } = params;

  if (!KnowledgeEnhancer) return null;

  try {
    const enhancer = new KnowledgeEnhancer(model, knowledgeBase);

    // Generate questions using enhancer
    const questions = await enhancer.generateQuestions(
      topic,
      count,
      difficulty,
      studentModel
    );

    if (questions && questions.length > 0) {
      return questions[0]; // Return first question for single question generation
    }
  } catch (err) {
    console.warn('[CheckUnderstanding] Enhanced question generation failed:', err.message);
  }

  return null;
}

/**
 * Generate a check question based on topic and student model (traditional)
 */
async function generateTraditionalQuestion(topic, studentModel, knowledgeBase, model, params) {
  const { questionType = 'auto', difficulty = 'medium' } = params;

  // Try to get from knowledge base first
  const syllabusMap = knowledgeBase?.syllabusMap || {};
  const topicData = syllabusMap[topic] || {};

  if (topicData.checkQuestions && topicData.checkQuestions.length > 0) {
    // Select appropriate question based on difficulty
    const questions = topicData.checkQuestions;
    const index = Math.min(Math.floor(questions.length * 0.5), questions.length - 1);
    return {
      question: questions[index],
      type: 'open',
      source: 'knowledge-base',
      difficulty
    };
  }

  // Generate question using LLM
  const subject = knowledgeBase?.subjectId || 'maths-advanced';
  const isMaths = isMathsSubject(subject);
  const isEnglish = isEnglishSubject(subject);

  const prompt = [
    {
      role: 'system',
      content: `You are an expert HSC tutor. Generate a ${difficulty} difficulty question to check student understanding of ${topic}.

      The question should:
      - Test conceptual understanding, not just recall
      - Be appropriate for HSC ${subject} students
      - Have a clear correct answer
      - Include a brief marking guide

      Return a JSON object with:
      {
        "question": "the question text",
        "type": "open" or "multiple-choice",
        "options": ["option1", "option2", "option3", "option4"] (if multiple-choice),
        "correctAnswer": "the correct answer or option letter",
        "explanation": "brief explanation of why this is correct",
        "difficulty": "${difficulty}"
      }`
    },
    {
      role: 'user',
      content: `Generate a check question for topic: ${topic}`
    }
  ];

  try {
    const response = await model.chat(prompt, {
      temperature: 0.7,
      maxTokens: 500,
      skillName: 'check-understanding-generate'
    });

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn('[CheckUnderstanding] Failed to generate question:', err);
  }

  // Fallback question
  return {
    question: `Can you explain in your own words what you understand about ${topic}?`,
    type: 'open',
    correctAnswer: 'Student demonstrates understanding of key concepts',
    explanation: 'A good answer should include the main ideas and show comprehension.',
    difficulty
  };
}

/**
 * Generate multiple questions at once
 */
async function generateMultipleQuestions(topic, count, studentModel, knowledgeBase, model, params) {
  const { difficulty = 'medium', useEnhanced = true } = params;

  // Try enhanced generation first
  if (useEnhanced && KnowledgeEnhancer) {
    try {
      const enhancer = new KnowledgeEnhancer(model, knowledgeBase);
      const questions = await enhancer.generateQuestions(
        topic,
        count,
        difficulty,
        studentModel
      );

      if (questions && questions.length >= count) {
        return questions.slice(0, count);
      }
    } catch (err) {
      console.warn('[CheckUnderstanding] Multiple question generation failed:', err);
    }
  }

  // Fallback to generating one by one
  const questions = [];
  for (let i = 0; i < count; i++) {
    const question = await generateTraditionalQuestion(
      topic,
      studentModel,
      knowledgeBase,
      model,
      { difficulty, questionType: 'auto' }
    );
    questions.push(question);
  }

  return questions;
}

// ─────────────────────────────────────────────────────────────
// Answer evaluation
// ─────────────────────────────────────────────────────────────

/**
 * Evaluate student's answer
 */
async function evaluateAnswer(question, studentAnswer, studentModel, model, knowledgeBase) {
  const { type, correctAnswer, explanation } = question;

  // For multiple choice, simple comparison
  if (type === 'multiple-choice' && correctAnswer) {
    const isCorrect = studentAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase();
    return {
      isCorrect,
      feedback: isCorrect
        ? '✅ Correct! ' + (explanation || '')
        : `❌ That's not correct. The answer is ${correctAnswer}. ${explanation || ''}`,
      score: isCorrect ? 1.0 : 0.0
    };
  }

  // For open-ended questions, use LLM to evaluate
  const prompt = [
    {
      role: 'system',
      content: `You are an expert HSC tutor evaluating a student's understanding.

      Question: ${question.question}
      Expected understanding: ${correctAnswer || 'Student should demonstrate understanding'}

      Evaluate the student's answer and provide:
      1. Whether it demonstrates understanding (true/false)
      2. Specific feedback on what they got right/wrong
      3. A score from 0.0 to 1.0

      Be encouraging but honest. Focus on the conceptual understanding shown.`
    },
    {
      role: 'user',
      content: `Student answer: ${studentAnswer}`
    }
  ];

  try {
    const response = await model.chat(prompt, {
      temperature: 0.3,
      maxTokens: 300,
      skillName: 'check-understanding-evaluate'
    });

    // Parse the response
    const isCorrect = response.toLowerCase().includes('true') ||
                      response.toLowerCase().includes('correct') ||
                      response.toLowerCase().includes('understands');

    return {
      isCorrect,
      feedback: response,
      score: isCorrect ? 0.8 : 0.3
    };
  } catch (err) {
    console.warn('[CheckUnderstanding] Evaluation failed:', err);
  }

  // Fallback evaluation
  return {
    isCorrect: studentAnswer.length > 20,
    feedback: studentAnswer.length > 20
      ? 'Thanks for your answer. You seem to have some understanding.'
      : 'Please provide a more detailed answer.',
    score: studentAnswer.length > 20 ? 0.6 : 0.2
  };
}

// ─────────────────────────────────────────────────────────────
// Knowledge base helpers
// ─────────────────────────────────────────────────────────────

/**
 * Get topic name from knowledge base
 */
function getTopicName(topicCode, knowledgeBase) {
  const syllabusMap = knowledgeBase?.syllabusMap || {};
  return syllabusMap[topicCode]?.name || topicCode;
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name: 'check-understanding',
    version: '1.1.0', // Updated version
    type: 'active',
  },

  /**
   * @param {object} params
   *   - topic           {string}        — topic code to check understanding for
   *   - studentAnswer   {string|null}   — student's answer (if evaluating)
   *   - question        {object|null}   — previous question (if evaluating)
   *   - action          {string}        — 'generate' | 'evaluate' | 'generate-multiple'
   *   - questionType    {string}        — 'auto' | 'open' | 'multiple-choice'
   *   - difficulty      {string}        — 'easy' | 'medium' | 'hard'
   *   - count           {number}        — number of questions to generate (for generate-multiple)
   *   - useEnhanced     {boolean}       — whether to use dynamic enhancement
   *   - activeSubject   {string}        — current subject
   *
   * @param {object} context
   *   - studentId      {string}
   *   - memory         {MemoryManager}
   *   - studentModel   {object}
   *   - model          {ModelManager}
   *   - knowledgeBase  {object}
   *
   * @returns {Promise<object>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model, knowledgeBase } = context;
    const {
      topic,
      studentAnswer,
      question,
      action = 'generate',
      questionType = 'auto',
      difficulty = 'medium',
      count = 3,
      useEnhanced = true,
      activeSubject
    } = params;

    // Action: Generate a single question
    if (action === 'generate') {
      if (!topic) {
        throw new Error('Topic required for generating question');
      }

      // Try enhanced generation first
      let generatedQuestion = null;
      if (useEnhanced && KnowledgeEnhancer) {
        generatedQuestion = await generateEnhancedQuestion(
          topic,
          studentModel,
          knowledgeBase,
          model,
          { questionType, difficulty, count: 1 }
        );
      }

      // Fall back to traditional generation
      if (!generatedQuestion) {
        generatedQuestion = await generateTraditionalQuestion(
          topic,
          studentModel,
          knowledgeBase,
          model,
          { questionType, difficulty }
        );
      }

      // Log that question was generated
      if (memory) {
        try {
          memory.recordAttempt(
            studentId,
            topic,
            `Generated check question: ${generatedQuestion.question}`,
            'question-generated',
            null,
            null
          );
        } catch {
          // Non-fatal
        }
      }

      return {
        result: generatedQuestion.question,
        question: generatedQuestion,
        action: 'generated',
        topic,
        syllabusPoint: topic,
        enhanced: useEnhanced && KnowledgeEnhancer ? !!generatedQuestion : false
      };
    }

    // Action: Generate multiple questions
    if (action === 'generate-multiple') {
      if (!topic) {
        throw new Error('Topic required for generating questions');
      }

      const questions = await generateMultipleQuestions(
        topic,
        count,
        studentModel,
        knowledgeBase,
        model,
        { difficulty, useEnhanced }
      );

      return {
        result: `Generated ${questions.length} questions`,
        questions,
        action: 'generated-multiple',
        topic,
        syllabusPoint: topic,
        count: questions.length,
        enhanced: useEnhanced && KnowledgeEnhancer
      };
    }

    // Action: Evaluate an answer
    if (action === 'evaluate') {
      if (!question || !studentAnswer) {
        throw new Error('Question and student answer required for evaluation');
      }

      const evaluation = await evaluateAnswer(
        question,
        studentAnswer,
        studentModel,
        model,
        knowledgeBase
      );

      // Log the evaluation result
      if (memory && topic) {
        try {
          memory.recordAttempt(
            studentId,
            topic,
            `Check question: ${question.question}`,
            studentAnswer,
            evaluation.isCorrect,
            evaluation.score
          );
        } catch {
          // Non-fatal
        }
      }

      const topicName = getTopicName(topic, knowledgeBase);

      return {
        result: evaluation.feedback,
        evaluation,
        action: 'evaluated',
        topic,
        syllabusPoint: topic,
        feedback: evaluation.feedback,
        isCorrect: evaluation.isCorrect,
        score: evaluation.score
      };
    }

    throw new Error(`Unknown action: ${action}`);
  },
};