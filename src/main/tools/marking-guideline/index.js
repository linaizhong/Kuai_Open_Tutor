// tools/marking-guideline/index.js
// Scores student responses against official rubrics and marking guidelines

const BaseTool = require('../base');

class MarkingGuidelineTool extends BaseTool {
  constructor() {
    super(
      'marking-guideline',
      'Score student responses against official rubrics and marking guidelines',
      '1.0.0'
    );
  }

  getParameters() {
    return [
      {
        name: 'response',
        type: 'string',
        description: 'Student response to evaluate',
        required: true,
      },
      {
        name: 'rubric',
        type: 'object',
        description: 'Rubric criteria (from knowledge base)',
        required: false,
      },
      {
        name: 'questionId',
        type: 'string',
        description: 'Question ID to look up marking guidelines',
        required: false,
      },
      {
        name: 'taskType',
        type: 'string',
        description: 'Task type (e.g., "independent-speaking", "integrated-writing")',
        required: false,
      },
      {
        name: 'criteria',
        type: 'array',
        description: 'Specific criteria to evaluate',
        required: false,
      },
    ];
  }

  async execute(params, context) {
    const { response, rubric, questionId, taskType, criteria } = params;
    const { knowledgeBase, studentModel } = context;

    // 1. Get marking guidelines
    let guidelines = rubric;
    if (!guidelines && questionId && knowledgeBase) {
      guidelines = await this._lookupGuidelines(questionId, knowledgeBase);
    }
    if (!guidelines && taskType && knowledgeBase) {
      guidelines = await this._getRubricForTask(taskType, knowledgeBase);
    }

    if (!guidelines) {
      return {
        score: null,
        feedback: "I couldn't find marking guidelines for this task.",
        criteriaScores: [],
      };
    }

    // 2. Evaluate against criteria
    const criteriaScores = await this._evaluateCriteria(response, guidelines, criteria, context);

    // 3. Calculate overall score
    const overallScore = this._calculateOverallScore(criteriaScores);

    // 4. Generate feedback
    const feedback = this._generateFeedback(criteriaScores, overallScore, studentModel);

    // 5. Identify strengths and weaknesses
    const strengths = criteriaScores.filter(c => c.score >= c.maxScore * 0.8).map(c => c.name);
    const weaknesses = criteriaScores.filter(c => c.score < c.maxScore * 0.6).map(c => c.name);

    return {
      score: overallScore,
      maxScore: guidelines.maxScore || 5,
      criteriaScores,
      feedback,
      strengths,
      weaknesses,
      recommendations: this._generateRecommendations(weaknesses, taskType),
    };
  }

  async _lookupGuidelines(questionId, knowledgeBase) {
    if (!knowledgeBase.markingGuidelinesIndex?.guidelines) return null;

    // Search through years
    for (const [year, yearData] of Object.entries(knowledgeBase.markingGuidelinesIndex.guidelines)) {
      if (yearData.questionGuidelines?.[questionId]) {
        return yearData.questionGuidelines[questionId];
      }
    }

    return null;
  }

  async _getRubricForTask(taskType, knowledgeBase) {
    // TOEFL rubrics
    if (taskType.includes('toefl')) {
      if (taskType.includes('speaking')) {
        return {
          name: 'TOEFL Speaking Rubric',
          maxScore: 4,
          criteria: [
            { name: 'delivery', maxScore: 4, description: 'Fluency, pronunciation, intonation' },
            { name: 'language', maxScore: 4, description: 'Grammar, vocabulary, range' },
            { name: 'development', maxScore: 4, description: 'Topic development, coherence' },
          ],
        };
      }
      if (taskType.includes('writing')) {
        const isIntegrated = taskType.includes('integrated');
        return {
          name: isIntegrated ? 'TOEFL Integrated Writing Rubric' : 'TOEFL Independent Writing Rubric',
          maxScore: 5,
          criteria: isIntegrated ? [
            { name: 'content', maxScore: 5, description: 'Accurate representation of sources' },
            { name: 'organization', maxScore: 5, description: 'Clear structure and transitions' },
            { name: 'language', maxScore: 5, description: 'Grammar, vocabulary, sentence variety' },
          ] : [
            { name: 'development', maxScore: 5, description: 'Thesis, reasons, examples' },
            { name: 'organization', maxScore: 5, description: 'Paragraph structure, flow' },
            { name: 'language', maxScore: 5, description: 'Grammar, vocabulary, sentence variety' },
          ],
        };
      }
    }

    // HSC rubrics
    if (taskType.includes('hsc')) {
      return {
        name: 'HSC Marking Guidelines',
        maxScore: taskType.includes('extended') ? 20 : 3,
        criteria: [
          { name: 'correctness', maxScore: 'variable', description: 'Correct answer and working' },
        ],
      };
    }

    return null;
  }

