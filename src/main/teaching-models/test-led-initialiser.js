// test-led-initialiser.js
// All test-start methods: diagnostic, topic, mixed, mastery, default, retest.

'use strict';

function applyInitialiser(proto) {

  // ── Spaced repetition topic prioritiser ──────────────────────────────────
  // Returns topics sorted by priority:
  //   1. Topics failed last time (score = 0 in mastery)
  //   2. Topics not seen recently (oldest lastAttempt timestamp first)
  //   3. Topics with low mastery score
  //   4. Remaining topics (fill up to targetCount)
  //
  // Uses MemoryManager.getMasteryByTopic() and getRecentAttempts() which are
  // already available via this.memory.
  proto._prioritiseTopics = function (allTopics) {
    try {
      const masteryByTopic  = this.memory.getMasteryByTopic(this.studentId) || {};
      const recentAttempts  = this.memory.getRecentAttempts(this.studentId, 100) || [];

      // Build a map of topic → last attempt timestamp
      const lastSeen = {};
      for (const attempt of recentAttempts) {
        const topic = attempt.dotPoint?.split('.')?.[0] || attempt.dotPoint;
        if (topic && (!lastSeen[topic] || attempt.timestamp > lastSeen[topic])) {
          lastSeen[topic] = attempt.timestamp;
        }
      }

      const now = Date.now();
      const DAY = 24 * 60 * 60 * 1000;

      // Score each topic — lower score = higher priority (tested first)
      const scored = allTopics.map(topic => {
        const mastery  = masteryByTopic[topic] ?? null;   // null = never seen
        const ageDays  = lastSeen[topic]
          ? (now - lastSeen[topic]) / DAY
          : 999;  // never seen → treat as very stale

        let priority = 0;

        // Never practised at all → highest priority
        if (mastery === null) {
          priority = -200;
        }
        // Failed last time (mastery < 0.4) → very high priority
        else if (mastery < 0.4) {
          priority = -100 + (mastery * 100);
        }
        // Weak but not failed (0.4–0.6) → high priority
        else if (mastery < 0.6) {
          priority = -50 + (mastery * 50);
        }
        // Not seen in > 7 days → medium-high priority (spaced repetition)
        else if (ageDays > 7) {
          priority = ageDays * -1;   // more stale = more negative = higher priority
        }
        // Otherwise sort by lowest mastery
        else {
          priority = mastery * 100;
        }

        return { topic, priority, mastery, ageDays };
      });

      scored.sort((a, b) => a.priority - b.priority);

      const sorted = scored.map(s => s.topic);
      console.log('[TestLed] Spaced repetition topic order:', sorted.map((t, i) => {
        const s = scored[i];
        return `${t}(m=${s.mastery?.toFixed(2) ?? 'new'}, age=${s.ageDays.toFixed(0)}d)`;
      }).join(', '));

      return sorted;
    } catch (err) {
      console.warn('[TestLed] _prioritiseTopics failed, using default order:', err.message);
      return allTopics;
    }
  };

  proto._startDiagnosticTest = async function () {
    await this._loadStudentModel();

    const allTopics = this._getAllTopics();

    if (allTopics.length === 0) {
      return { type: 'error', message: 'No topics found in knowledge base.', phase: 'not_started', timestamp: Date.now() };
    }

    console.log(`[TestLed] Found ${allTopics.length} topics from topics array`);

    // Apply spaced repetition — prioritise stale/weak topics
    const prioritisedTopics = this._prioritiseTopics(allTopics);

    const testId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const targetQuestionCount = Math.min(Math.max(prioritisedTopics.length, 5), 10);

    const topicDifficulty    = {};
    const topicQuestionCounts = {};
    for (const t of prioritisedTopics) {
      topicDifficulty[t]     = 'medium';
      topicQuestionCounts[t] = 0;
    }

    this.sessionState.currentTest = {
      id: testId,
      type: 'diagnostic',
      name: 'Diagnostic Test',
      questions: [],
      currentQuestionIndex: 0,
      totalQuestions: 0,
      targetQuestionCount,
      startTime: Date.now(),
      endTime: null,
      timeLimit: null,
      adaptive: true,
      currentDifficulty: 'medium',
      targetTopics: prioritisedTopics,
      usedQuestionIds: [],
      nextTopicIndex: 0,
      topicDifficulty,
      topicQuestionCounts,
      topicCorrectCounts: Object.fromEntries(prioritisedTopics.map(t => [t, 0])),
    };

    this.sessionState.answers      = [];
    this.sessionState.phase        = 'testing';
    this.sessionState.subPhase     = 'diagnostic';
    this.sessionState.isInterrupted = false;

    return this._generateNextQuestion();
  };

  proto._startTopicTest = async function () {
    await this._loadStudentModel();

    const weakTopics   = this.studentModel.weakestTopics || [];
    const atRiskTopics = this.studentModel.examReadinessForecast?.criticalTopics || [];

    let targetTopics = [];
    if (atRiskTopics.length > 0) {
      targetTopics = atRiskTopics.slice(0, 3);
    } else if (weakTopics.length > 0) {
      targetTopics = weakTopics.slice(0, 3).map(t => t.code);
    } else {
      targetTopics = this._getAllTopics().slice(0, 3);
    }

    const testId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    this.sessionState.currentTest = {
      id: testId,
      type: 'topic',
      name: `Topic Test: ${targetTopics.join(', ')}`,
      questions: [],
      currentQuestionIndex: 0,
      totalQuestions: 0,
      targetQuestionCount: 5,
      startTime: Date.now(),
      endTime: null,
      timeLimit: null,
      adaptive: true,
      currentDifficulty: 'medium',
      targetTopics,
      usedQuestionIds: []
    };

    this.sessionState.answers      = [];
    this.sessionState.phase        = 'testing';
    this.sessionState.subPhase     = 'topic';
    this.sessionState.isInterrupted = false;

    return this._generateNextQuestion();
  };

  proto._startMixedTest = async function () {
    await this._loadStudentModel();

    const weakTopics   = (this.studentModel.weakestTopics || []).map(t => t.code);
    const atRiskTopics = this.studentModel.examReadinessForecast?.criticalTopics || [];
    const targetTopics = [...new Set([...atRiskTopics, ...weakTopics])].slice(0, 5);

    if (targetTopics.length === 0) {
      const allTopics = this._getAllTopics();
      while (targetTopics.length < 5 && allTopics.length > 0) {
        const randomTopic = allTopics[Math.floor(Math.random() * allTopics.length)];
        if (!targetTopics.includes(randomTopic)) targetTopics.push(randomTopic);
      }
    }

    const testId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    this.sessionState.currentTest = {
      id: testId,
      type: 'mixed',
      name: 'Mixed Test',
      questions: [],
      currentQuestionIndex: 0,
      totalQuestions: 0,
      targetQuestionCount: 5,
      startTime: Date.now(),
      endTime: null,
      timeLimit: null,
      adaptive: true,
      currentDifficulty: 'medium',
      targetTopics,
      usedQuestionIds: []
    };

    this.sessionState.answers      = [];
    this.sessionState.phase        = 'testing';
    this.sessionState.subPhase     = 'mixed';
    this.sessionState.isInterrupted = false;

    return this._generateNextQuestion();
  };

  proto._startMasteryCheck = async function () {
    await this._loadStudentModel();

    // Topics to verify come from one of three sources (in priority order):
    //   1. Remediation lessons completed (after Teacher-Led remediation)
    //   2. Topics from the just-completed test (direct "Verify mastery" from diagnosis)
    //   3. All KB topics (fallback)
    const remediationTopics = this.sessionState.remediation?.lessonsCompleted || [];

    // Collect topics from the last test's answers
    const testedTopics = [];
    const seen = new Set();
    for (const answer of (this.sessionState.answers || [])) {
      const t = answer.question?.topic;
      if (t && !seen.has(t)) { seen.add(t); testedTopics.push(t); }
    }

    // Also check the last test's targetTopics in case answers are cleared
    const testTargetTopics = this.sessionState.currentTest?.targetTopics || [];

    const topicsToVerify = remediationTopics.length > 0
      ? remediationTopics
      : testedTopics.length > 0
        ? testedTopics
        : testTargetTopics.length > 0
          ? testTargetTopics
          : this._getAllTopics().slice(0, 6);

    if (topicsToVerify.length === 0) {
      return {
        type: 'prompt',
        message: 'No topics found to verify. Please run a diagnostic test first.',
        phase: 'diagnosis',
        suggestions: [
          { icon: '📋', label: 'Start diagnostic', text: '__START_DIAGNOSTIC__' },
          { icon: '📊', label: 'Back to results',  text: 'review' }
        ],
        timestamp: Date.now()
      };
    }

    // For a mastery check after a perfect score, bump difficulty to hard
    const lastScore = this.sessionState.results?.score ?? 0;
    const difficulty = lastScore >= 90 ? 'hard' : lastScore >= 70 ? 'medium' : 'easy';

    const source = remediationTopics.length > 0 ? 'post-remediation'
                 : testedTopics.length > 0       ? 'tested-topics'
                 : 'all-topics';
    console.log(`[TestLed] Mastery check: ${topicsToVerify.length} topics (source: ${source}, difficulty: ${difficulty})`);

    const testId = `verify-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    this.sessionState.currentTest = {
      id: testId,
      type: 'mastery',
      name: 'Mastery Check',
      questions: [],
      currentQuestionIndex: 0,
      totalQuestions: 0,
      targetQuestionCount: Math.min(topicsToVerify.length * 2, 10),
      startTime: Date.now(),
      endTime: null,
      timeLimit: null,
      adaptive: false,
      currentDifficulty: difficulty,
      targetTopics: topicsToVerify,
      usedQuestionIds: [],
      topicDifficulty: Object.fromEntries(topicsToVerify.map(t => [t, difficulty])),
      topicQuestionCounts: Object.fromEntries(topicsToVerify.map(t => [t, 0])),
      topicCorrectCounts:  Object.fromEntries(topicsToVerify.map(t => [t, 0])),
    };

    this.sessionState.answers                   = [];
    this.sessionState.phase                     = 'verification';
    this.sessionState.subPhase                  = 'mastery_check';
    this.sessionState.verification.active       = true;
    this.sessionState.isInterrupted             = false;

    return this._generateNextQuestion();
  };

  proto._startDefaultTest = async function () {
    const config      = this._getConfig();
    const defaultType = config?.defaultTestType || 'diagnostic';

    if (defaultType === 'diagnostic') return this._startDiagnosticTest();
    if (defaultType === 'topic')      return this._startTopicTest();
    return this._startMixedTest();
  };

  proto._startRetest = async function () {
    // Prefer weakest topics; if all 100% fall back to all tested topics
    const targetTopics = (this.sessionState.diagnosis.weakestTopics || [])
      .slice(0, 3)
      .map(t => t.topic);

    if (targetTopics.length === 0) {
      // No weak topics (e.g. perfect score) — retest all topics from last test
      const testedTopics = [...new Set(
        (this.sessionState.answers || []).map(a => a.question?.topic).filter(Boolean)
      )];
      if (testedTopics.length > 0) {
        targetTopics.push(...testedTopics.slice(0, 6));
      } else {
        return this._startDefaultTest();
      }
    }

    const testId = `retest-${Date.now()}`;

    this.sessionState.currentTest = {
      id: testId,
      type: 'topic',
      name: `Retest: ${targetTopics.join(', ')}`,
      questions: [],
      currentQuestionIndex: 0,
      totalQuestions: 0,
      startTime: Date.now(),
      endTime: null,
      timeLimit: null,
      adaptive: true,
      currentDifficulty: 'medium',
      targetTopics,
      usedQuestionIds: []
    };

    this.sessionState.answers      = [];
    this.sessionState.phase        = 'testing';
    this.sessionState.subPhase     = 'topic';
    this.sessionState.isInterrupted = false;

    return this._generateNextQuestion();
  };

  proto._handleInterruption = async function (userInput) {
    this.sessionState.interruptedState = {
      phase:                this.sessionState.phase,
      subPhase:             this.sessionState.subPhase,
      currentTest:          { ...this.sessionState.currentTest },
      answers:              [...this.sessionState.answers],
      currentQuestionIndex: this.sessionState.currentTest.currentQuestionIndex,
      diagnosis:            { ...this.sessionState.diagnosis },
      remediation:          { ...this.sessionState.remediation },
      verification:         { ...this.sessionState.verification }
    };

    this.sessionState.isInterrupted = true;
    this.sessionState.phase         = 'interrupted';

    const response = await this._routeToSkill(userInput);

    return {
      type: 'interruption_response',
      message: response,
      canResume: true,
      suggestions: ['↺ Resume test', 'Ask another question'],
      phase: 'interrupted',
      teachingPhase: 'interrupted',
      teachingSubPhase: null,
      teachingProgress: this._calculateProgress(),
      currentStep: this._getCurrentStep(),
      totalSteps: this._getTotalSteps(),
      stepName: 'Interrupted',
      proactive: false,
      timestamp: Date.now()
    };
  };

  proto._resumeTest = async function () {
    if (!this.sessionState.interruptedState) {
      return { type: 'error', message: 'No interrupted test to resume.', phase: 'not_started', timestamp: Date.now() };
    }

    const s = this.sessionState.interruptedState;
    this.sessionState.phase        = s.phase;
    this.sessionState.subPhase     = s.subPhase;
    this.sessionState.currentTest  = s.currentTest;
    this.sessionState.answers      = s.answers;
    this.sessionState.diagnosis    = s.diagnosis;
    this.sessionState.remediation  = s.remediation;
    this.sessionState.verification = s.verification;
    this.sessionState.isInterrupted        = false;
    this.sessionState.interruptedState     = null;

    if (this.sessionState.phase === 'testing') return this._presentCurrentQuestion();
    return this._advancePhase();
  };
}

module.exports = { applyInitialiser };