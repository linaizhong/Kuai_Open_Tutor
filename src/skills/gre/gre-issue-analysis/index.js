// Skill: gre-issue-analysis
// Type: active
// Phase: GRE Analytical Writing — Analyze an Issue
//
// Responsibility:
//   Provide feedback on GRE Issue task responses. Focus on thesis development,
//   reasoning, examples, and consideration of complexity.

'use strict';

module.exports = {
  meta: {
    name: 'gre-issue-analysis',
    version: '1.0.0',
    type: 'active',
    category: 'gre',
  },

  execute: async function (params, context) {
    const { studentId, memory, studentModel, model } = context;
    const { userInput, prompt } = params;

    const systemPrompt = buildSystemPrompt(studentModel);
    const userMessage = buildUserMessage(params);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await model.chat(messages, {
      temperature: 0.3,
      maxTokens: 1200,
      skillName: 'gre-issue-analysis',
      studentId,
    });

    let score = null;
    const scoreMatch = response.match(/[Ss]core[:\s]*([0-6](?:\.5)?)/);
    if (scoreMatch) {
      score = parseFloat(scoreMatch[1]);
    }

    if (memory && score !== null) {
      try {
        memory.recordAttempt(
          studentId,
          'GRE-A.1',
          prompt || 'Issue analysis practice',
          userInput.substring(0, 100) + '...',
          score >= 4,
          score / 6
        );
      } catch (err) {
        console.error('[gre-issue] Failed to record attempt:', err);
      }
    }

    return {
      result: response,
      score: score,
      visualization: null,
    };
  },
};

function buildSystemPrompt(studentModel) {
  return `You are an expert GRE Analytical Writing tutor specializing in the Issue task.

Your task is to evaluate student responses to GRE Issue prompts.

KEY ELEMENTS OF STRONG ISSUE RESPONSES:
1. Clear thesis stating position
2. Acknowledgment of complexity/alternative views
3. Well-developed reasons with specific examples
4. Logical organization
5. Varied sentence structure, precise vocabulary

SCORING RUBRIC (0-6):
6 - Insightful position. Well-developed with compelling examples. Clear organization. Varied language.
5 - Thoughtful position. Good development with relevant examples. Clear. Some variety.
4 - Clear position. Adequate development. Organized. Competent language.
3 - Vague position. Limited development. Weak organization. Limited language.
2 - Unclear position. Little development. Poor organization. Frequent errors.
1 - No coherent position. Severe errors.
0 - Blank or off-topic.

FEEDBACK STRUCTURE:
1. Score (0-6) with brief justification
2. Thesis evaluation
3. Development: Are reasons supported with specifics?
4. Complexity: Are counterarguments acknowledged?
5. Organization: Paragraph structure, transitions
6. Language: Grammar, vocabulary, sentence variety
7. Specific, line-by-line feedback with quotes
8. Model sentences for improvement
9. One priority area for next attempt

Be specific. Quote the student's writing. Provide actionable feedback.`;
}

function buildUserMessage(params) {
  const { userInput, prompt } = params;

  let message = `Student's issue analysis response:\n\n${userInput}\n\n`;

  if (prompt) {
    message += `PROMPT: ${prompt}\n\n`;
  }

  message += `Please evaluate this response using the GRE Issue rubric.`;

  return message;
}