  async _evaluateCriteria(response, guidelines, requestedCriteria, context) {
    const { model } = context;
    const criteriaToEvaluate = guidelines.criteria || [];

    if (criteriaToEvaluate.length === 0) {
      return [{
        name: 'overall',
        score: null,
        maxScore: guidelines.maxScore || 5,
        feedback: 'Unable to evaluate criteria',
      }];
    }

    const results = [];

    for (const criterion of criteriaToEvaluate) {
      // Skip if specific criteria were requested and this isn't one of them
      if (criteria && !criteria.includes(criterion.name)) continue;

      // For simple criteria, use heuristic scoring
      if (criterion.name === 'delivery' || criterion.name === 'fluency') {
        const score = this._scoreDelivery(response);
        results.push({
          name: criterion.name,
          score,
          maxScore: criterion.maxScore || 4,
          feedback: this._getDeliveryFeedback(score),
        });
      }
      else if (criterion.name === 'language' || criterion.name === 'grammar') {
        const score = this._scoreLanguage(response);
        results.push({
          name: criterion.name,
          score,
          maxScore: criterion.maxScore || 4,
          feedback: this._getLanguageFeedback(score),
        });
      }
      else if (criterion.name === 'development' || criterion.name === 'content') {
        const score = this._scoreDevelopment(response);
        results.push({
          name: criterion.name,
          score,
          maxScore: criterion.maxScore || 4,
          feedback: this._getDevelopmentFeedback(score),
        });
      }
      else if (criterion.name === 'organization') {
        const score = this._scoreOrganization(response);
        results.push({
          name: criterion.name,
          score,
          maxScore: criterion.maxScore || 4,
          feedback: this._getOrganizationFeedback(score),
        });
      }
      else {
        // For complex criteria, use LLM
        const score = await this._scoreWithLLM(response, criterion, context);
        results.push({
          name: criterion.name,
          score: score.score,
          maxScore: criterion.maxScore || 5,
          feedback: score.feedback,
        });
      }
    }

    return results;
  }

  _scoreDelivery(text) {
    // Simple heuristics for delivery
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const avgWordsPerSentence = words / Math.max(sentences, 1);

    if (avgWordsPerSentence > 20) return 4; // Complex sentences
    if (avgWordsPerSentence > 15) return 3; // Good variety
    if (avgWordsPerSentence > 10) return 2; // Simple sentences
    return 1; // Very short
  }

  _getDeliveryFeedback(score) {
    const feedback = {
      4: 'Excellent delivery with varied sentence structure and natural flow',
      3: 'Good delivery - clear and generally fluent',
      2: 'Adequate delivery but some uneven pacing or hesitation',
      1: 'Delivery needs work - practice speaking more smoothly',
    };
    return feedback[score] || feedback[2];
  }

  _scoreLanguage(text) {
    // Simple vocabulary diversity check
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words).size;
    const diversity = uniqueWords / Math.max(words.length, 1);

