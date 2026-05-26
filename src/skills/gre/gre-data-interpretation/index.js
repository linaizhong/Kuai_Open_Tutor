// Skill: gre-data-interpretation
// Type: active
// Phase: GRE Quantitative — Data Interpretation
//
// Responsibility:
//   Provide practice for GRE Data Interpretation questions involving graphs,
//   charts, and tables. Focus on reading data accurately and performing
//   calculations based on visual information.

'use strict';

module.exports = {
  meta: {
    name: 'gre-data-interpretation',
    version: '1.0.0',
    type: 'active',
    category: 'gre',
  },

  execute: async function (params, context) {
    const { studentId, memory, studentModel, model } = context;
    const { userInput, questionData, studentAnswer, correctAnswer } = params;

    const systemPrompt = buildSystemPrompt(studentModel);
    const userMessage = buildUserMessage(params);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await model.chat(messages, {
      temperature: 0.2,
      maxTokens: 800,
      skillName: 'gre-data-interpretation',
      studentId,
    });

    let isCorrect = null;
    if (correctAnswer && studentAnswer) {
      isCorrect = studentAnswer.toString() === correctAnswer.toString();
    }

    if (memory) {
      try {
        memory.recordAttempt(
          studentId,
          'GRE-Q.6',
          params.question || 'Data interpretation',
          studentAnswer || 'viewed',
          isCorrect,
          isCorrect ? 1.0 : 0.0
        );
      } catch (err) {
        console.error('[gre-data] Failed to record attempt:', err);
      }
    }

    return {
      result: response,
      isCorrect: isCorrect,
      visualization: questionData?.graph || null,
    };
  },
};

function buildSystemPrompt(studentModel) {
  return `You are an expert GRE Quantitative tutor specializing in Data Interpretation.

Your task is to help students solve GRE Data Interpretation questions.

KEY SKILLS:
1. Reading graphs accurately: check scales, axes, units, legends
2. Extracting correct data points
3. Calculating percentages, ratios, and differences
4. Estimating when precise values aren't given
5. Avoiding common traps

STRATEGY:
1. Always check axes labels and units FIRST
2. Read the question carefully: percent of WHAT?
3. Underline what's being asked
4. Ballpark estimates can eliminate wrong answers
5. Don't over-round intermediate calculations

EXPLANATION REQUIREMENTS:
- Show step-by-step calculations
- Point out where students might misread the graph
- Explain why wrong answers are tempting but incorrect
- Suggest estimation strategies

Be patient with graph reading. Show exactly where to look.`;
}

function buildUserMessage(params) {
  const { userInput, questionData, studentAnswer, graphDescription } = params;

  let message = `Student is practicing GRE Data Interpretation.\n\n`;

  if (graphDescription) {
    message += `GRAPH/TABLE DESCRIPTION:\n${graphDescription}\n\n`;
  }

  if (questionData) {
    message += `QUESTION:\n${questionData}\n\n`;
  }

  message += `STUDENT'S ANSWER: ${studentAnswer || userInput}\n`;

  return message;
}