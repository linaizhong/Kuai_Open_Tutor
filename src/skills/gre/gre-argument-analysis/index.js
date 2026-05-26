// Skill: gre-argument-analysis
// Type: active
// Phase: GRE Analytical Writing — Analyze an Argument
//
// Responsibility:
//   Provide feedback on GRE Argument task responses. Focus on logical analysis,
//   identification of assumptions, and suggestions for strengthening.

'use strict';

module.exports = {
  meta: {
    name: 'gre-argument-analysis',
    version: '1.0.0',
    type: 'active',
    category: 'gre',
  },

  execute: async function (params, context) {
    const { studentId, memory, studentModel, model } = context;
    const { userInput, argument, prompt } = params;

    const systemPrompt = buildSystemPrompt(studentModel);
    const userMessage = buildUserMessage(params);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await model.chat(messages, {
      temperature: 0.3,
      maxTokens: 1200,
      skillName: 'gre-argument-analysis',
      studentId,
    });

    // Extract score
    let score = null;
    const scoreMatch = response.match(/[Ss]core[:\s]*([0-6](?:\.5)?)/);
    if (scoreMatch) {
      score = parseFloat(scoreMatch[1]);
    }

    // Record in memory
    if (memory && score !== null) {
      try {
        memory.recordAttempt(
          studentId,
          'GRE-A.2',
          prompt || 'Argument analysis practice',
          userInput.substring(0, 100) + '...',
          score >= 4,
          score / 6
        );
      } catch (err) {
        console.error('[gre-argument] Failed to record attempt:', err);
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
  return `You are an expert GRE Analytical Writing tutor specializing in the Argument task.

Your task is to evaluate student responses to GRE Argument prompts.

KEY RULES FOR ARGUMENT TASK:
1. NEVER agree or disagree with the argument's conclusion
2. Focus on the REASONING, not whether the conclusion is true
3. Identify unstated ASSUMPTIONS
4. Question the EVIDENCE: is it representative, sufficient, reliable?
5. Consider ALTERNATIVE EXPLANATIONS
6. Suggest how to STRENGTHEN the argument

SCORING RUBRIC (0-6):
6 - Insightful analysis of key assumptions. Well-developed. Clear organization. Precise language.
5 - Good analysis of important assumptions. Well-developed. Clear. Good language.
4 - Competent analysis. Identifies some assumptions. Adequate development.
3 - Limited analysis. Superficial critique. Weak organization.
2 - Serious flaws in analysis. Little development.
1 - Fundamental deficiencies. No real analysis.
0 - Blank or off-topic.

FEEDBACK STRUCTURE:
1. Score (0-6) with brief justification
2. Analysis of argument structure: conclusion, evidence
3. Key assumptions identified (with explanation of why they matter)
4. Questions about evidence quality
5. Alternative explanations considered
6. Suggestions for strengthening
7. Specific, line-by-line feedback with quotes
8. One priority area for next attempt

IMPORTANT: Never say "I agree" or "I disagree." The task is to analyze logic, not take a position.`;
}

function buildUserMessage(params) {
  const { userInput, argument, prompt } = params;

  let message = `Student's argument analysis response:\n\n${userInput}\n\n`;

  if (prompt) {
    message += `PROMPT: ${prompt}\n\n`;
  }

  if (argument) {
    message += `ARGUMENT TO ANALYZE:\n${argument}\n\n`;
  }

  message += `Please evaluate this response using the GRE Argument rubric.`;

  return message;
}