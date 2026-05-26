// test-led-question-generator.js
// Adaptive question generation: topic rotation, difficulty selection, skill call, presentation.

'use strict';

function applyQuestionGenerator(proto) {

  // ── Topic rotation ───────────────────────────────────────────────────────
  proto._pickNextTopic = function (currentTest) {
    const topics = currentTest.targetTopics;
    if (!topics || topics.length === 0) return null;
    if (currentTest.type !== 'diagnostic') return topics[0];

    const counts   = currentTest.topicQuestionCounts || {};
    let minCount   = Infinity;
    let chosenTopic = topics[0];
    const startIdx  = currentTest.nextTopicIndex || 0;

    for (let i = 0; i < topics.length; i++) {
      const idx   = (startIdx + i) % topics.length;
      const topic = topics[idx];
      const count = counts[topic] || 0;
      if (count < minCount) {
        minCount    = count;
        chosenTopic = topic;
        currentTest.nextTopicIndex = (idx + 1) % topics.length;
      }
    }

    console.log(`[TestLed] Adaptive topic rotation → ${chosenTopic} (asked ${minCount} times so far)`);
    return chosenTopic;
  };

  proto._getTopicDifficulty = function (currentTest, topic) {
    if (currentTest.topicDifficulty && currentTest.topicDifficulty[topic]) {
      return currentTest.topicDifficulty[topic];
    }
    return currentTest.currentDifficulty || 'medium';
  };

  // ── Generate next question ───────────────────────────────────────────────
  proto._generateNextQuestion = async function () {
    const currentTest   = this.sessionState.currentTest;
    const chosenTopic   = this._pickNextTopic(currentTest);
    const topicsForSkill = chosenTopic ? [chosenTopic] : currentTest.targetTopics;
    const difficulty    = this._getTopicDifficulty(currentTest, chosenTopic);

    try {
      const quizSkill = this.skillManager.getSkill('generate-quiz');
      if (!quizSkill) throw new Error('generate-quiz skill not found');

      console.log(`[TestLed] Generating Q${currentTest.questions.length + 1} | topic: ${topicsForSkill[0]} | difficulty: ${difficulty}`);

      const result = await quizSkill.module.execute({
        userInput:        `Generate a ${difficulty} question`,
        difficulty,
        topics:           topicsForSkill,
        usedQuestionIds:  currentTest.usedQuestionIds,
        activeSubject:    this.knowledgeBase?.subjectId
      }, {
        studentId:    this.studentId,
        memory:       this.memory,
        studentModel: this.studentModel,
        model:        this.model,
        knowledgeBase: this.knowledgeBase
      });

      const formattedQuestion = result.result || '';

      // Parse question text
      let questionText = '';
      const questionMatch = formattedQuestion.match(/\*\*Question:\*\*\s*([\s\S]*?)(?=\*\*Marks:|$)/);
      if (questionMatch) {
        questionText = questionMatch[1].trim();
      } else {
        questionText = formattedQuestion.replace(/\*\*Marks:\*\*.*$/, '').trim();
      }

      // Parse marks
      let marks = 1;
      const marksMatch = formattedQuestion.match(/\*\*Marks:\*\*\s*(\d+)/);
      if (marksMatch) marks = parseInt(marksMatch[1]);

      // Parse hint
      let hint = '';
      const hintMatch = formattedQuestion.match(/\*\*Hint:\*\*\s*([\s\S]*?)(?=\*\*|$)/);
      if (hintMatch) hint = hintMatch[1].trim();

      // Parse marking criteria
      let markingCriteria = '';
      const criteriaMatch = formattedQuestion.match(/\*\*Marking Criteria:\*\*\s*([\s\S]*?)(?=\*\*Hint:|$)/);
      if (criteriaMatch) markingCriteria = criteriaMatch[1].trim();

      const newQuestion = {
        id:            `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        text:          questionText || 'Explain the key concept of this topic in your own words.',
        type:          'open',
        options:       [],
        correctAnswer: 'Student demonstrates understanding',
        explanation:   markingCriteria || 'A good answer should demonstrate understanding of the core concepts.',
        hint:          hint || 'Think about what makes this topic important.',
        difficulty:    result.difficulty || difficulty,
        topic:         chosenTopic || topicsForSkill[0] || 'general',
        syllabusPoint: result.syllabusPoint || null,
        marks,
        startTime:     null
      };

      currentTest.questions.push(newQuestion);
      currentTest.totalQuestions = currentTest.questions.length;
      if (newQuestion.id) currentTest.usedQuestionIds.push(newQuestion.id);

      // Update per-topic question counter
      if (chosenTopic && currentTest.topicQuestionCounts) {
        currentTest.topicQuestionCounts[chosenTopic] =
          (currentTest.topicQuestionCounts[chosenTopic] || 0) + 1;
      }

      console.log(`[TestLed] Q${currentTest.questions.length} generated: ${newQuestion.text.substring(0, 60)}...`);

      return this._presentCurrentQuestion();

    } catch (err) {
      console.error('[TestLed] Failed to generate question:', err);

      // Fallback question
      const fallbackQuestion = {
        id:            `q-${Date.now()}-fallback`,
        text:          'Explain the key concept of this topic in your own words.',
        type:          'open',
        options:       [],
        correctAnswer: 'Student demonstrates understanding',
        explanation:   'A good explanation shows you understand the core ideas.',
        hint:          'Think about what makes this topic important.',
        difficulty:    'medium',
        topic:         topicsForSkill[0] || 'general',
        syllabusPoint: null,
        marks:         1,
        startTime:     null
      };

      currentTest.questions.push(fallbackQuestion);
      currentTest.totalQuestions = currentTest.questions.length;
      return this._presentCurrentQuestion();
    }
  };

  // ── Present current question ─────────────────────────────────────────────
  proto._presentCurrentQuestion = function () {
    const currentTest = this.sessionState.currentTest;
    const question    = currentTest.questions[currentTest.currentQuestionIndex];

    question.startTime = Date.now();

    let message = question.text;
    if (question.type === 'multiple-choice' && question.options?.length > 0) {
      const optionsText = question.options
        .map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`)
        .join('\n');
      message = `${question.text}\n\n${optionsText}`;
    }

    return {
      type: 'test_question',
      message,
      question,
      phase: 'testing',
      teachingPhase: 'testing',
      teachingSubPhase: currentTest.type,
      teachingProgress: this._calculateProgress(),
      currentStep: this._getCurrentStep(),
      totalSteps: this._getTotalSteps(),
      stepName: `Question ${currentTest.currentQuestionIndex + 1} of ${currentTest.targetQuestionCount || currentTest.questions.length}`,
      questionIndex: currentTest.currentQuestionIndex + 1,
      totalQuestions: currentTest.targetQuestionCount || currentTest.questions.length,
      topic: question.topic,
      difficulty: question.difficulty,
      autoAdvance: false,
      proactive: true,
      canResume: true,
      timestamp: Date.now()
    };
  };
}

module.exports = { applyQuestionGenerator };