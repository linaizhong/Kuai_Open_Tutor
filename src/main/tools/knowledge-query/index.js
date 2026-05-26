// tools/knowledge-query/index.js
// Query the knowledge base for dot-points, questions, and marking guidelines

const BaseTool = require('../base');

class KnowledgeQueryTool extends BaseTool {
  constructor() {
    super(
      'knowledge-query',
      'Query the knowledge base for syllabus dot-points, questions, and marking guidelines',
      '1.0.0'
    );
  }

  getParameters() {
    return [
      {
        name: 'query',
        type: 'string',
        description: 'Search query or dot-point code',
        required: true,
      },
      {
        name: 'type',
        type: 'string',
        description: 'Type of knowledge to query: "dotPoint", "question", "markingGuideline", "topic"',
        required: false,
        default: 'dotPoint',
      },
      {
        name: 'subject',
        type: 'string',
        description: 'Subject ID (e.g., "maths-advanced", "toefl")',
        required: false,
      },
    ];
  }

  validateParams(params) {
    if (!params.query) {
      throw new Error('Knowledge query tool requires a query');
    }
  }

  async execute(params, context) {
    const { query, type = 'dotPoint', subject } = params;
    const { knowledgeBase, studentModel } = context;

    if (!knowledgeBase) {
      throw new Error('Knowledge base not available');
    }

    let result = null;
    let formatted = '';

    switch (type) {
      case 'dotPoint':
        result = this._queryDotPoint(query, knowledgeBase);
        formatted = this._formatDotPoint(result, studentModel);
        break;
      case 'question':
        result = this._queryQuestion(query, knowledgeBase);
        formatted = this._formatQuestion(result, studentModel);
        break;
      case 'markingGuideline':
        result = this._queryMarkingGuideline(query, knowledgeBase);
        formatted = this._formatMarkingGuideline(result, studentModel);
        break;
      case 'topic':
        result = this._queryTopic(query, knowledgeBase);
        formatted = this._formatTopic(result, studentModel);
        break;
      default:
        throw new Error(`Unknown query type: ${type}`);
    }

    return {
      result,
      formatted,
      type,
      query,
    };
  }

  /**
   * Query dot-point by code or keyword
   */
  _queryDotPoint(query, kb) {
    // Try exact match first
    if (kb.dotPoints && kb.dotPoints[query]) {
      return {
        found: true,
        exact: true,
        data: kb.dotPoints[query],
      };
    }

    // Try keyword search
    if (kb.dotPoints) {
      const results = [];
      const lowerQuery = query.toLowerCase();

      for (const [code, dp] of Object.entries(kb.dotPoints)) {
        let score = 0;

        // Check code
        if (code.toLowerCase().includes(lowerQuery)) score += 5;

        // Check name
        if (dp.name?.toLowerCase().includes(lowerQuery)) score += 3;

        // Check keywords
        if (dp.keywords) {
          for (const kw of dp.keywords) {
            if (kw.toLowerCase().includes(lowerQuery)) score += 2;
          }
        }

        // Check key concepts
        if (dp.keyConcepts) {
          for (const concept of dp.keyConcepts) {
            if (concept.toLowerCase().includes(lowerQuery)) score += 1;
          }
        }

        if (score > 0) {
          results.push({ code, ...dp, relevance: score });
        }
      }

      if (results.length > 0) {
        results.sort((a, b) => b.relevance - a.relevance);
        return {
          found: true,
          exact: false,
          data: results.slice(0, 3), // Top 3 matches
        };
      }
    }

    return { found: false };
  }

