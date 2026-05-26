// Skill: gre-reading-comprehension
// Type: active
// Phase: GRE Verbal — Reading Comprehension
//
// Responsibility:
//   Provide practice for GRE Reading Comprehension questions across all subtypes:
//   main idea, detail, inference, function, multiple-answer, select-in-passage.

'use strict';

module.exports = {
  meta: {
    name: 'gre-reading-comprehension',
    version: '1.0.0',
    type: 'active',
    category: 'gre',
  },

  execute: async function (params, context) {
    const { studentId, memory, studentModel, model, knowledgeBase } = context;
    const { userInput, questionId, studentAnswer, passageId, questionSubtype } = params;

    let question = null;
    let passage = null;
    
    if (knowledgeBase?.gre?.questions && questionId) {
      question = knowledgeBase.gre.questions[questionId];
      if (question?.passageId && knowledgeBase.gre.passages) {
        passage = knowledgeBase.gre.passages[question.passageId];
      }
    }

    const systemPrompt = buildSystemPrompt(studentModel, questionSubtype || question?.questionSubtype);
    const userMessage = buildUserMessage(params, question, passage);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await model.chat(messages, {
      temperature: 0.3,
      maxTokens: 1000,
      skillName: 'gre-reading-comprehension',
      studentId,
    });

    // Check correctness (handles multiple-answer specially)
    let isCorrect = null;
    if (question && studentAnswer) {
      if (question.questionSubtype === 'multiple-choice-multiple') {
        // Multiple correct answers - need all
        const correctAnswers = question.answer;
        const studentAnswers = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
        isCorrect = correctAnswers.every(a => studentAnswers.includes(a)) &&
                   studentAnswers.every(a => correctAnswers.includes(a));
      } else {
        isCorrect = studentAnswer.toUpperCase() === question.answer;
      }
    }

    // Map to GRE-V dot point
    const subtypeToDotPoint = {
      'main-idea': 'GRE-V.5',
      'detail': 'GRE-V.6',
      'inference': 'GRE-V.7',
      'function': 'GRE-V.8',
      'multiple-choice-multiple': 'GRE-V.9',
      'select-in-passage': 'GRE-V.9',
      'critical-reasoning': 'GRE-V.10',
    };

    if (memory && question) {
      try {
        const dotPoint = subtypeToDotPoint[question.questionSubtype] || 'GRE-V.5';
        
        memory.recordAttempt(
          studentId,
          dotPoint,
          question.stem,
          JSON.stringify(studentAnswer),
          isCorrect,
          isCorrect ? 1.0 : 0.0
        );
      } catch (err) {
        console.error('[gre-reading] Failed to record attempt:', err);
      }
    }

    return {
      result: response,
      isCorrect: isCorrect,
      questionData: question,
      passageData: passage,
    };
  },
};

function buildSystemPrompt(studentModel, questionSubtype) {
  let subtypeTips = '';

  switch (questionSubtype) {
    case 'main-idea':
      subtypeTips = 'For main idea: The correct answer applies to the ENTIRE passage. Details and examples are wrong.';
      break;
    case 'detail':
      subtypeTips = 'For detail: Find the specific sentence in the passage. The answer may be a paraphrase.';
      break;
    case 'inference':
      subtypeTips = 'For inference: The answer must be LOGICALLY TRUE based on the passage. If you can imagine the passage being true and the answer false, it\'s wrong.';
      break;
    case 'function':
      subtypeTips = 'For function: Ask "WHY does the author mention this?" Look at surrounding sentences for purpose.';
      break;
    case 'multiple-choice-multiple':
      subtypeTips = 'For multiple-answer: You must select ALL correct answers. Check each option against the passage.';
      break;
    case 'select-in-passage':
      subtypeTips = 'For select-in-passage: The correct sentence must DIRECTLY support the answer. Don\'t choose sentences that imply but don\'t state.';
      break;
    case 'critical-reasoning':
      subtypeTips = 'For critical reasoning: Identify the conclusion and evidence. Look for assumptions and logical flaws.';
      break;
  }

  return `You are an expert GRE Verbal tutor specializing in Reading Comprehension.

Your task is to explain GRE Reading questions in detail.

QUESTION TYPE: ${questionSubtype || 'unknown'}

${subtypeTips}

EXPLANATION REQUIREMENTS:
- For correct answer: Quote the specific passage evidence
- For each wrong option: Explain why it's incorrect (opposite, out of scope, extreme, etc.)
- Teach a strategy for this question type
- For inference: Show the logical steps from passage to conclusion

Be precise. Reference the passage directly.`;
}

function buildUserMessage(params, question, passage) {
  const { userInput, studentAnswer } = params;

  let message = `Student is practicing GRE Reading Comprehension.\n\n`;

  if (question && passage) {
    message += `PASSAGE:\n${passage.text}\n\n`;

    message += `QUESTION (${question.questionSubtype || question.questionType}):\n${question.stem}\n\n`;

    if (question.options) {
      message += `OPTIONS:\n`;
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

    message += `STUDENT'S ANSWER: ${studentAnswer ? (Array.isArray(studentAnswer) ? studentAnswer.join(', ') : studentAnswer) : userInput}\n\n`;
    message += `CORRECT ANSWER: ${Array.isArray(question.answer) ? question.answer.join(', ') : question.answer}\n`;
  } else {
    message += `Student's question: ${userInput}\n`;
  }

  return message;
}