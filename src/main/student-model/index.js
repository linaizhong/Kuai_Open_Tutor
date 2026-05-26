// student-model/index.js
//
// Entry point for the Student Model Module.
//
// Exports a single class StudentModelModule with one primary method:
//   build(rawData, sessionStats?) → studentModel
//
// This replaces buildStudentModelStub() in the Coordinator.
// Swap in the Coordinator with:
//
//   const StudentModelModule = require('../student-model');
//   const smm = new StudentModelModule();
//   ...
//   const studentModel = smm.build(rawMemoryData, sessionStats);

'use strict';

const masterySynthesiser  = require('./mastery-synthesiser');
const styleInferrer       = require('./style-inferrer');
const velocityAnalyser    = require('./velocity-analyser');
const affectiveDetector   = require('./affective-detector');
const readinessForecaster = require('./readiness-forecaster');

class StudentModelModule {

  /**
   * Builds a complete, synthesised Student Model from raw Memory Manager data.
   *
   * This is called by the Coordinator on every conversation turn, so it must
   * be fast. All sub-components are pure functions — no I/O, no model calls.
   *
   * @param {object} rawData      — result of memory.getContext(studentId)
   * @param {object} sessionStats — live session data from Coordinator:
   *                                { sessionAttempts, recentAccuracy }
   * @returns {object}  Complete Student Model (matches architecture spec shape)
   */
  build(rawData, sessionStats = {}) {
    if (!rawData) return this._empty();

    const profile    = rawData.profile || {};
    const mistakes   = rawData.mistakes || [];

    // ── 1. Mastery Synthesiser ───────────────────────────────
    const mastery = masterySynthesiser.synthesise(
      rawData.syllabusMastery,
      rawData.syllabusMap || null,
    );

    // ── 2. Style Inferrer ────────────────────────────────────
    const style = styleInferrer.infer(rawData.learningStyle);

    // ── 3. Velocity Analyser ─────────────────────────────────
    const velocity = velocityAnalyser.analyse(rawData.velocity);

    // ── 4. Affective Detector ────────────────────────────────
    const affective = affectiveDetector.detect(
      rawData.affectiveHistory,
      rawData.progress,
      sessionStats,
    );

    // ── 5. Exam Readiness Forecaster ─────────────────────────
    const weeksRemaining = computeWeeksRemaining(profile.examDate);
    const sessionsPerWeek = profile.weeklyStudyHours
      ? Math.max(1, Math.round(profile.weeklyStudyHours / 1.5))  // ~90min sessions
      : 3;

    const readiness = readinessForecaster.forecast(
      mastery,
      velocity,
      weeksRemaining,
      sessionsPerWeek,
    );

    // ── Mistake summary ───────────────────────────────────────
    const mistakeSummary = {};
    for (const m of mistakes) {
      if (m.dotPoint) {
        mistakeSummary[m.dotPoint] = (mistakeSummary[m.dotPoint] || 0) + 1;
      }
    }

    // ── Assemble final Student Model ──────────────────────────
    // Shape exactly matches architecture spec Section 3.2.5
    return {
      studentId: profile.studentId || 'default',

      // Student profile metadata
      profile: {
        name:             profile.name             || 'Student',
        examDate:         profile.examDate         || null,
        weeklyStudyHours: profile.weeklyStudyHours || null,
        motivationStyle:  profile.motivationStyle  || null,
        confidenceLevel:  profile.confidenceLevel  || null,
        year11Background: profile.year11Background || null,
        ext1Experience:   profile.ext1Experience   || null,
      },

      // Exam timeline
      weeksRemaining,
      sessionsPerWeek,

      // From Mastery Synthesiser
      masteryProfile:  mastery.masteryProfile,    // { dotPointCode: score }
      topicMastery:    mastery.topicMastery,       // { "MA-C": 0.61, ... }
      weakDotPoints:   mastery.weakDotPoints,      // [{ code, score, topic, gap }]
      weakestTopics:   mastery.weakestTopics,      // [{ code, score }]
      atRiskTopics:    mastery.atRiskTopics,       // ["MA-S", ...]
      overallMastery:  mastery.overallMastery,     // 0.0–1.0
      coverage:        mastery.coverage,           // % of syllabus attempted

      // From Style Inferrer
      learningStyle: {
        preferredRepresentation: style.preferredRepresentation,
        confidence:              style.confidence,
        isAmbiguous:             style.isAmbiguous,
        respondsWellTo:          style.respondsWellTo,
        strugglesWith:           style.strugglesWith,
        observationCount:        style.observationCount,
      },

      // From Velocity Analyser
      velocity: {
        topics:             velocity.topics,
        improvingTopics:    velocity.improvingTopics,
        stallingTopics:     velocity.stallingTopics,
        decliningTopics:    velocity.decliningTopics,
        needsIntervention:  velocity.needsIntervention,
      },

      // From Affective Detector
      affectiveState: {
        currentEngagement:   affective.currentEngagement,
        frustrationDepth:    affective.frustrationDepth,
        sessionAttempts:     affective.sessionAttempts,
        recentSuccessRate:   affective.recentSuccessRate,
      },

      // From Readiness Forecaster
      examReadinessForecast: {
        overall:          readiness.overall,
        overallBand:      readiness.overallBand,
        byTopic:          readiness.byTopic,
        priorityOrder:    readiness.priorityOrder,
        criticalTopics:   readiness.criticalTopics,
        isUrgent:         readiness.isUrgent,
        sessionsRemaining: readiness.sessionsRemaining,
      },

      // Misc
      mistakeSummary,
    };
  }

  /**
   * Returns a safe empty Student Model.
   * Used when rawData is null (e.g. brand new student, no data yet).
   * @returns {object}
   */
  _empty() {
    return {
      studentId:    'default',
      profile:      { name: 'Student', examDate: null },
      weeksRemaining: null,
      sessionsPerWeek: 3,
      masteryProfile:  {},
      topicMastery:    {},
      weakDotPoints:   [],
      weakestTopics:   [],
      atRiskTopics:    [],
      overallMastery:  null,
      coverage:        0,
      learningStyle: {
        preferredRepresentation: null,
        confidence: 'unknown',
        isAmbiguous: false,
        respondsWellTo: [],
        strugglesWith: [],
        observationCount: 0,
      },
      velocity: {
        topics: {},
        improvingTopics: [],
        stallingTopics:  [],
        decliningTopics: [],
        needsIntervention: [],
      },
      affectiveState: {
        currentEngagement: 'focused',
        frustrationDepth:  'none',
        sessionAttempts:    0,
        recentSuccessRate:  null,
      },
      examReadinessForecast: {
        overall:        null,
        overallBand:    'unknown',
        byTopic:        {},
        priorityOrder:  [],
        criticalTopics: [],
        isUrgent:       false,
        sessionsRemaining: null,
      },
      mistakeSummary: {},
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

/**
 * Computes weeks remaining until the exam date.
 * @param {string|null} examDate  — ISO date string e.g. "2025-10-15"
 * @returns {number|null}
 */
function computeWeeksRemaining(examDate) {
  if (!examDate) return null;
  try {
    const msRemaining = new Date(examDate) - Date.now();
    return Math.max(0, Math.floor(msRemaining / (7 * 24 * 60 * 60 * 1000)));
  } catch {
    return null;
  }
}

module.exports = StudentModelModule;