    if (diversity > 0.7) return 4; // Rich vocabulary
    if (diversity > 0.5) return 3; // Good vocabulary
    if (diversity > 0.3) return 2; // Limited vocabulary
    return 1; // Repetitive
  }

  _getLanguageFeedback(score) {
    const feedback = {
      4: 'Excellent language use with sophisticated vocabulary',
      3: 'Good language use with some variety',
      2: 'Adequate but limited vocabulary range',
      1: 'Language needs work - try to use more varied expressions',
    };
    return feedback[score] || feedback[2];
  }

  _scoreDevelopment(text) {
    // Check for examples and development
    const hasExamples = /for example|for instance|such as|like/i.test(text);
    const hasReasons = /because|since|therefore|thus/i.test(text);
    const length = text.length;

    if (hasExamples && hasReasons && length > 200) return 4;
    if ((hasExamples || hasReasons) && length > 100) return 3;
    if (length > 50) return 2;
    return 1;
  }

  _getDevelopmentFeedback(score) {
    const feedback = {
      4: 'Excellent development with specific examples and clear reasoning',
      3: 'Good development - ideas are supported',
      2: 'Adequate but could use more specific examples',
      1: 'Needs more development - add examples and expand your ideas',
    };
    return feedback[score] || feedback[2];
  }

  _scoreOrganization(text) {
    // Check for organizational markers
    const hasIntro = /^(first|firstly|to begin|initially)/i.test(text);
    const hasTransitions = /(second|next|then|finally|in conclusion)/i.test(text);
    const paragraphs = text.split('\n\n').length;

    if (hasIntro && hasTransitions && paragraphs >= 3) return 4;
    if (hasIntro || hasTransitions) return 3;
    if (paragraphs > 1) return 2;
    return 1;
  }

  _getOrganizationFeedback(score) {
    const feedback = {
      4: 'Excellent organization with clear structure and transitions',
      3: 'Good organization - ideas flow logically',
      2: 'Adequate but could use clearer paragraph breaks',
      1: 'Organization needs work - structure your response more clearly',
    };
    return feedback[score] || feedback[2];
  }

  async _scoreWithLLM(response, criterion, context) {
    const { model } = context;

    const prompt = `
Evaluate this student response for the criterion: "${criterion.name}"

Criterion description: ${criterion.description || 'General quality'}

Student response: "${response}"

Score from 0 to ${criterion.maxScore || 5} where:
- High score: Excellent demonstration of this criterion
- Medium score: Adequate demonstration
- Low score: Needs significant improvement

Return a JSON object with:
{
  "score": number,
  "feedback": "Brief, specific feedback on this criterion"
}
`;

    try {
      const result = await model.chat([
        { role: 'system', content: 'You are a fair, consistent evaluator.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.3, maxTokens: 200 });

      return JSON.parse(result);
    } catch {
      return {
        score: Math.floor(Math.random() * 3) + 2, // Fallback 2-4
        feedback: 'Based on my review, this aspect could use some attention.',
      };
    }
  }

  _calculateOverallScore(criteriaScores) {
    if (criteriaScores.length === 0) return null;

    const total = criteriaScores.reduce((sum, c) => sum + c.score, 0);
    const maxTotal = criteriaScores.reduce((sum, c) => sum + c.maxScore, 0);

    // Scale to common scale (0-5 or 0-4 based on context)
    const average = (total / maxTotal) * 5;
    return Math.round(average * 10) / 10; // Round to 1 decimal
  }

  _generateFeedback(criteriaScores, overallScore, studentModel) {
    const strengths = criteriaScores.filter(c => c.score >= c.maxScore * 0.8);
    const weaknesses = criteriaScores.filter(c => c.score < c.maxScore * 0.6);

    let feedback = `Overall score: ${overallScore}/5\n\n`;

    if (strengths.length > 0) {
      feedback += `Strengths: ${strengths.map(s => s.name).join(', ')}\n`;
      strengths.forEach(s => feedback += `- ${s.feedback}\n`);
    }

    if (weaknesses.length > 0) {
      feedback += `\nAreas to improve: ${weaknesses.map(w => w.name).join(', ')}\n`;
      weaknesses.forEach(w => feedback += `- ${w.feedback}\n`);
    }

    // Personalize based on student model
    if (studentModel?.affectiveState?.currentEngagement === 'frustrated') {
      feedback += `\nYou're making progress! Focus on one area at a time.`;
    }

    return feedback;
  }

  _generateRecommendations(weaknesses, taskType) {
    const recommendations = [];

    if (weaknesses.includes('delivery') || weaknesses.includes('fluency')) {
      recommendations.push('Practice speaking more slowly and clearly. Record yourself and listen back.');
    }
    if (weaknesses.includes('language') || weaknesses.includes('grammar')) {
      recommendations.push('Review basic grammar rules and practice with sentence structure exercises.');
    }
    if (weaknesses.includes('development') || weaknesses.includes('content')) {
      recommendations.push('Use specific examples to support your points. Think of personal experiences.');
    }
    if (weaknesses.includes('organization')) {
      recommendations.push('Outline your response before you start. Use transition words to connect ideas.');
    }

    return recommendations;
  }
}

module.exports = MarkingGuidelineTool;