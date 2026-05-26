// Skill: gre-quantitative-comparison
// Type: active
// Phase: GRE Quantitative — Quantitative Comparison
//
// Responsibility:
//   Provide practice for GRE Quantitative Comparison questions. Focus on
//   strategies for comparing quantities without fully calculating.

'use strict';

module.exports = {
  meta: {
    name: 'gre-quantitative-comparison',
    version: '1.0.0',
    type: 'active',
    category: 'gre',
  },

  execute: async function (params, context) {
    const { studentId, memory, studentModel, model, knowledgeBase } = context;
    const { userInput, questionId, studentAnswer } = params;

    let question = null;
    if (knowledgeBase?.gre?.questions && questionId) {
      question = knowledgeBase.gre.questions[questionId];
    }

    const systemPrompt = buildSystemPrompt(studentModel);
    const userMessage = buildUserMessage(params, question);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await model.chat(messages, {
      temperature: 0.2, // very low for math
      maxTokens: 800,
      skillName: 'gre-quantitative-comparison',
      studentId,
    });

    // Check correctness
    let isCorrect = null;
    if (question && studentAnswer) {
      isCorrect = studentAnswer.toUpperCase() === question.answer;
    }

    // Record in memory
    if (memory && question) {
      try {
        memory.recordAttempt(
          studentId,
          'GRE-Q.5',
          question.stem,
          studentAnswer,
          isCorrect,
          isCorrect ? 1.0 : 0.0
        );
      } catch (err) {
        console.error('[gre-quant] Failed to record attempt:', err);
      }
    }

    return {
      result: response,
      isCorrect: isCorrect,
      questionData: question,
      visualization: null,
    };
  },
};

function buildSystemPrompt(studentModel) {
  return `You are an expert GRE Quantitative tutor specializing in Quantitative Comparison questions.

Your task is to explain GRE Quantitative Comparison questions in detail.

ANSWER CHOICES:
A: Quantity A is greater
B: Quantity B is greater
C: The two quantities are equal
D: The relationship cannot be determined from the information given

CRITICAL RULES:
1. Choose D ONLY if the relationship varies under different conditions
2. If a definite relationship exists, D is wrong
3. Test with different numbers: positive, negative, zero, fractions
4. Look for hidden constraints (e.g., x is an integer, x > 0)
5. Simplify both quantities before comparing

STRATEGY:
1. Simplify each quantity as much as possible
2. Look for algebraic relationships
3. Test with numbers if variables are present
4. For geometry: mark given information, look for relationships
5. Consider special cases: zero, negative numbers, fractions

EXPLANATION REQUIREMENTS:
- Show step-by-step reasoning
- For variables: demonstrate with at least two test values
- Explain why D is or isn't appropriate
- Point out common traps
- Suggest a faster approach if applicable

Remember: Quantitative Comparison tests mathematical reasoning, not just calculation.`;
}

function buildUserMessage(params, question) {
  const { userInput, studentAnswer } = params;

  let message = `Student is practicing GRE Quantitative Comparison.\n\n`;

  if (question) {
    message += `QUESTION:\n${question.stem}\n\n`;

    if (question.quantityA && question.quantityB) {
      message += `Quantity A: ${question.quantityA}\n`;
      message += `Quantity B: ${question.quantityB}\n\n`;
    }

    message += `STUDENT'S ANSWER: ${studentAnswer || userInput}\n\n`;
    message += `CORRECT ANSWER: ${question.answer}\n`;
  } else {
    message += `Student's question: ${userInput}\n`;
  }

  return message;
}