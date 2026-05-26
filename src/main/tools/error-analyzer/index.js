// tools/error-analyzer/index.js
// Analyzes student responses to identify common errors and misconceptions

const BaseTool = require('../base');

class ErrorAnalyzerTool extends BaseTool {
  constructor() {
    super(
      'error-analyzer',
      'Analyze student responses to identify common errors and misconceptions',
      '1.0.0'
    );
  }

  getParameters() {
    return [
      {
        name: 'text',
        type: 'string',
        description: 'Student response or answer to analyze',
        required: true,
      },
      {
        name: 'dotPoint',
        type: 'string',
        description: 'Syllabus dot-point code for context',
        required: false,
      },
      {
        name: 'expectedAnswer',
        type: 'string',
        description: 'Expected correct answer for comparison',
        required: false,
      },
      {
        name: 'questionType',
        type: 'string',
        description: 'Type of question (e.g., "speaking", "writing", "math")',
        required: false,
      },
    ];
  }

  async execute(params, context) {
    const { text, dotPoint, expectedAnswer, questionType } = params;
    const { knowledgeBase, studentModel } = context;

    const errors = [];
    const suggestions = [];

    // 1. Check against knowledge base common errors if dotPoint provided
    if (dotPoint && knowledgeBase?.dotPoints?.[dotPoint]) {
      const dp = knowledgeBase.dotPoints[dotPoint];
      if (dp.commonErrors) {
        for (const commonError of dp.commonErrors) {
          if (this._matchesError(text, commonError)) {
            errors.push({
              type: 'conceptual',
              description: commonError,
              severity: 'high',
              source: 'knowledge-base',
            });
            suggestions.push(this._generateSuggestion(commonError));
          }
        }
      }
    }

    // 2. Check for specific error types based on question type
    if (questionType) {
      const typeErrors = this._checkQuestionTypeErrors(text, questionType);
      errors.push(...typeErrors.errors);
      suggestions.push(...typeErrors.suggestions);
    }

    // 3. Compare with expected answer if provided
    if (expectedAnswer) {
      const comparison = this._compareWithExpected(text, expectedAnswer);
      errors.push(...comparison.errors);
      suggestions.push(...comparison.suggestions);
    }

    // 4. Language-specific checks for TOEFL
    if (questionType?.includes('speaking') || questionType?.includes('writing')) {
      const languageErrors = this._checkLanguageErrors(text);
      errors.push(...languageErrors.errors);
      suggestions.push(...languageErrors.suggestions);
    }

    // 5. Math-specific checks
    if (questionType?.includes('math')) {
      const mathErrors = this._checkMathErrors(text);
      errors.push(...mathErrors.errors);
      suggestions.push(...mathErrors.suggestions);
    }

    // 6. Prioritize errors
    const prioritized = this._prioritizeErrors(errors);

    // 7. Generate summary
    const summary = this._generateSummary(prioritized, suggestions, studentModel);

    return {
      errors: prioritized,
      suggestions: [...new Set(suggestions)], // Remove duplicates
      summary,
      errorCount: prioritized.length,
      hasCriticalErrors: prioritized.some(e => e.severity === 'high'),
    };
  }

  _matchesError(text, errorPattern) {
    const normalizedText = text.toLowerCase();
    const pattern = errorPattern.toLowerCase();

    // Check for key phrases
    const keyPhrases = pattern.split(/\s+/).filter(w => w.length > 3);
    const matchCount = keyPhrases.filter(phrase => normalizedText.includes(phrase)).length;

    return matchCount >= Math.min(2, keyPhrases.length);
  }

  _checkQuestionTypeErrors(text, questionType) {
    const errors = [];
    const suggestions = [];

    switch (questionType) {
      case 'independent-speaking':
        if (!text.includes('because') && !text.includes('reason')) {
          errors.push({
            type: 'structure',
            description: 'Response lacks clear reasons or explanations',
            severity: 'high',
          });
          suggestions.push('Add specific reasons to support your opinion using words like "because" or "firstly"');
        }
        if (text.length < 50) {
          errors.push({
            type: 'development',
            description: 'Response is too brief - needs more development',
            severity: 'medium',
          });
          suggestions.push('Expand your response with more details and examples');
        }
        break;

      case 'integrated-speaking':
        if (!text.includes('reading') && !text.includes('lecture') && !text.includes('professor')) {
          errors.push({
            type: 'integration',
            description: 'Response does not clearly connect to source materials',
            severity: 'high',
          });
          suggestions.push('Make explicit connections to the reading and lecture points');
        }
        break;

      case 'integrated-writing':
        if (text.includes('I think') || text.includes('I believe') || text.includes('in my opinion')) {
          errors.push({
            type: 'content',
            description: 'Integrated writing should NOT include personal opinion',
            severity: 'high',
          });
          suggestions.push('Remove personal opinions - focus only on summarizing the reading and lecture');
        }
        break;
    }

    return { errors, suggestions };
  }

