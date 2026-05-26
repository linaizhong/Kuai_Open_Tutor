// Skill: evaluate-answer
// Type: active
// Phase: Teacher-Led mode - Evaluate student answers with detailed assessment
//
// MODIFIED: Added dynamic evaluation criteria using KnowledgeBaseManager
//
// Responsibility:
//   Evaluate student answers against expected responses or rubrics.
//   Provides detailed assessment including correctness score, partial credit,
//   specific feedback on each component, and suggestions for improvement.
//   Supports both objective (maths) and subjective (English) evaluations.
//   Uses KnowledgeBaseManager to access syllabus data and evaluation criteria.

'use strict';

// ─────────────────────────────────────────────────────────────
// Dynamic content enhancer (optional)
// ─────────────────────────────────────────────────────────────

let KnowledgeEnhancer = null;
let CacheService = null;

try {
  KnowledgeEnhancer = require('../../main/services/knowledge-enhancer');
  CacheService = require('../../main/services/cache-service');
} catch (err) {
  // Services not available - will use traditional methods
  console.warn('[EvaluateAnswer] KnowledgeEnhancer/CacheService not available, using traditional evaluation');
}

// ─────────────────────────────────────────────────────────────
// Cache instance
// ─────────────────────────────────────────────────────────────

let evaluationCache = null;
if (CacheService) {
  evaluationCache = new CacheService({ ttl: 30 * 60 * 1000 }); // 30 minutes cache
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
// Knowledge base helpers using KnowledgeBaseManager
// ─────────────────────────────────────────────────────────────

/**
 * Get topic data from knowledge base
 */
function getTopicData(topicCode, knowledgeBase) {
  if (!knowledgeBase || !knowledgeBase.syllabusMap) return null;

  // Try to find topic in syllabusMap
  const syllabusMap = knowledgeBase.syllabusMap;

  // Direct lookup
  if (syllabusMap[topicCode]) {
    return syllabusMap[topicCode];
  }

  // Search through topics and subtopics
  if (syllabusMap.topics) {
    for (const topic of syllabusMap.topics) {
      if (topic.code === topicCode) return topic;

      if (topic.subtopics) {
        for (const subtopic of topic.subtopics) {
          if (subtopic.code === topicCode) return subtopic;

          if (subtopic.dotPoints) {
            for (const dotPoint of subtopic.dotPoints) {
              if (dotPoint.code === topicCode) return dotPoint;
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Get evaluation criteria from knowledge base
 */
function getCriteriaFromKnowledgeBase(topicCode, knowledgeBase) {
  if (!knowledgeBase) return null;

  const topicData = getTopicData(topicCode, knowledgeBase);
  if (!topicData) return null;

  // Return pre-defined criteria if available
  if (topicData.evaluationCriteria) {
    return topicData.evaluationCriteria;
  }

  // Generate basic criteria from topic data
  const subject = knowledgeBase.subjectId;

  if (isMathsSubject(subject)) {
    return {
      type: 'maths',
      criteria: [
        {
          name: 'Correctness',
          weight: 0.5,
          description: 'Answer is mathematically correct',
          maxScore: 5,
          keywords: topicData.keywords || []
        },
        {
          name: 'Working',
          weight: 0.3,
          description: 'Shows clear step-by-step working',
          maxScore: 3
        },
        {
          name: 'Notation',
          weight: 0.2,
          description: 'Uses correct mathematical notation',
          maxScore: 2
        }
      ],
      totalScore: 10,
      topicName: topicData.name,
      difficulty: topicData.difficulty || 'medium'
    };
  } else if (isEnglishSubject(subject)) {
    return {
      type: 'english',
      criteria: [
        {
          name: 'Understanding',
          weight: 0.3,
          description: 'Demonstrates understanding of the concept',
          maxScore: 3,
          keyConcepts: topicData.keyConcepts || []
        },
        {
          name: 'Analysis',
          weight: 0.3,
          description: 'Provides thoughtful analysis',
          maxScore: 3
        },
        {
          name: 'Evidence',
          weight: 0.2,
          description: 'Uses relevant textual evidence',
          maxScore: 2
        },
        {
          name: 'Structure',
          weight: 0.2,
          description: 'Answer is well-structured and clear',
          maxScore: 2
        }
      ],
      totalScore: 10,
      topicName: topicData.name,
      difficulty: topicData.difficulty || 'medium'
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Dynamic evaluation criteria generation using KnowledgeEnhancer
// ─────────────────────────────────────────────────────────────

/**
 * Generate evaluation criteria using KnowledgeEnhancer
 */
async function generateEnhancedCriteria(question, subject, knowledgeBase, topic, studentModel, model) {
  if (!KnowledgeEnhancer) return null;

  try {
    const enhancer = new KnowledgeEnhancer(model, knowledgeBase);

    // Get topic data from knowledge base
    const topicData = getTopicData(topic, knowledgeBase) || {};

    // Determine question type and complexity
    const questionText = typeof question === 'string' ? question : question.question;
    const wordCount = questionText.split(/\s+/).length;
    const complexity = wordCount > 50 ? 'complex' : (wordCount > 20 ? 'moderate' : 'simple');

    // Generate dynamic criteria based on question and topic
    const prompt = [
      {
        role: 'system',
        content: `You are an expert HSC ${subject} examiner. Generate evaluation criteria for this question.

        Question: ${questionText}
        Topic: ${topicData.name || topic}
        Topic Description: ${topicData.description || ''}
        Difficulty: ${topicData.difficulty || 'medium'}
        Complexity: ${complexity}

        Return a JSON object with:
        {
          "type": "maths|english|generic",
          "criteria": [
            {
              "name": "criterion name",
              "weight": 0.0-1.0,
              "description": "what this criterion assesses",
              "keyPoints": ["point1", "point2"],
              "maxScore": number
            }
          ],
          "totalScore": number,
          "markingGuide": "brief explanation of how to apply these criteria",
          "sampleAnswers": ["high", "medium", "low"] (optional)
        }`
      }
    ];

    const response = await model.chat(prompt, {
      temperature: 0.4,
      maxTokens: 800,
      skillName: 'evaluate-answer-criteria'
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const criteria = JSON.parse(jsonMatch[0]);
      // Add topic metadata
      criteria.topicName = topicData.name || topic;
      criteria.topicCode = topic;
      return criteria;
    }
  } catch (err) {
    console.warn('[EvaluateAnswer] Enhanced criteria generation failed:', err);
  }

  return null;
}

/**
 * Get traditional evaluation criteria
 */
function getTraditionalCriteria(question, subject, knowledgeBase, topic) {
  // Try to get from knowledge base first
  const kbCriteria = getCriteriaFromKnowledgeBase(topic, knowledgeBase);
  if (kbCriteria) return kbCriteria;

  // Default criteria based on subject
  if (isMathsSubject(subject)) {
    return {
      type: 'maths',
      criteria: [
        { name: 'Correctness', weight: 0.5, description: 'Answer is mathematically correct', maxScore: 5 },
        { name: 'Working', weight: 0.3, description: 'Shows clear step-by-step working', maxScore: 3 },
        { name: 'Notation', weight: 0.2, description: 'Uses correct mathematical notation', maxScore: 2 }
      ],
      totalScore: 10
    };
  } else if (isEnglishSubject(subject)) {
    return {
      type: 'english',
      criteria: [
        { name: 'Understanding', weight: 0.3, description: 'Demonstrates understanding of the concept', maxScore: 3 },
        { name: 'Analysis', weight: 0.3, description: 'Provides thoughtful analysis', maxScore: 3 },
        { name: 'Evidence', weight: 0.2, description: 'Uses relevant textual evidence', maxScore: 2 },
        { name: 'Structure', weight: 0.2, description: 'Answer is well-structured and clear', maxScore: 2 }
      ],
      totalScore: 10
    };
  }

  // Generic criteria
  return {
    type: 'generic',
    criteria: [
      { name: 'Correctness', weight: 0.5, description: 'Answer addresses the question correctly', maxScore: 5 },
      { name: 'Completeness', weight: 0.3, description: 'Answer is complete and thorough', maxScore: 3 },
      { name: 'Clarity', weight: 0.2, description: 'Answer is clear and well-explained', maxScore: 2 }
    ],
    totalScore: 10
  };
}

// ─────────────────────────────────────────────────────────────
// Maths answer evaluation
// ─────────────────────────────────────────────────────────────

function evaluateMathsAnswer(studentAnswer, expectedAnswer, question, criteria) {
  // Normalise strings for comparison
  const normalise = (s) => s.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w\d=+\-*/^()]/g, '');

  const studentNorm = normalise(studentAnswer);
  const expectedNorm = normalise(expectedAnswer);

  const scores = {};
  let totalScore = 0;
  const feedback = [];
  const strengths = [];
  const improvements = [];

  // Evaluate each criterion
  for (const criterion of criteria.criteria) {
    let criterionScore = 0;
    let criterionFeedback = '';

    switch (criterion.name) {
      case 'Correctness':
        // Exact match
        if (studentNorm === expectedNorm) {
          criterionScore = criterion.maxScore;
          criterionFeedback = 'Perfect! Your answer is exactly right.';
          strengths.push('Correct final answer');
        }
        // Check for equivalent expressions
        else if (studentNorm.includes('=') && expectedNorm.includes('=')) {
          const studentParts = studentNorm.split('=');
          const expectedParts = expectedNorm.split('=');

          if (studentParts.length === 2 && expectedParts.length === 2) {
            if (studentParts[0] === expectedParts[0] && studentParts[1] === expectedParts[1]) {
              criterionScore = criterion.maxScore;
              criterionFeedback = 'Correct! Your equation matches.';
              strengths.push('Correct equation setup');
            }
          }
        }
        // Check for numeric answers
        else {
          const studentNum = parseFloat(studentNorm);
          const expectedNum = parseFloat(expectedNorm);

          if (!isNaN(studentNum) && !isNaN(expectedNum)) {
            if (Math.abs(studentNum - expectedNum) < 0.001) {
              criterionScore = criterion.maxScore;
              criterionFeedback = 'Correct! Your numeric answer is right.';
              strengths.push('Correct numeric calculation');
            } else {
              const accuracy = 1 - Math.min(1, Math.abs(studentNum - expectedNum) / Math.abs(expectedNum));
              criterionScore = Math.round(criterion.maxScore * accuracy * 10) / 10;
              criterionFeedback = `Close! The answer should be approximately ${expectedNum}.`;
              improvements.push('Check your calculations for accuracy');
            }
          } else {
            improvements.push('Review the correct answer format');
          }
        }
        break;

      case 'Working':
        // Check for evidence of working
        if (studentAnswer.length > 20) {
          criterionScore = criterion.maxScore * 0.7;
          criterionFeedback = 'You showed some working.';

          if (studentAnswer.includes('=') || studentAnswer.includes('→') || studentAnswer.includes('step')) {
            criterionScore = criterion.maxScore;
            criterionFeedback = 'Good step-by-step working shown.';
            strengths.push('Clear step-by-step working');
          } else {
            improvements.push('Show your working step by step');
          }
        } else {
          improvements.push('Include your working to get partial marks');
        }
        break;

      case 'Notation':
        // Check for proper mathematical notation
        if (studentAnswer.includes('=') || studentAnswer.match(/[+\-*/^]/)) {
          criterionScore = criterion.maxScore * 0.7;
          criterionFeedback = 'Basic notation used.';

          if (studentAnswer.match(/[a-z][\^]?\d/) || studentAnswer.includes('√') || studentAnswer.includes('π')) {
            criterionScore = criterion.maxScore;
            criterionFeedback = 'Excellent use of mathematical notation.';
            strengths.push('Good mathematical notation');
          } else {
            improvements.push('Use proper mathematical notation');
          }
        }
        break;

      default:
        criterionScore = criterion.maxScore * 0.5;
    }

    scores[criterion.name] = criterionScore;
    totalScore += criterionScore;
    if (criterionFeedback) {
      feedback.push(`${criterion.name}: ${criterionFeedback}`);
    }
  }

  return {
    scores,
    totalScore,
    maxScore: criteria.totalScore,
    feedback: feedback.join('\n'),
    percentage: (totalScore / criteria.totalScore) * 100,
    strengths,
    improvements: [...new Set(improvements)] // Remove duplicates
  };
}

// ─────────────────────────────────────────────────────────────
// English answer evaluation
// ─────────────────────────────────────────────────────────────

function evaluateEnglishAnswer(studentAnswer, expectedAnswer, question, criteria) {
  const scores = {};
  let totalScore = 0;
  const feedback = [];
  const strengths = [];
  const improvements = [];

  // Word count analysis
  const wordCount = studentAnswer.split(/\s+/).length;

  for (const criterion of criteria.criteria) {
    let criterionScore = 0;
    let criterionFeedback = '';

    switch (criterion.name) {
      case 'Understanding':
        // Check for key terms and concepts
        const keyTerms = (expectedAnswer || question).toLowerCase().split(/\s+/);
        const answerTerms = studentAnswer.toLowerCase().split(/\s+/);
        const commonTerms = keyTerms.filter(term =>
          term.length > 3 && answerTerms.includes(term)
        );

        criterionScore = Math.min(criterion.maxScore, (commonTerms.length / 3) * criterion.maxScore);
        if (criterionScore > criterion.maxScore * 0.7) {
          strengths.push('Good understanding demonstrated');
        } else if (criterionScore < criterion.maxScore * 0.3) {
          improvements.push('Show deeper understanding of concepts');
        }
        break;

      case 'Analysis':
        // Check for analytical language
        const analyticalTerms = ['demonstrates', 'suggests', 'implies', 'represents',
          'symbolises', 'conveys', 'highlights', 'emphasises', 'contrasts', 'reflects'];
        const hasAnalysis = analyticalTerms.some(term =>
          studentAnswer.toLowerCase().includes(term)
        );

        criterionScore = hasAnalysis ? criterion.maxScore : criterion.maxScore * 0.3;
        if (hasAnalysis) {
          strengths.push('Good analytical language used');
        } else {
          improvements.push('Use more analytical language in your response');
        }
        break;

      case 'Evidence':
        // Check for textual evidence
        if (studentAnswer.includes('"') || studentAnswer.includes("'") ||
            studentAnswer.includes('quote') || studentAnswer.includes('text')) {
          criterionScore = criterion.maxScore;
          strengths.push('Relevant textual evidence included');
        } else {
          criterionScore = criterion.maxScore * 0.2;
          improvements.push('Include specific textual evidence to support your points');
        }
        break;

      case 'Structure':
        // Check for paragraph structure
        if (studentAnswer.includes('\n\n') || studentAnswer.split('\n').length > 2) {
          criterionScore = criterion.maxScore;
          strengths.push('Well-structured response');
        } else if (wordCount > 100) {
          criterionScore = criterion.maxScore * 0.7;
          improvements.push('Use clearer paragraph structure');
        } else {
          criterionScore = criterion.maxScore * 0.5;
        }
        break;

      default:
        criterionScore = criterion.maxScore * 0.5;
    }

    scores[criterion.name] = criterionScore;
    totalScore += criterionScore;
  }

  // Length-based adjustment
  if (wordCount < 50) {
    improvements.push('Provide more detailed response');
    totalScore = Math.max(0, totalScore - 1);
  } else if (wordCount > 200) {
    strengths.push('Comprehensive response');
  }

  return {
    scores,
    totalScore,
    maxScore: criteria.totalScore,
    feedback: {
      summary: `Your response scored ${totalScore}/${criteria.totalScore} (${Math.round(totalScore/criteria.totalScore*100)}%)`,
      strengths,
      weaknesses: improvements
    },
    percentage: (totalScore / criteria.totalScore) * 100,
    strengths,
    improvements: [...new Set(improvements)]
  };
}

// ─────────────────────────────────────────────────────────────
// LLM-based evaluation for complex answers
// ─────────────────────────────────────────────────────────────

async function evaluateWithLLM(params, studentModel, model) {
  const {
    question,
    studentAnswer,
    expectedAnswer,
    subject,
    criteria
  } = params;

  const criteriaText = criteria.criteria
    .map(c => `- ${c.name} (${c.weight * 100}%): ${c.description}`)
    .join('\n');

  const prompt = [
    {
      role: 'system',
      content: `You are an expert HSC ${subject} marker. Evaluate the student's answer against the provided criteria.

      Evaluation criteria:
      ${criteriaText}

      Provide a structured evaluation with:
      1. Score breakdown for each criterion (0.0-1.0)
      2. Overall score (weighted average)
      3. Specific strengths
      4. Specific areas for improvement
      5. Constructive feedback for the student

      Return as JSON object with:
      {
        "scores": {"criterion1": 0.8, "criterion2": 0.6},
        "overallScore": 0.7,
        "strengths": ["strength1", "strength2"],
        "improvements": ["improvement1", "improvement2"],
        "feedback": "detailed feedback text"
      }`
    },
    {
      role: 'user',
      content: `Question: ${question.question || question}

Expected answer: ${expectedAnswer || 'See marking criteria'}

Student's answer: ${studentAnswer}

Evaluate this response.`
    }
  ];

  try {
    const response = await model.chat(prompt, {
      temperature: 0.3,
      maxTokens: 800,
      skillName: 'evaluate-answer-llm'
    });

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn('[EvaluateAnswer] LLM evaluation failed:', err);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Main evaluation dispatcher
// ─────────────────────────────────────────────────────────────

async function evaluateAnswer(params, context) {
  const {
    question,
    studentAnswer,
    expectedAnswer,
    subject,
    topic,
    evaluationType = 'auto',
    criteria: providedCriteria
  } = params;

  const { studentModel, model, knowledgeBase } = context;

  // Get or generate evaluation criteria
  let criteria = providedCriteria;
  if (!criteria) {
    // Try enhanced criteria first
    if (evaluationType === 'enhanced' || evaluationType === 'auto') {
      const enhancedCriteria = await generateEnhancedCriteria(
        question, subject, knowledgeBase, topic, studentModel, model
      );
      if (enhancedCriteria) {
        criteria = enhancedCriteria;
      }
    }

    // Fall back to traditional criteria from knowledge base
    if (!criteria) {
      criteria = getTraditionalCriteria(question, subject, knowledgeBase, topic);
    }
  }

  // Use LLM for complex evaluations
  if (evaluationType === 'detailed' ||
      (evaluationType === 'auto' && studentAnswer.length > 100)) {
    const llmEvaluation = await evaluateWithLLM({
      question,
      studentAnswer,
      expectedAnswer,
      subject,
      criteria
    }, studentModel, model);

    if (llmEvaluation) {
      return {
        ...llmEvaluation,
        criteria,
        method: 'llm'
      };
    }
  }

  // Subject-specific evaluation
  if (isMathsSubject(subject)) {
    const result = evaluateMathsAnswer(studentAnswer, expectedAnswer, question, criteria);
    return {
      ...result,
      criteria,
      method: 'rule-based'
    };
  } else if (isEnglishSubject(subject)) {
    const result = evaluateEnglishAnswer(studentAnswer, expectedAnswer, question, criteria);
    return {
      ...result,
      criteria,
      method: 'rule-based'
    };
  }

  // Generic evaluation
  return {
    scores: {},
    totalScore: studentAnswer.length > 50 ? 7 : 4,
    maxScore: 10,
    feedback: 'Your answer has been evaluated.',
    percentage: studentAnswer.length > 50 ? 70 : 40,
    strengths: [],
    improvements: [],
    criteria,
    method: 'generic'
  };
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name: 'evaluate-answer',
    version: '1.1.0',
    type: 'active',
  },

  /**
   * @param {object} params
   *   - question         {object|string}  — the question asked
   *   - studentAnswer    {string}         — student's response
   *   - expectedAnswer   {string}         — expected correct answer (optional)
   *   - topic            {string}         — topic code
   *   - subject          {string}         — subject (from activeSubject)
   *   - evaluationType   {string}         — 'simple' | 'detailed' | 'enhanced' | 'auto'
   *   - provideFeedback  {boolean}        — whether to include feedback text
   *   - useEnhanced      {boolean}        — whether to use enhanced criteria generation
   *   - criteria         {object}         — optional pre-defined criteria
   *   - activeSubject    {string}         — current subject
   *
   * @param {object} context
   *   - studentId      {string}
   *   - memory         {MemoryManager}
   *   - studentModel   {object}
   *   - model          {ModelManager}
   *   - knowledgeBase  {object}           — KnowledgeBase object with syllabusMap etc.
   *
   * @returns {Promise<object>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model, knowledgeBase } = context;
    const {
      question,
      studentAnswer,
      expectedAnswer,
      topic,
      subject: providedSubject,
      evaluationType = 'auto',
      provideFeedback = true,
      useEnhanced = true,
      criteria: providedCriteria,
      activeSubject
    } = params;

    if (!question || !studentAnswer) {
      throw new Error('Question and student answer are required');
    }

    const subject = providedSubject || activeSubject;

    // ── 1. Check cache ───────────────────────────────────────
    let cacheKey = null;
    if (evaluationCache && useEnhanced) {
      cacheKey = `evaluate:${topic}:${studentId}:${studentAnswer.substring(0, 50)}`;
      const cached = await evaluationCache.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          result: cached.feedback,
          fromCache: true
        };
      }
    }

    // ── 2. Perform evaluation ────────────────────────────────
    const evaluation = await evaluateAnswer({
      question,
      studentAnswer,
      expectedAnswer,
      subject,
      topic,
      evaluationType,
      criteria: providedCriteria
    }, {
      studentModel,
      model,
      knowledgeBase
    });

    // ── 3. Format feedback text ───────────────────────────────
    let feedbackText = '';

    if (provideFeedback) {
      if (evaluation.feedback) {
        feedbackText = typeof evaluation.feedback === 'string'
          ? evaluation.feedback
          : evaluation.feedback.summary || JSON.stringify(evaluation.feedback);
      } else {
        feedbackText = `Score: ${Math.round(evaluation.percentage)}% (${evaluation.totalScore}/${evaluation.maxScore})`;

        if (evaluation.strengths && evaluation.strengths.length > 0) {
          feedbackText += `\n\n✅ Strengths:\n• ${evaluation.strengths.join('\n• ')}`;
        }

        if (evaluation.improvements && evaluation.improvements.length > 0) {
          feedbackText += `\n\n📝 Areas for improvement:\n• ${evaluation.improvements.join('\n• ')}`;
        }
      }
    }

    // ── 4. Log evaluation in memory ───────────────────────────
    if (memory && topic) {
      try {
        memory.recordAttempt(
          studentId,
          topic,
          `Evaluation: ${question.question || question}`,
          studentAnswer,
          evaluation.percentage >= 70,
          evaluation.percentage / 100
        );
      } catch {
        // Non-fatal
      }
    }

    // ── 5. Prepare result ─────────────────────────────────────
    const result = {
      result: feedbackText,
      score: evaluation.overallScore || evaluation.percentage / 100 || 0,
      totalScore: evaluation.totalScore || 0,
      maxScore: evaluation.maxScore || 10,
      percentage: evaluation.percentage || 0,
      scores: evaluation.scores || {},
      criteria: evaluation.criteria || {},
      strengths: evaluation.strengths || [],
      improvements: evaluation.improvements || [],
      feedback: feedbackText,
      method: evaluation.method || 'generic',
      enhanced: !!(evaluation.criteria && evaluation.criteria.type === 'enhanced'),
      syllabusPoint: topic || null
    };

    // ── 6. Cache the result ───────────────────────────────────
    if (evaluationCache && cacheKey) {
      await evaluationCache.set(cacheKey, result);
    }

    return result;
  },
};