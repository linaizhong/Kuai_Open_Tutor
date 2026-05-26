// Skill: provide-feedback
// Type: active
// Phase: Teacher-Led mode - Provide constructive feedback on student responses
//
// MODIFIED: Enhanced with dynamic feedback generation using KnowledgeEnhancer
//
// Responsibility:
//   Analyse student answers and provide personalised, constructive feedback.
//   Identifies misconceptions, highlights correct elements, and suggests improvements.
//   Tailors feedback tone and depth based on student model (affective state, learning style).
//   Uses KnowledgeEnhancer to generate context-aware, personalised feedback.

'use strict';

// ─────────────────────────────────────────────────────────────
// Dynamic content enhancer
// ─────────────────────────────────────────────────────────────

let KnowledgeEnhancer = null;
let CacheService = null;

try {
  KnowledgeEnhancer = require('../../main/services/knowledge-enhancer');
  CacheService = require('../../main/services/cache-service');
} catch (err) {
  // Services not available - will use traditional methods
  console.warn('[ProvideFeedback] KnowledgeEnhancer/CacheService not available, using traditional feedback');
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
// Cache instance
// ─────────────────────────────────────────────────────────────

let feedbackCache = null;
if (CacheService) {
  feedbackCache = new CacheService({ ttl: 60 * 60 * 1000 }); // 1 hour cache
}

// ─────────────────────────────────────────────────────────────
// Feedback tone adjustment based on student state
// ─────────────────────────────────────────────────────────────

function getToneInstructions(studentModel) {
  const engagement = studentModel?.affectiveState?.currentEngagement || 'focused';
  const frustration = studentModel?.affectiveState?.frustrationDepth || 'none';
  const confidence = studentModel?.profile?.confidenceLevel || 'medium';

  let toneInstruction = 'Be constructive and encouraging. Use a warm, supportive tone.';

  if (engagement === 'frustrated' || frustration === 'high') {
    toneInstruction = 'The student appears frustrated. Be very encouraging, patient, and supportive. Start with genuine praise for effort, then gently guide them toward the correct understanding. Use phrases like "Good attempt!" and "You're on the right track!"';
  } else if (engagement === 'confident' || confidence === 'high') {
    toneInstruction = 'The student is confident. Be concise and direct with feedback, while still being encouraging. Challenge them to think deeper. You can be more efficient with praise and focus on refinement.';
  } else if (engagement === 'fatigued') {
    toneInstruction = 'The student may be tired. Keep feedback brief and clear. Focus on one or two key points. Use simple language and avoid overwhelming them with too much information.';
  } else if (engagement === 'bored') {
    toneInstruction = 'The student seems disengaged. Make feedback more engaging by connecting to their interests or challenging them with a thought-provoking question. Keep it lively!';
  }

  return toneInstruction;
}

// ─────────────────────────────────────────────────────────────
// Misconception detection
// ─────────────────────────────────────────────────────────────

async function detectMisconceptions(studentAnswer, question, knowledgeBase, topic, model) {
  const misconceptions = [];

  // Check knowledge base for common misconceptions about this topic
  const syllabusMap = knowledgeBase?.syllabusMap || {};
  const topicData = syllabusMap[topic] || {};
  const commonMisconceptions = topicData.commonMisconceptions || [];

  // Simple keyword-based detection from knowledge base
  for (const misconception of commonMisconceptions) {
    const keywords = misconception.keywords || [misconception.description?.toLowerCase()];
    for (const keyword of keywords) {
      if (keyword && studentAnswer.toLowerCase().includes(keyword.toLowerCase())) {
        misconceptions.push({
          type: 'known',
          description: misconception.description || 'Common misunderstanding',
          suggestion: misconception.suggestion || 'Review this concept carefully.',
          confidence: 0.8
        });
        break;
      }
    }
  }

  // Use LLM for deeper misconception detection if no clear matches
  if (misconceptions.length === 0 && model) {
    try {
      const prompt = [
        {
          role: 'system',
          content: `You are an expert tutor. Analyse the student's answer and identify any misconceptions.

          Question: ${question.question || question}
          Topic: ${topic}

          Return a JSON array of misconceptions found, or empty array if none.
          Each misconception should have:
          {
            "description": "what the student seems to misunderstand",
            "suggestion": "how to correct it",
            "confidence": 0.0-1.0
          }`
        },
        {
          role: 'user',
          content: `Student answer: ${studentAnswer}`
        }
      ];

      const response = await model.chat(prompt, {
        temperature: 0.3,
        maxTokens: 300,
        skillName: 'provide-feedback-detect'
      });

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const detected = JSON.parse(jsonMatch[0]);
        misconceptions.push(...detected);
      }
    } catch (err) {
      console.warn('[ProvideFeedback] LLM misconception detection failed:', err);
    }
  }

  return misconceptions;
}

// ─────────────────────────────────────────────────────────────
// Generate feedback using KnowledgeEnhancer
// ─────────────────────────────────────────────────────────────