  /**
   * Query question by ID or content
   */
  _queryQuestion(query, kb) {
    // Try exact question ID
    if (kb.questions && kb.questions[query]) {
      return {
        found: true,
        exact: true,
        data: kb.questions[query],
      };
    }

    // Search in question bank
    if (kb.questions) {
      const results = [];
      const lowerQuery = query.toLowerCase();

      for (const [id, q] of Object.entries(kb.questions)) {
        let score = 0;

        // Check ID
        if (id.toLowerCase().includes(lowerQuery)) score += 5;

        // Check stem
        if (q.stem?.toLowerCase().includes(lowerQuery)) score += 3;

        // Check tags
        if (q.tags) {
          for (const tag of q.tags) {
            if (tag.toLowerCase().includes(lowerQuery)) score += 2;
          }
        }

        // Check dot points
        if (q.dotPoints) {
          for (const dp of q.dotPoints) {
            if (dp.toLowerCase().includes(lowerQuery)) score += 2;
          }
        }

        if (score > 0) {
          results.push({ id, ...q, relevance: score });
        }
      }

      if (results.length > 0) {
        results.sort((a, b) => b.relevance - a.relevance);
        return {
          found: true,
          exact: false,
          data: results.slice(0, 3),
        };
      }
    }

    return { found: false };
  }

  /**
   * Query marking guidelines
   */
  _queryMarkingGuideline(query, kb) {
    if (!kb.markingGuidelinesIndex) {
      return { found: false };
    }

    const guidelines = kb.markingGuidelinesIndex;
    const lowerQuery = query.toLowerCase();

    // Check if query matches a question ID
    if (guidelines.guidelines) {
      for (const [year, yearData] of Object.entries(guidelines.guidelines)) {
        if (yearData.questionGuidelines) {
          for (const [qId, qGuidelines] of Object.entries(yearData.questionGuidelines)) {
            if (qId.toLowerCase().includes(lowerQuery)) {
              return {
                found: true,
                exact: true,
                data: {
                  year,
                  questionId: qId,
                  guidelines: qGuidelines,
                },
              };
            }
          }
        }
      }
    }

    // Return general policies
    return {
      found: true,
      exact: false,
      data: {
        partialCreditPolicy: guidelines.partialCreditPolicy,
        subjectSpecificPolicies: guidelines.ext1SpecificPolicies,
      },
    };
  }

  /**
   * Query topic structure
   */
  _queryTopic(query, kb) {
    if (!kb.syllabusMap || !kb.syllabusMap.topics) {
      return { found: false };
    }

    const topics = kb.syllabusMap.topics;
    const lowerQuery = query.toLowerCase();
    const results = [];

    for (const topic of topics) {
      let score = 0;

      // Check code
      if (topic.code?.toLowerCase().includes(lowerQuery)) score += 5;

      // Check name
      if (topic.name?.toLowerCase().includes(lowerQuery)) score += 3;

      // Check subtopics
      if (topic.subtopics) {
        for (const sub of topic.subtopics) {
          if (sub.code?.toLowerCase().includes(lowerQuery)) score += 2;
          if (sub.name?.toLowerCase().includes(lowerQuery)) score += 2;
        }
      }

      if (score > 0) {
        results.push({ ...topic, relevance: score });
      }
    }

    if (results.length > 0) {
      results.sort((a, b) => b.relevance - a.relevance);
      return {
        found: true,
        data: results[0],
      };
    }

    return { found: false };
  }

  /**
   * Format dot-point results for display
   */
  _formatDotPoint(result, studentModel) {
    if (!result.found) {
      return "I couldn't find that syllabus dot-point in the knowledge base.";
    }

    if (result.exact) {
      const dp = result.data;
      let output = `## ${dp.code} — ${dp.name}\n\n`;
      output += `${dp.summary || ''}\n\n`;

      if (dp.keyConcepts && dp.keyConcepts.length > 0) {
        output += `**Key Concepts:**\n`;
        dp.keyConcepts.forEach(c => output += `- ${c}\n`);
        output += '\n';
      }

      if (dp.commonErrors && dp.commonErrors.length > 0) {
        output += `**Common Errors to Avoid:**\n`;
        dp.commonErrors.slice(0, 3).forEach(e => output += `- ${e}\n`);
        output += '\n';
      }

      if (dp.examTips && dp.examTips.length > 0) {
        output += `**Exam Tips:**\n`;
        dp.examTips.slice(0, 2).forEach(t => output += `- ${t}\n`);
      }

      return output;
    } else {
      let output = `I found several matching dot-points:\n\n`;
      result.data.forEach((dp, i) => {
        output += `${i+1}. **${dp.code}** — ${dp.name}\n`;
        if (dp.summary) output += `   ${dp.summary.substring(0, 100)}...\n\n`;
      });
      output += `Which one would you like to explore further?`;
      return output;
    }
  }

