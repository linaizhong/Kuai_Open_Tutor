// test-led-remediation.js
// Remediation, verification, and complete phase handlers.

'use strict';

function applyRemediation(proto) {

  // ── Remediation phase ────────────────────────────────────────────────────
  proto._startRemediation = async function () {
    const diagnosis = this.sessionState.diagnosis;

    if (diagnosis.weakestTopics.length === 0) {
      return {
        type: 'remediation',
        message: 'No topics need remediation right now. Would you like to try a mastery check?',
        phase: 'diagnosis',
        suggestions: [{ icon: '✅', label: 'Mastery check', text: 'mastery' }],
        timestamp: Date.now()
      };
    }

    const weakestTopic = diagnosis.weakestTopics[0].topic;

    this.sessionState.remediation.active        = true;
    this.sessionState.remediation.currentTopic  = weakestTopic;
    this.sessionState.phase                     = 'remediation';
    this.sessionState.subPhase                  = 'preparing';

    const teachingBrief = {
      topic:    weakestTopic,
      topicName: this._getTopicName(weakestTopic),
      specificDifficulties: diagnosis.errorPatterns
        .filter(p => p.topic === weakestTopic)
        .map(p => p.description),
      errorExamples: this.sessionState.answers
        .filter(a => !a.isCorrect && a.question.topic === weakestTopic)
        .slice(0, 3)
        .map(a => ({ question: a.question.text, studentAnswer: a.userAnswer, errorType: a.errorType })),
      masteryCriteria: {
        requiredScore:  (this._getConfig()?.masteryThreshold || 80) / 100,
        questionTypes:  ['basic', 'applied']
      }
    };

    this.sessionState.remediation.teachingBrief        = teachingBrief;
    this.sessionState.remediation.modeSwitchRequested  = true;

    return {
      type: 'remediation_start',
      message: `## 📚 Remediation Needed\n\nI see you're struggling with **${weakestTopic}**. Let's switch to Teacher-Led mode so I can explain this properly.\n\nAfter the lesson, we'll come back and test your understanding.`,
      phase: 'remediation',
      teachingPhase: 'remediation',
      teachingSubPhase: 'switching',
      teachingProgress: 25,
      currentStep: this._getCurrentStep(),
      totalSteps: this._getTotalSteps(),
      stepName: 'Switching to Teacher-Led',
      autoAdvance: true,
      delay: 3000,
      proactive: true,
      canResume: false,
      modeSwitch: {
        to:            'teacher-led',
        reason:        'remediation',
        topic:         weakestTopic,
        teachingBrief,
        returnAction:  'verification'
      },
      timestamp: Date.now()
    };
  };

  proto._handleRemediationPhase = async function (userInput) {
    if (this.sessionState.remediation.modeSwitchRequested &&
        !this.sessionState.remediation.modeSwitchCompleted) {
      return {
        type: 'remediation_waiting',
        message: 'Waiting for Teacher-Led mode to complete...',
        phase: 'remediation',
        autoAdvance: false,
        timestamp: Date.now()
      };
    }

    if (this.sessionState.remediation.modeSwitchCompleted) {
      this.sessionState.remediation.modeSwitchCompleted = false;
      this.sessionState.remediation.lessonsCompleted.push(this.sessionState.remediation.currentTopic);
      this.sessionState.phase    = 'verification';
      this.sessionState.subPhase = 'preparing';
      return this._startMasteryCheck();
    }

    const lower = userInput.toLowerCase().trim();

    if (lower === 'continue' || lower === 'next') return this._startMasteryCheck();
    if (lower === 'skip') {
      this.sessionState.remediation.active = false;
      this.sessionState.phase = 'diagnosis';
      return this._showDiagnosis();
    }

    return {
      type: 'remediation_status',
      message: `Currently working on **${this.sessionState.remediation.currentTopic}**.\n\nType 'continue' when you're ready to test your understanding.`,
      phase: 'remediation',
      timestamp: Date.now()
    };
  };

  // ── Verification phase ───────────────────────────────────────────────────
  proto._handleVerificationPhase = async function (userInput) {
    const verification = this.sessionState.verification;

    if (!verification.active) {
      this.sessionState.phase = 'diagnosis';
      return this._showDiagnosis();
    }

    if (verification.questions.length === 0) return this._generateVerificationQuestions();

    const currentTest     = this.sessionState.currentTest;
    const currentQuestion = currentTest.questions[currentTest.currentQuestionIndex];

    if (!currentQuestion) return this._generateVerificationQuestions();

    if (!currentQuestion.startTime) currentQuestion.startTime = Date.now();

    let isCorrect = false;
    try {
      const checkSkill = this.skillManager.getSkill('check-understanding');
      if (checkSkill) {
        const checkResult = await checkSkill.module.execute({
          action:   'evaluate',
          question: {
            question:      currentQuestion.text,
            type:          currentQuestion.type,
            options:       currentQuestion.options,
            correctAnswer: currentQuestion.correctAnswer,
            explanation:   currentQuestion.explanation
          },
          studentAnswer: userInput,
          topic:         currentQuestion.topic
        }, {
          studentId: this.studentId, memory: this.memory,
          studentModel: this.studentModel, model: this.model,
          knowledgeBase: this.knowledgeBase
        });

        // Same language-based detection as in AnswerProcessor
        if (checkResult.isCorrect === true) {
          isCorrect = true;
        } else {
          const t = checkResult.result || '';
          const hasCorrectly  = /\bcorrectly\b/i.test(t);
          const hasUnderstand = /demonstrates?\s+(?:a\s+)?(?:good|strong|clear|solid)?\s*understanding/i.test(t);
          const hasPositive   = /\b(correct answer|right answer|well done|great work|good answer|excellent)\b/i.test(t)
                             || /\*{0,2}right\*{0,2}\s*:/i.test(t) || /\*{0,2}correct\*{0,2}\s*:/i.test(t);
          if (hasCorrectly || hasUnderstand || hasPositive) {
            isCorrect = true;
          } else {
            isCorrect = (checkResult.score || 0) >= 0.5;
          }
        }
      }
    } catch (err) {
      console.warn('[TestLed] Verification check failed:', err.message);
    }

    verification.answers.push({
      question: { ...currentQuestion }, userAnswer: userInput, isCorrect, timestamp: Date.now()
    });

    const nextIndex = currentTest.currentQuestionIndex + 1;

    if (nextIndex < currentTest.questions.length) {
      currentTest.currentQuestionIndex = nextIndex;
      return this._presentCurrentQuestion();
    }

    // Verification complete
    const correctCount = verification.answers.filter(a => a.isCorrect).length;
    const totalCount   = verification.answers.length;
    const passed       = (correctCount / totalCount) >= (this._getConfig()?.masteryThreshold || 80) / 100;

    verification.passed = passed;
    verification.active = false;

    if (passed) {
      const topic = this.sessionState.remediation.currentTopic;
      this.sessionState.remediation.lessonsCompleted.push(topic);
      this.sessionState.phase = 'diagnosis';

      return {
        type: 'verification_passed',
        message: `✅ **Mastery achieved!**\n\nYou got ${correctCount}/${totalCount} correct. You've mastered this topic.`,
        phase: 'diagnosis',
        autoAdvance: true,
        delay: 2000,
        timestamp: Date.now()
      };
    }

    this.sessionState.phase    = 'remediation';
    this.sessionState.subPhase = 'repeat';

    return {
      type: 'verification_failed',
      message: `📚 **Need more practice**\n\nYou got ${correctCount}/${totalCount} correct. Let's review this topic again.`,
      phase: 'remediation',
      autoAdvance: true,
      delay: 2000,
      timestamp: Date.now()
    };
  };

  proto._generateVerificationQuestions = async function () {
    const topic = this.sessionState.remediation.currentTopic;

    if (!topic) {
      this.sessionState.phase = 'diagnosis';
      return this._showDiagnosis();
    }

    const questionCount = this._getConfig()?.verificationQuestions || 5;

    try {
      const quizSkill = this.skillManager.getSkill('generate-quiz');
      if (!quizSkill) throw new Error('generate-quiz skill not found');

      const result = await quizSkill.module.execute({
        userInput:    `Generate ${questionCount} verification questions for ${topic}`,
        difficulty:   'medium',
        topics:       [topic],
        count:        questionCount,
        activeSubject: this.knowledgeBase?.subjectId
      }, {
        studentId: this.studentId, memory: this.memory,
        studentModel: this.studentModel, model: this.model,
        knowledgeBase: this.knowledgeBase
      });

      let questions = [];
      if (result.questions && Array.isArray(result.questions)) {
        questions = result.questions;
      } else if (result.question) {
        questions = [result.question];
      } else {
        for (let i = 0; i < questionCount; i++) {
          questions.push({
            id: `vq-${Date.now()}-${i}`,
            text: `Explain the key concept of ${topic} in your own words.`,
            type: 'open', correctAnswer: 'Student demonstrates understanding',
            hint: 'Think about what makes this topic important.', difficulty: 'medium', topic
          });
        }
      }

      questions = questions.map((q, i) => {
        if (typeof q === 'string') {
          return {
            id: `vq-${Date.now()}-${i}`, text: q, type: 'open',
            correctAnswer: 'Student demonstrates understanding',
            hint: 'Think about what makes this topic important.', difficulty: 'medium', topic
          };
        }
        return {
          id:            q.id            || `vq-${Date.now()}-${i}`,
          text:          q.text          || q.question || 'Question text not available',
          type:          q.type          || 'open',
          options:       q.options       || [],
          correctAnswer: q.correctAnswer || '',
          explanation:   q.explanation   || '',
          hint:          q.hint          || '',
          difficulty:    q.difficulty    || 'medium',
          topic:         q.topic         || topic,
          syllabusPoint: q.syllabusPoint || null,
          marks:         q.marks         || 1,
          startTime:     null
        };
      });

      const testId = `verify-${Date.now()}`;
      this.sessionState.currentTest = {
        id: testId, type: 'mastery', name: `Mastery Check: ${topic}`,
        questions, currentQuestionIndex: 0, totalQuestions: questions.length,
        startTime: Date.now(), endTime: null, timeLimit: null, adaptive: false,
        currentDifficulty: 'medium', targetTopics: [topic],
        usedQuestionIds: questions.map(q => q.id).filter(Boolean)
      };

      this.sessionState.verification.questions     = questions;
      this.sessionState.verification.currentIndex  = 0;
      this.sessionState.verification.answers       = [];
      this.sessionState.phase                      = 'verification';
      this.sessionState.subPhase                   = 'testing';

      return this._presentCurrentQuestion();

    } catch (err) {
      console.error('[TestLed] Failed to generate verification questions:', err);
      this.sessionState.phase = 'diagnosis';
      return { type: 'error', message: 'Failed to generate verification questions. Please try again.', phase: 'diagnosis', timestamp: Date.now() };
    }
  };

  // ── Complete phase ───────────────────────────────────────────────────────
  proto._handleCompletePhase = async function (userInput) {
    const lower = userInput.toLowerCase().trim();

    if (lower === 'new test' || lower.includes('new test')) return this._startDefaultTest();
    if (lower === 'diagnosis' || lower.includes('back to results')) {
      this.sessionState.phase = 'diagnosis';
      return this._showDiagnosis();
    }

    return {
      type: 'complete',
      message: `## ✅ Test Cycle Complete\n\nGreat work! You've completed the test cycle.\n\nWhat would you like to do next?`,
      phase: 'complete',
      suggestions: [
        { icon: '📊', label: 'New test',       text: 'new test'   },
        { icon: '📚', label: 'Review results', text: 'diagnosis'  }
      ],
      timestamp: Date.now()
    };
  };

  // ── Not started phase ────────────────────────────────────────────────────
  proto._handleNotStartedPhase = async function (userInput) {
    if (userInput.length > 10 || userInput.includes('?')) {
      const response = await this._routeToSkill(userInput);
      return { type: 'skill_response', message: response, phase: 'not_started', timestamp: Date.now() };
    }

    return {
      type: 'prompt',
      message: 'Choose a test type to begin, or ask me a question.',
      phase: 'not_started',
      suggestions: [
        { icon: '📊', label: 'Diagnostic test', text: '__START_DIAGNOSTIC__'  },
        { icon: '🎯', label: 'Topic test',       text: '__START_TOPIC_TEST__' },
        { icon: '🔄', label: 'Mixed test',        text: '__START_MIXED_TEST__' }
      ],
      timestamp: Date.now()
    };
  };

  // ── Phase advance ────────────────────────────────────────────────────────
  proto._advancePhase = async function () {
    console.log(`[TestLed] Advancing from phase: ${this.sessionState.phase}`);

    switch (this.sessionState.phase) {
      case 'testing':
        return this._generateNextQuestion();

      case 'diagnosis':
        return this.sessionState.diagnosis.needsRemediation
          ? this._startRemediation()
          : this._showDiagnosis();

      case 'remediation':
        if (this.sessionState.remediation.modeSwitchRequested) {
          return { type: 'mode_switch_pending', message: '', autoAdvance: false, timestamp: Date.now() };
        }
        return this._startMasteryCheck();

      case 'verification':
        return { type: 'no_advance', autoAdvance: false, timestamp: Date.now() };

      case 'complete':
        this.sessionState.phase = 'not_started';
        return { type: 'session_complete', message: 'Test cycle complete. Ready for next test.', phase: 'not_started', timestamp: Date.now() };

      default:
        return { type: 'no_advance', autoAdvance: false, timestamp: Date.now() };
    }
  };
}

module.exports = { applyRemediation };