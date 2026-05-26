// Skill: gre-sentence-equivalence
// Type: active
// Phase: GRE Verbal — Sentence Equivalence
//
// Responsibility:
//   Provide practice for GRE Sentence Equivalence questions. Focus on finding
//   two words that produce equivalent sentences with the same meaning.

'use strict';

module.exports = {
  meta: {
    name: 'gre-sentence-equivalence',
    version: '1.0.0',
    type: 'active',
    category: 'gre',
  },

  execute: async function (params, context) {
    const { studentId, memory, studentModel, model, knowledgeBase } = context;
    const { userInput, questionId, studentAnswers } = params;

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
      temperature: 0.3,
      maxTokens: 800,
      skillName: 'gre-sentence-equivalence',
      studentId,
    });

    // Check correctness (both answers must be correct)
    let isCorrect = null;
    if (question && studentAnswers && Array.isArray(studentAnswers) && studentAnswers.length === 2) {
      const correctAnswers = question.answer;
      isCorrect = studentAnswers.every(ans => correctAnswers.includes(ans)) &&
                  correctAnswers.every(ans => studentAnswers.includes(ans));
    }

    // Record in memory
    if (memory && question) {
      try {
        memory.recordAttempt(
          studentId,
          'GRE-V.4',
          question.stem,
          JSON.stringify(studentAnswers),
          isCorrect,
          isCorrect ? 1.0 : 0.0
        );
      } catch (err) {
        console.error('[gre-sentence] Failed to record attempt:', err);
      }
    }

    return {
      result: response,
      isCorrect: isCorrect,
      questionData: question,
    };
  },
};

function buildSystemPrompt(studentModel) {
  return `You are an expert GRE Verbal tutor specializing in Sentence Equivalence questions.

Your task is to explain GRE Sentence Equivalence questions in detail.

CRITICAL RULES FOR SENTENCE EQUIVALENCE:
1. The two correct answers must produce sentences with IDENTICAL meaning
2. They must be synonyms in THIS SPECIFIC CONTEXT, not just in general
3. The sentence structure determines the required meaning
4. All six options will have some synonym relationships - find the context-appropriate pair

STRATEGY:
1. Read the sentence and determine its meaning
2. Cover the options and predict a word that fits
3. Find that word (or a synonym) among the options
4. Look for another option that means the same thing IN THIS CONTEXT
5. Verify that both produce the EXACT same sentence meaning

EXPLANATION REQUIREMENTS:
- Explain the meaning the sentence requires
- For the correct pair: why they work and are synonyms in context
- For each wrong option: why it changes the meaning or doesn't fit
- Identify traps: synonyms that don't fit context, partial matches

Be precise about meaning. Two words might be synonyms generally but create different meanings in this sentence.`;
}

function buildUserMessage(params, question) {
  const { userInput, studentAnswers } = params;

  let message = `Student is practicing GRE Sentence Equivalence.\n\n`;

  if (question) {
    message += `SENTENCE:\n${question.stem}\n\n`;

    message += `ANSWER CHOICES:\n`;
    if (Array.isArray(question.options)) {
      question.options.forEach((opt, i) => {
        message += `${String.fromCharCode(65 + i)}. ${opt}\n`;
      });
    }
    message += `\n`;

    message += `STUDENT'S CHOICES: ${studentAnswers ? studentAnswers.join(', ') : 'None'}\n\n`;
    message += `CORRECT CHOICES: ${Array.isArray(question.answer) ? question.answer.join(', ') : question.answer}\n`;
  } else {
    message += `Student's question: ${userInput}\n`;
  }

  return message;
}