async function generateEnhancedFeedback(params, studentModel, model, knowledgeBase) {
  const {
    question,
    studentAnswer,
    correctAnswer,
    topic,
    subject,
    misconceptions = []
  } = params;

  if (!KnowledgeEnhancer) return null;

  try {
    const enhancer = new KnowledgeEnhancer(model, knowledgeBase);

    // Use the enhancer's feedback template
    const prompt = [
      {
        role: 'system',
        content: `You are an expert HSC ${subject} tutor providing personalised feedback.

        Question: ${question.question || question}
        ${correctAnswer ? `Expected answer: ${correctAnswer}` : ''}

        Student's answer: ${studentAnswer}

        ${misconceptions.length > 0 ? `Potential misconceptions detected: ${misconceptions.map(m => m.description).join(', ')}` : ''}

        Provide structured feedback that includes:
        1. What they did well (specific praise)
        2. Areas for improvement (specific and actionable)
        3. A clear explanation of any errors
        4. A suggestion for how to improve
        5. Encouragement to keep learning

        Be encouraging but honest. Use a warm, supportive tone.`
      }
    ];

    const response = await model.chat(prompt, {
      temperature: 0.5,
      maxTokens: 600,
      skillName: 'provide-feedback-enhanced'
    });

    return {
      feedback: response,
      enhanced: true
    };
  } catch (err) {
    console.warn('[ProvideFeedback] Enhanced feedback generation failed:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Generate feedback using LLM (traditional)
// ─────────────────────────────────────────────────────────────

async function generateLLMFeedback(params, studentModel, model) {
  const {
    question,
    studentAnswer,
    correctAnswer,
    topic,
    subject,
    misconceptions = []
  } = params;

  const toneInstructions = getToneInstructions(studentModel);
  const misconceptionText = misconceptions.length > 0
    ? `\nPotential misconceptions detected: ${misconceptions.map(m => m.description).join(', ')}`
    : '';

  const prompt = [
    {
      role: 'system',
      content: `You are an expert HSC ${subject} tutor providing feedback to a student.

      ${toneInstructions}

      Provide structured feedback that includes:
      1. What they did well (positive reinforcement)
      2. Specific areas for improvement
      3. A clear explanation of any errors
      4. A suggestion for how to improve

      Be encouraging but honest. Use a warm, supportive tone.
      ${misconceptionText}

      Format your response with clear sections, but keep it conversational and helpful.`
    },
    {
      role: 'user',
      content: `Question: ${question.question || question}

Student's answer: ${studentAnswer}

${correctAnswer ? `Correct answer/guideline: ${correctAnswer}` : ''}

Topic: ${topic}

Please provide feedback.`
    }
  ];

  try {
    const response = await model.chat(prompt, {
      temperature: 0.5,
      maxTokens: 500,
      skillName: 'provide-feedback'
    });

    return {
      feedback: response,
      enhanced: false
    };
  } catch (err) {
    console.warn('[ProvideFeedback] LLM feedback generation failed:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Generate simple rule-based feedback (fallback)
// ─────────────────────────────────────────────────────────────

function generateSimpleFeedback(params) {
  const {
    question,
    studentAnswer,
    isCorrect,
    correctAnswer,
    misconceptions = []
  } = params;

  if (isCorrect) {
    return {
      feedback: `✅ Good job! Your answer is correct.\n\n${correctAnswer ? `The correct answer is: ${correctAnswer}` : ''}\n\nKeep up the great work!`,
      enhanced: false
    };
  }

  let feedback = '❌ Not quite right. ';

  if (misconceptions.length > 0) {
    feedback += `\n\nI notice you might be thinking that ${misconceptions[0].description}. `;
    feedback += `Instead, try to ${misconceptions[0].suggestion}`;
  } else {
    feedback += `\n\nLet's review this carefully. `;
    if (correctAnswer) {
      feedback += `The correct answer is: ${correctAnswer}`;
    } else {
      feedback += `Take another look at the question and try again.`;
    }
  }

  feedback += '\n\nYou\'re making progress! Keep practicing.';

  return {
    feedback,
    enhanced: false
  };
}

// ─────────────────────────────────────────────────────────────
// Generate improvement suggestions
// ─────────────────────────────────────────────────────────────

function generateImprovementSuggestions(misconceptions, isCorrect, score) {
  const suggestions = [];

  if (misconceptions.length > 0) {
    suggestions.push(...misconceptions.map(m => m.suggestion));
  }

  if (!isCorrect && score < 0.5) {
    suggestions.push('Review the core concepts before attempting again');
    suggestions.push('Try breaking the problem down into smaller steps');
  } else if (!isCorrect) {
    suggestions.push('Check your working carefully for small errors');
    suggestions.push('Practice similar problems to build confidence');
  } else if (score < 0.9) {
    suggestions.push('Good job! Try to be more precise in your explanations');
  } else {
    suggestions.push('Excellent! Challenge yourself with harder problems');
  }

  return suggestions.slice(0, 3); // Limit to top 3 suggestions
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name: 'provide-feedback',
    version: '1.1.0', // Updated version
    type: 'active',
  },

  /**
   * @param {object} params
   *   - question         {object|string}  — the question asked
   *   - studentAnswer    {string}         — student's response
   *   - correctAnswer    {string}         — expected correct answer (optional)
   *   - isCorrect        {boolean}        — whether answer is correct (optional)
   *   - score            {number}          — optional score (0.0-1.0)
   *   - topic            {string}         — topic code
   *   - feedbackType     {string}         — 'simple' | 'detailed' | 'enhanced' | 'auto'
   *   - useEnhanced      {boolean}        — whether to use enhanced generation
   *   - activeSubject    {string}         — current subject
   *
   * @param {object} context
   *   - studentId      {string}
   *   - memory         {MemoryManager}
   *   - studentModel   {object}
   *   - model          {ModelManager}
   *   - knowledgeBase  {object}
   *
   * @returns {Promise<{
   *   result: string,                    // feedback text
   *   feedback: string,                   // same as result
   *   misconceptions: Array,               // detected misconceptions
   *   improvements: Array,                 // suggested improvements
   *   score: number|null,                  // 0.0-1.0 if applicable
   *   isCorrect: boolean|null,              // whether answer was correct
   *   enhanced: boolean,                    // whether enhanced generation was used
   *   syllabusPoint: string|null
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model, knowledgeBase } = context;
    const {
      question,
      studentAnswer,
      correctAnswer,
      isCorrect: providedIsCorrect,
      score: providedScore,
      topic,
      feedbackType = 'auto',
      useEnhanced = true,
      activeSubject
    } = params;

    if (!question || !studentAnswer) {
      throw new Error('Question and student answer are required');
    }

    // ── 1. Check cache for similar feedback ──────────────────
    let cacheKey = null;
    if (feedbackCache && useEnhanced) {
      cacheKey = `feedback:${topic}:${studentId}:${studentAnswer.substring(0, 50)}`;
      const cached = await feedbackCache.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          result: cached.feedback,
          fromCache: true
        };
      }
    }

    // ── 2. Detect misconceptions ────────────────────────────
    const misconceptions = await detectMisconceptions(
      studentAnswer,
      question,
      knowledgeBase,
      topic,
      model
    );

    // ── 3. Determine if answer is correct (if not provided) ──
    let isCorrect = providedIsCorrect;
    let score = providedScore;

    if (isCorrect === undefined && correctAnswer) {
      // Simple string comparison for exact matches
      isCorrect = studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
      score = isCorrect ? 1.0 : 0.3;
    }

    // ── 4. Generate feedback ─────────────────────────────────
    let feedbackResult = null;

    // Try enhanced feedback first
    if (useEnhanced && KnowledgeEnhancer && (feedbackType === 'enhanced' || feedbackType === 'auto')) {
      feedbackResult = await generateEnhancedFeedback({
        question,
        studentAnswer,
        correctAnswer,
        topic,
        subject: activeSubject,
        misconceptions,
        isCorrect
      }, studentModel, model, knowledgeBase);
    }

    // Try detailed LLM feedback if enhanced not available or appropriate
    if (!feedbackResult && (feedbackType === 'detailed' || (feedbackType === 'auto' && studentAnswer.length > 20))) {
      feedbackResult = await generateLLMFeedback({
        question,
        studentAnswer,
        correctAnswer,
        topic,
        subject: activeSubject,
        misconceptions,
        isCorrect
      }, studentModel, model);
    }

    // Fallback to simple feedback
    if (!feedbackResult) {
      feedbackResult = generateSimpleFeedback({
        question,
        studentAnswer,
        isCorrect,
        correctAnswer,
        misconceptions
      });
    }

    // ── 5. Extract improvement suggestions ───────────────────
    const improvements = generateImprovementSuggestions(
      misconceptions,
      isCorrect,
      score || (isCorrect ? 1.0 : 0.3)
    );

    // ── 6. Log feedback in memory ────────────────────────────
    if (memory && topic) {
      try {
        memory.recordAttempt(
          studentId,
          topic,
          `Feedback on: ${question.question || question}`,
          studentAnswer,
          isCorrect,
          score || (isCorrect ? 1.0 : 0.3)
        );
      } catch {
        // Non-fatal
      }
    }

    // ── 7. Prepare result ─────────────────────────────────────
    const result = {
      result: feedbackResult.feedback,
      feedback: feedbackResult.feedback,
      misconceptions,
      improvements,
      score: score !== undefined ? score : (isCorrect ? 1.0 : 0.3),
      isCorrect: isCorrect !== undefined ? isCorrect : null,
      enhanced: feedbackResult.enhanced || false,
      syllabusPoint: topic || null
    };

    // ── 8. Cache the result ──────────────────────────────────
    if (feedbackCache && cacheKey && feedbackResult.enhanced) {
      await feedbackCache.set(cacheKey, result);
    }

    return result;
  },
};