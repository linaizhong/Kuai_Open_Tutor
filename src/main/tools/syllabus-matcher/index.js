// tools/syllabus-matcher/index.js
// Match user input to syllabus dot-points and topics

const BaseTool = require('../base');

class SyllabusMatcherTool extends BaseTool {
  constructor() {
    super(
      'syllabus-matcher',
      'Match user input to syllabus dot-points and topics',
      '1.0.0'
    );
  }

  getParameters() {
    return [
      {
        name: 'text',
        type: 'string',
        description: 'User input text to match',
        required: true,
      },
      {
        name: 'threshold',
        type: 'number',
        description: 'Minimum match score (0-1)',
        required: false,
        default: 0.3,
      },
      {
        name: 'maxResults',
        type: 'number',
        description: 'Maximum number of results',
        required: false,
        default: 5,
      },
    ];
  }

  validateParams(params) {
    if (!params.text) {
      throw new Error('Syllabus matcher requires text to match');
    }
  }

  async execute(params, context) {
    const { text, threshold = 0.3, maxResults = 5 } = params;
    const { knowledgeBase, studentModel } = context;

    if (!knowledgeBase || !knowledgeBase.dotPoints) {
      throw new Error('Knowledge base not available for syllabus matching');
    }

    // Normalize input text
    const normalized = this._normalizeText(text);

    // Match against all dot-points
    const matches = this._matchDotPoints(normalized, knowledgeBase.dotPoints, threshold);

    // Group matches by topic
    const byTopic = this._groupByTopic(matches);

    // Get student's mastery for matched topics (if available)
    if (studentModel?.masteryProfile) {
      matches.forEach(m => {
        m.studentMastery = studentModel.masteryProfile[m.code] || null;
      });
    }

    // Sort by relevance
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, maxResults);

    // Generate natural language interpretation
    const interpretation = this._interpretMatches(topMatches, studentModel);

    return {
      matches: topMatches,
      byTopic,
      interpretation,
      matchedCount: matches.length,
    };
  }

  /**
   * Normalize text for matching
   */
  _normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
      .replace(/\s+/g, ' ')       // Collapse multiple spaces
      .trim();
  }

  /**
   * Match text against all dot-points
   */
  _matchDotPoints(text, dotPoints, threshold) {
    const matches = [];
    const words = text.split(' ');

    for (const [code, dp] of Object.entries(dotPoints)) {
      let score = 0;
      const reasons = [];

      // Check code match (e.g., "MA-C2.1")
      if (code.toLowerCase().includes(text)) {
        score += 0.8;
        reasons.push('exact code match');
      }

      // Check name match
      if (dp.name) {
        const nameNorm = this._normalizeText(dp.name);
        if (nameNorm.includes(text)) {
          score += 0.7;
          reasons.push('name contains query');
        }
      }

      // Check keyword matches
      if (dp.keywords) {
        for (const keyword of dp.keywords) {
          const kwNorm = this._normalizeText(keyword);
          if (text.includes(kwNorm)) {
            score += 0.4;
            reasons.push(`keyword: ${keyword}`);
          } else {
            // Check word-by-word
            const kwWords = kwNorm.split(' ');
            const matchCount = kwWords.filter(w => words.includes(w)).length;
            if (matchCount > 0) {
              score += 0.2 * (matchCount / kwWords.length);
              reasons.push(`partial keyword: ${keyword}`);
            }
          }
        }
      }

      // Check key concepts
      if (dp.keyConcepts) {
        for (const concept of dp.keyConcepts) {
          const conceptNorm = this._normalizeText(concept);
          if (text.includes(conceptNorm)) {
            score += 0.3;
            reasons.push('concept match');
          }
        }
      }

      // Check common errors (for error analysis)
      if (dp.commonErrors) {
        for (const error of dp.commonErrors) {
          const errorNorm = this._normalizeText(error);
          if (text.includes(errorNorm)) {
            score += 0.5;
            reasons.push('common error mentioned');
          }
        }
      }

      if (score >= threshold) {
        matches.push({
          code,
          name: dp.name,
          topic: this._extractTopic(code),
          score: parseFloat(score.toFixed(4)),
          reasons: reasons.slice(0, 3), // Top 3 reasons
        });
      }
    }

    return matches;
  }

  /**
   * Extract topic code from dot-point code
   */
  _extractTopic(code) {
    const match = code.match(/^([A-Z]+-[A-Z]+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Group matches by topic
   */
  _groupByTopic(matches) {
    const groups = {};

    for (const match of matches) {
      if (!groups[match.topic]) {
        groups[match.topic] = {
          topic: match.topic,
          matches: [],
          totalScore: 0,
          count: 0,
        };
      }
      groups[match.topic].matches.push(match);
      groups[match.topic].totalScore += match.score;
      groups[match.topic].count += 1;
    }

    // Calculate average score per topic
    for (const topic in groups) {
      groups[topic].averageScore = groups[topic].totalScore / groups[topic].count;
    }

    return groups;
  }

  /**
   * Interpret matches in natural language
   */
  _interpretMatches(matches, studentModel) {
    if (matches.length === 0) {
      return "I couldn't match this to any specific syllabus topics. Could you provide more details?";
    }

    const topMatch = matches[0];
    let interpretation = `This appears to be about **${topMatch.name}** (${topMatch.code}).`;

    if (matches.length > 1) {
      interpretation += ` It might also relate to `;
      const others = matches.slice(1, 3).map(m => `**${m.name}** (${m.code})`).join(' or ');
      if (others) interpretation += others;
    }

    // Add mastery context if available
    if (studentModel?.masteryProfile && topMatch.studentMastery !== null) {
      const mastery = topMatch.studentMastery;
      if (mastery < 0.4) {
        interpretation += ` This is an area you're still developing (${Math.round(mastery * 100)}% mastery).`;
      } else if (mastery < 0.7) {
        interpretation += ` You have some familiarity with this (${Math.round(mastery * 100)}% mastery).`;
      } else {
        interpretation += ` You're quite strong in this area (${Math.round(mastery * 100)}% mastery).`;
      }
    }

    // Add error context if student seems stuck
    if (studentModel?.affectiveState?.currentEngagement === 'frustrated') {
      interpretation += ` Let's work through this step by step.`;
    }

    return interpretation;
  }
}

module.exports = SyllabusMatcherTool;