  /**
   * Format question results
   */
  _formatQuestion(result, studentModel) {
    if (!result.found) {
      return "I couldn't find a question matching that ID.";
    }

    if (result.exact) {
      const q = result.data;
      let output = `## Question: ${q.id}\n\n`;
      output += `${q.stem || ''}\n\n`;

      if (q.options) {
        output += `**Options:**\n`;
        for (const [key, value] of Object.entries(q.options)) {
          output += `${key}. ${value}\n`;
        }
        output += '\n';
      }

      if (q.marks) output += `**Marks:** ${q.marks}\n`;
      if (q.difficulty) output += `**Difficulty:** ${q.difficulty}\n`;
      if (q.tags) output += `**Tags:** ${q.tags.join(', ')}\n`;

      return output;
    }

    let output = `I found several matching questions:\n\n`;
    result.data.forEach((q, i) => {
      output += `${i+1}. **${q.id}** — ${q.stem?.substring(0, 80)}...\n`;
      output += `   Marks: ${q.marks || '?'} | Difficulty: ${q.difficulty || '?'}\n\n`;
    });
    output += `Which question would you like to see?`;
    return output;
  }

  /**
   * Format marking guidelines
   */
  _formatMarkingGuideline(result, studentModel) {
    if (!result.found) {
      return "I couldn't find marking guidelines for that question.";
    }

    if (result.exact) {
      const g = result.data;
      let output = `## Marking Guidelines: ${g.questionId} (${g.year})\n\n`;

      if (g.guidelines.criteria) {
        output += `**Marking Criteria:**\n`;
        g.guidelines.criteria.forEach(c => {
          output += `- ${c.marks} marks: ${c.description}\n`;
        });
        output += '\n';
      }

      if (g.guidelines.commonErrors && g.guidelines.commonErrors.length > 0) {
        output += `**Common Errors:**\n`;
        g.guidelines.commonErrors.forEach(e => output += `- ${e}\n`);
      }

      return output;
    } else {
      let output = `## General Marking Principles\n\n`;

      if (result.data.partialCreditPolicy) {
        output += `**Partial Credit Rules:**\n`;
        result.data.partialCreditPolicy.rules.forEach(rule => {
          output += `- ${rule.condition}: ${rule.marksAwarded}\n`;
        });
        output += '\n';
      }

      if (result.data.subjectSpecificPolicies) {
        output += `**Subject-Specific Policies:**\n`;
        result.data.subjectSpecificPolicies.policies.forEach(p => {
          output += `- **${p.questionType}:** ${p.policy}\n`;
        });
      }

      return output;
    }
  }

  /**
   * Format topic results
   */
  _formatTopic(result, studentModel) {
    if (!result.found) {
      return "I couldn't find that topic in the syllabus.";
    }

    const topic = result.data;
    let output = `## ${topic.code} — ${topic.name}\n\n`;

    if (topic.examWeightPercent) {
      output += `**Exam Weight:** ${topic.examWeightPercent}%\n\n`;
    }

    if (topic.subtopics) {
      output += `**Subtopics:**\n`;
      topic.subtopics.forEach(sub => {
        output += `- **${sub.code}** ${sub.name}\n`;
        if (sub.dotPoints) {
          sub.dotPoints.forEach(dp => {
            output += `  - ${dp.code} — ${dp.name}\n`;
          });
        }
        output += '\n';
      });
    }

    return output;
  }
}

module.exports = KnowledgeQueryTool;