// test-led-utils.js
// Shared constants and pure helper methods used across all test-led modules.
// No state — all methods receive what they need as arguments or via `this`.

'use strict';

// ── Constants ────────────────────────────────────────────────────────────────

const ERROR_TYPES = {
  CONCEPTUAL:    'Conceptual',
  COMPUTATIONAL: 'Computational',
  MISREAD:       'Misread'
};

const MASTERY_THRESHOLD  = 0.8;  // 80%  = mastered
const CONCERN_THRESHOLD  = 0.6;  // 60%  = needs attention
const CRITICAL_THRESHOLD = 0.4;  // 40%  = critical

// ── Mixin ────────────────────────────────────────────────────────────────────
// Call applyUtils(TestLedModel.prototype) after class definition to attach
// all helper methods without polluting the main file.

function applyUtils(proto) {

  // ── Config ──────────────────────────────────────────────────────────────
  proto._getConfig = function () {
    try {
      if (this.memory && this.memory.getConfig) {
        return this.memory.getConfig(this.studentId);
      }
    } catch { /* ignore */ }
    return {};
  };

  // ── Progress ─────────────────────────────────────────────────────────────
  proto._calculateProgress = function () {
    return (this._getCurrentStep() / this._getTotalSteps()) * 100;
  };

  proto._getCurrentStep = function () {
    const phaseSteps = {
      not_started:  0,
      testing:      1,
      diagnosis:    2,
      remediation:  3,
      verification: 4,
      complete:     5
    };
    if (this.sessionState.phase === 'testing') {
      return this.sessionState.currentTest.currentQuestionIndex + 1;
    }
    return phaseSteps[this.sessionState.phase] || 0;
  };

  proto._getTotalSteps = function () {
    return 5;
  };

  proto._getStepName = function () {
    const names = {
      not_started:  'Choose test',
      testing:      `Question ${(this.sessionState.currentTest?.currentQuestionIndex || 0) + 1}`,
      diagnosis:    'Review results',
      remediation:  'Learning from mistakes',
      verification: 'Verifying mastery',
      complete:     'Complete'
    };
    return names[this.sessionState.phase] || 'Test mode';
  };

  // ── Student model ─────────────────────────────────────────────────────────
  // _loadStudentModel is defined in test-led-model.js (needs super, must stay in class body)

  // ── Knowledge base — topics ───────────────────────────────────────────────
  proto._getAllTopics = function () {
    const syllabusMap = this.knowledgeBase?.syllabusMap || {};

    if (!syllabusMap || Object.keys(syllabusMap).length === 0) {
      console.warn('[TestLed] Knowledge base has no syllabus map');
      return [];
    }

    // STRATEGY 1: topics array
    if (syllabusMap.topics && Array.isArray(syllabusMap.topics)) {
      const topicCodes = syllabusMap.topics
        .filter(t => t && t.code)
        .map(t => t.code);
      if (topicCodes.length > 0) return topicCodes;
    }

    // STRATEGY 2: arrays of topic-like objects inside syllabusMap
    for (const key of Object.keys(syllabusMap)) {
      const value = syllabusMap[key];
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (first && (first.code || first.id || first.topicCode)) {
          const extracted = value
            .filter(item => item && (item.code || item.id || item.topicCode))
            .map(item => item.code || item.id || item.topicCode);
          if (extracted.length > 0) return extracted;
        }
      }
    }

    // STRATEGY 3: keys that match topic-code patterns (e.g. MA-F1, PY-BAS)
    const topics = [];
    const topicCodePattern = /^[A-Z]{2,}-[A-Z0-9]{1,}/;
    for (const key of Object.keys(syllabusMap)) {
      if (topicCodePattern.test(key)) topics.push(key);
    }
    if (topics.length > 0) return topics;

    // STRATEGY 4: extract parent topic codes from dot-point codes
    if (syllabusMap.dotPoints && typeof syllabusMap.dotPoints === 'object') {
      const topicSet = new Set();
      for (const dpCode of Object.keys(syllabusMap.dotPoints)) {
        const match = dpCode.match(/^([A-Z]{2,}-[A-Z0-9]{1,})/);
        if (match) topicSet.add(match[1]);
      }
      const extracted = Array.from(topicSet);
      if (extracted.length > 0) return extracted;
    }

    // STRATEGY 5: deep scan for objects with name + code/id
    const potentialTopics = [];
    const findTopics = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (obj.name && (obj.code || obj.id)) potentialTopics.push(obj.code || obj.id);
      for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') findTopics(val);
      }
    };
    findTopics(syllabusMap);

    if (potentialTopics.length > 0) return [...new Set(potentialTopics)];

    console.warn('[TestLed] Could not find any topics in knowledge base. Structure:',
      Object.keys(syllabusMap).slice(0, 5));
    return [];
  };

  proto._getTopicName = function (topicCode) {
    if (!topicCode) return topicCode;
    const syllabusMap = this.knowledgeBase?.syllabusMap || {};

    const findTopicName = (obj, code) => {
      if (!obj || typeof obj !== 'object') return null;
      if (obj.code === code && obj.name) return obj.name;
      if (obj.name && (obj.id === code || obj.topicCode === code)) return obj.name;
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const found = findTopicName(item, code);
          if (found) return found;
        }
      }
      for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') {
          const found = findTopicName(val, code);
          if (found) return found;
        }
      }
      return null;
    };

    return findTopicName(syllabusMap, topicCode) || topicCode;
  };

  // ── Interruption check ───────────────────────────────────────────────────
  proto._isInterruption = function (userInput) {
    const testCommands = [
      'submit', 'next', 'hint', 'skip', 'review',
      '__START_DIAGNOSTIC__', '__START_TOPIC_TEST__',
      '__START_MIXED_TEST__', '__START_MASTERY_CHECK__',
      '__AUTO_ADVANCE__', '↺ resume test', 'resume test'
    ];

    const lower = userInput.toLowerCase().trim();

    if (testCommands.some(cmd => lower.includes(cmd) || userInput.includes(cmd))) return false;
    if (this.sessionState.phase === 'testing') return false;

    const acknowledgments = ['ok', 'okay', 'got it', 'i see', 'yes', 'no', 'thanks'];

    if (this.sessionState.phase !== 'not_started' &&
        this.sessionState.phase !== 'interrupted' &&
        this.sessionState.phase !== 'diagnosis') {
      return !acknowledgments.includes(lower);
    }

    return false;
  };

  // ── Skill router (for interruptions) ─────────────────────────────────────
  proto._routeToSkill = async function (userInput) {
    const skillContext = {
      studentId:    this.studentId,
      memory:       this.memory,
      studentModel: this.studentModel,
      model:        this.model,
      knowledgeBase: this.knowledgeBase,
      kbManager:    this.knowledgeBase?.kbManager || null,
      skillManager: this.skillManager
    };

    const matchResult = await this.skillManager.matchAndExecute(
      userInput,
      { userInput, activeSubject: this.knowledgeBase?.subjectId },
      skillContext
    );

    return matchResult.result?.result || '';
  };
}

module.exports = { ERROR_TYPES, MASTERY_THRESHOLD, CONCERN_THRESHOLD, CRITICAL_THRESHOLD, applyUtils };