  _compareWithExpected(studentAnswer, expectedAnswer) {
    const errors = [];
    const suggestions = [];

    const studentNorm = this._normalizeText(studentAnswer);
    const expectedNorm = this._normalizeText(expectedAnswer);

    // Check for missing key points
    const expectedPoints = expectedNorm.split('.');
    for (const point of expectedPoints) {
      if (point.trim().length > 20) { // Only check substantial points
        const keyWords = point.split(/\s+/).filter(w => w.length > 4);
        const missingWords = keyWords.filter(w => !studentNorm.includes(w));

        if (missingWords.length > keyWords.length * 0.5) {
          errors.push({
            type: 'content',
            description: `Missing key point: ${point.substring(0, 50)}...`,
            severity: 'high',
          });
          suggestions.push(`Make sure to include: ${point}`);
          break; // Only report one missing point per comparison
        }
      }
    }

    return { errors, suggestions };
  }

  _checkLanguageErrors(text) {
    const errors = [];
    const suggestions = [];

    // Common grammar patterns
    const grammarPatterns = [
      {
        pattern: /\b(a|an)\s+[aeiou]/i,
        error: 'Incorrect article usage before vowel sound',
        suggestion: 'Use "an" before vowel sounds (a, e, i, o, u)',
      },
      {
        pattern: /\b(he|she|it|they)\s+(don't|doesn't)\b/i,
        error: 'Subject-verb agreement error',
        suggestion: 'Use "doesn\'t" with he/she/it, "don\'t" with I/you/we/they',
      },
      {
        pattern: /\b(was|were)\s+(verb|Verbs?)\b/i,
        error: 'Incorrect verb form after was/were',
        suggestion: 'Use past participle after was/were (e.g., "was done", not "was do")',
      },
    ];

    for (const gp of grammarPatterns) {
      if (gp.pattern.test(text)) {
        errors.push({
          type: 'grammar',
          description: gp.error,
          severity: 'medium',
        });
        suggestions.push(gp.suggestion);
      }
    }

    // Check for repeated words
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].toLowerCase() === words[i + 1].toLowerCase() && words[i].length > 2) {
        errors.push({
          type: 'fluency',
          description: `Repeated word: "${words[i]}"`,
          severity: 'low',
        });
        suggestions.push('Avoid repeating words - vary your vocabulary');
        break;
      }
    }

    return { errors, suggestions };
  }

  _checkMathErrors(text) {
    const errors = [];
    const suggestions = [];

    // Check for common math notation errors
    if (text.includes('=') && !text.includes('=')) {
      // This is a placeholder - actual math error checking would be more sophisticated
    }

    return { errors, suggestions };
  }

  _prioritizeErrors(errors) {
    const priorityOrder = { high: 3, medium: 2, low: 1 };

    return errors.sort((a, b) => {
      // First by severity
      const severityDiff = (priorityOrder[b.severity] || 0) - (priorityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;

      // Then by type priority
      const typePriority = { conceptual: 3, content: 2, grammar: 1, structure: 1, fluency: 0 };
      return (typePriority[b.type] || 0) - (typePriority[a.type] || 0);
    });
  }

  _generateSuggestion(error) {
    const suggestions = {
      'Forgetting that zeros of f become asymptotes': 'Remember: when f(x) = 0, 1/f(x) has a vertical asymptote - it does NOT cross the x-axis',
      'Drawing 1/f(x) below the x-axis when f(x) is positive': 'Check the sign: when f(x) > 0, 1/f(x) is also positive',
      'Missing solutions in absolute value inequalities': 'Don\'t forget: |x| > a means x > a OR x < -a',
    };

    for (const [key, suggestion] of Object.entries(suggestions)) {
      if (error.toLowerCase().includes(key.toLowerCase())) {
        return suggestion;
      }
    }

    return `Review this concept: ${error}`;
  }

  _generateSummary(errors, suggestions, studentModel) {
    if (errors.length === 0) {
      return "Great work! I don't see any significant errors in your response.";
    }

    const criticalCount = errors.filter(e => e.severity === 'high').length;
    const mediumCount = errors.filter(e => e.severity === 'medium').length;

    let summary = `I found ${errors.length} area${errors.length > 1 ? 's' : ''} to work on: `;

    if (criticalCount > 0) {
      summary += `${criticalCount} critical ${criticalCount > 1 ? 'issues' : 'issue'} `;
    }
    if (mediumCount > 0) {
      summary += `${criticalCount > 0 ? 'and ' : ''}${mediumCount} medium-priority ${mediumCount > 1 ? 'areas' : 'area'}. `;
    }

    // Personalize based on student model
    if (studentModel?.affectiveState?.currentEngagement === 'frustrated') {
      summary += " Don't worry - these are common mistakes. Let's work through them one at a time.";
    } else if (studentModel?.learningStyle?.preferredRepresentation === 'visual') {
      summary += " I'll try to explain these with visual examples.";
    }

    return summary;
  }

  _normalizeText(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = ErrorAnalyzerTool;