// Skill: gre-text-completion
// Type: active
// Phase: GRE Verbal — Text Completion (single, double, triple blank)
//
// Responsibility:
//   Provide practice and detailed explanations for GRE Text Completion questions.
//   Focus on vocabulary in context, logical relationships, and sentence structure.

'use strict';

module.exports = {
  meta: {
    name: 'gre-text-completion',
    version: '1.0.0',
    type: 'active',
    category: 'gre',
  },

  execute: async function (params, context) {
    const { studentId, memory, studentModel, model, knowledgeBase } = context;
    const { userInput, questionId, studentAnswers, blankCount } = params;

    // Look up question from knowledge base
    let question = null;
    if (knowledgeBase?.gre?.questions && questionId) {
      question = knowledgeBase.gre.questions[questionId];
    }

    const systemPrompt = buildSystemPrompt(studentModel, blankCount);
    const userMessage = buildUserMessage(params, question);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await model.chat(messages, {
      temperature: 0.3,
      maxTokens: 800,
      skillName: 'gre-text-completion',
      studentId,
    });

    // Check correctness
    let isCorrect = null;
    if (question && studentAnswers) {
      if (Array.isArray(question.answer)) {
        // Multiple blanks - need all correct
        isCorrect = JSON.stringify(studentAnswers.sort()) === JSON.stringify(question.answer.sort());
      } else {
        // Single blank
        isCorrect = studentAnswers === question.answer;
      }
    }

    // Record in memory
    if (memory && question) {
      try {
        const dotPoint = blankCount === 1 ? 'GRE-V.1' : 
                         blankCount === 2 ? 'GRE-V.2' : 'GRE-V.3';
        
        memory.recordAttempt(
          studentId,
          dotPoint,
          question.stem,
          JSON.stringify(studentAnswers),
          isCorrect,
          isCorrect ? 1.0 : 0.0
        );
      } catch (err) {
        console.error('[gre-text] Failed to record attempt:', err);
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

function buildSystemPrompt(studentModel, blankCount) {
  const vocabLevel = studentModel?.greProfile?.vocabularyLevel || 'intermediate';

  return `You are an expert GRE Verbal tutor specializing in Text Completion questions.

Your task is to explain GRE Text Completion questions in detail.

BLANK COUNT: ${blankCount || 'unknown'}

STRATEGY FOR TEXT COMPLETION:
1. Read the entire sentence/paragraph first
2. Cover the options and predict your own word for each blank
3. Look for clues: transition words (however, therefore, although)
4. Consider the logical structure: contrast, cause-effect, continuation
5. For multiple blanks: work in order, each choice narrows possibilities
6. Check that all blanks work together

VOCABULARY LEVEL: ${vocabLevel} - adjust explanations accordingly

EXPLANATION REQUIREMENTS:
- Explain the logical structure of the sentence
- Identify key clue words
- For each blank: why the correct word fits
- For each wrong option: why it doesn't work (in context)
- Provide vocabulary notes for challenging words
- Suggest similar words to study

Remember: Text Completion tests logic AND vocabulary. Both matter.`;
}

function buildUserMessage(params, question) {
  const { userInput, studentAnswers } = params;

  let message = `Student is practicing GRE Text Completion.\n\n`;

  if (question) {
    message += `QUESTION:\n${question.stem}\n\n`;

    if (question.options) {
      message += `ANSWER CHOICES:\n`;
      if (Array.isArray(question.options)) {
        question.options.forEach((opt, i) => {
          message += `${String.fromCharCode(65 + i)}. ${opt}\n`;
        });
      } else {
        for (const [key, value] of Object.entries(question.options)) {
          message += `${key}. ${value}\n`;
        }
      }
      message += `\n`;
    }

    message += `STUDENT'S ANSWER(S): ${Array.isArray(studentAnswers) ? studentAnswers.join(', ') : studentAnswers}\n\n`;
    message += `CORRECT ANSWER(S): ${Array.isArray(question.answer) ? question.answer.join(', ') : question.answer}\n`;
  } else {
    message += `Student's question: ${userInput}\n`;
    message += `Student's answer: ${studentAnswers}\n`;
  }

  return message;
}