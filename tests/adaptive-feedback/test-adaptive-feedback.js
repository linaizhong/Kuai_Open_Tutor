// tests/adaptive-feedback/test-adaptive-feedback.js
// Run with: node tests/adaptive-feedback/test-adaptive-feedback.js

'use strict';

const afe              = require('../../src/main/adaptive-feedback');
const toneAdjuster     = require('../../src/main/adaptive-feedback/tone-adjuster');
const scaffoldAdjuster = require('../../src/main/adaptive-feedback/scaffold-adjuster');
const formatSelector   = require('../../src/main/adaptive-feedback/format-selector');
const urgencyCalibrator = require('../../src/main/adaptive-feedback/urgency-calibrator');

let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ ${label}`); failed++; }
}

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const RAW = 'Here is the step-by-step solution to differentiate y = x³ + 2x...';

function makeModel(overrides = {}) {
  return {
    profile:          { name: 'Alex', motivationStyle: '', examDate: null },
    weeksRemaining:   20,
    overallMastery:   0.62,
    atRiskTopics:     [],
    affectiveState:   {
      currentEngagement: 'focused',
      frustrationDepth:  'none',
      recentSuccessRate: 0.70,
      sessionAttempts:   5,
    },
    learningStyle:    {
      preferredRepresentation: null,
      confidence: 'unknown',
    },
    velocity:         { needsIntervention: [] },
    examReadinessForecast: {
      overall:       0.62,
      isUrgent:      false,
      priorityOrder: [],
      byTopic:       {},
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tone adjuster tests
// ─────────────────────────────────────────────────────────────

function testToneAdjuster() {
  console.log('\n── Tone Adjuster ──');

  // Frustrated — should add prefix
  const frustrated = toneAdjuster.adjust(
    makeModel({ affectiveState: { currentEngagement: 'frustrated', frustrationDepth: 'moderate', recentSuccessRate: 0.3, sessionAttempts: 8 } }),
    'hsc-worked-example', {},
  );
  assert(frustrated.prefix.length > 0, 'Adds prefix for frustrated student');
  assert(frustrated.toneApplied === 'supportive' || frustrated.toneApplied === 'encouraging',
    'Tone is supportive/encouraging for frustrated');

  // Severe frustration
  const severe = toneAdjuster.adjust(
    makeModel({ affectiveState: { currentEngagement: 'frustrated', frustrationDepth: 'severe', recentSuccessRate: 0.15, sessionAttempts: 15 } }),
    'hsc-worked-example', {},
  );
  assert(severe.toneApplied === 'very-supportive', 'Severe frustration → very-supportive tone');

  // Fatigued
  const fatigued = toneAdjuster.adjust(
    makeModel({ affectiveState: { currentEngagement: 'fatigued', frustrationDepth: 'none', recentSuccessRate: 0.5, sessionAttempts: 22 } }),
    'hsc-worked-example', {},
  );
  assert(fatigued.prefix.length > 0, 'Adds prefix for fatigued student');
  assert(fatigued.toneApplied === 'concise', 'Tone is concise for fatigued');

  // Confident — should add challenge suffix
  const confident = toneAdjuster.adjust(
    makeModel({ affectiveState: { currentEngagement: 'confident', frustrationDepth: 'none', recentSuccessRate: 0.90, sessionAttempts: 6 } }),
    'hsc-worked-example', {},
  );
  assert(confident.suffix.length > 0, 'Adds suffix for confident student');
  assert(confident.toneApplied === 'challenging', 'Tone is challenging for confident');

  // Confident but on general-conversation — no suffix
  const confidentChat = toneAdjuster.adjust(
    makeModel({ affectiveState: { currentEngagement: 'confident', frustrationDepth: 'none', recentSuccessRate: 0.90, sessionAttempts: 6 } }),
    'general-conversation', {},
  );
  assert(confidentChat.suffix === '', 'No challenge suffix for general-conversation');

  // Progress visibility motivation + scoreSignal
  const progress = toneAdjuster.adjust(
    makeModel({ profile: { name: 'Alex', motivationStyle: 'progress visibility' } }),
    'hsc-worked-example', { scoreSignal: 0.9 },
  );
  assert(progress.suffix.includes('mastery') || progress.suffix.includes('progress'),
    'Progress visibility motivation adds mastery note');

  // Urgency — 3 weeks remaining
  const urgent = toneAdjuster.adjust(
    makeModel({ weeksRemaining: 3 }),
    'hsc-worked-example', {},
  );
  assert(urgent.suffix.includes('week') || urgent.suffix.includes('count'),
    'Adds urgency note when exam is close');

  // Focused / normal — no adjustments
  const normal = toneAdjuster.adjust(makeModel(), 'hsc-worked-example', {});
  assert(normal.prefix === '', 'No prefix for focused student');
  assert(normal.toneApplied === 'neutral', 'Tone is neutral for focused student');
}

// ─────────────────────────────────────────────────────────────
// Scaffold adjuster tests
// ─────────────────────────────────────────────────────────────

function testScaffoldAdjuster() {
  console.log('\n── Scaffold Adjuster ──');

  // At-risk topic + needs intervention → prerequisite hint
  const atRisk = scaffoldAdjuster.adjust(
    makeModel({
      atRiskTopics:  ['MA-S'],
      velocity:      { needsIntervention: ['MA-S'] },
      overallMastery: 0.45,
    }),
    'hsc-worked-example',
    { syllabusPoint: 'MA-S1.2' },
  );
  assert(atRisk.scaffoldNote.length > 0, 'Adds scaffold note for at-risk + stuck topic');
  assert(atRisk.scaffoldApplied === 'prerequisite-hint', 'scaffold type is prerequisite-hint');

  // Fatigued + very low accuracy → break suggestion
  const breakNeeded = scaffoldAdjuster.adjust(
    makeModel({
      affectiveState: { currentEngagement: 'fatigued', frustrationDepth: 'mild', recentSuccessRate: 0.20, sessionAttempts: 20 },
    }),
    'hsc-worked-example',
    {},
  );
  assert(
    breakNeeded.scaffoldApplied === 'break-suggestion' || breakNeeded.verbosityLevel === 'brief',
    'Suggests break or brevity for fatigued + low accuracy',
  );

  // Stalling but not at-risk
  const stalling = scaffoldAdjuster.adjust(
    makeModel({
      atRiskTopics:  [],
      velocity:      { needsIntervention: ['MA-C'] },
      overallMastery: 0.50,
    }),
    'generate-quiz',
    { syllabusPoint: 'MA-C1.3' },
  );
  assert(
    stalling.scaffoldNote.length > 0 || stalling.scaffoldApplied !== 'none',
    'Adds alternative-approach note for stalling topic',
  );

  // Normal — no scaffold needed
  const normal = scaffoldAdjuster.adjust(makeModel(), 'hsc-worked-example', { syllabusPoint: 'MA-C1.3' });
  assert(normal.scaffoldNote === '', 'No scaffold note for healthy student');
  assert(normal.verbosityLevel === 'normal', 'Verbosity is normal for healthy student');

  // Session-summary — always skipped
  const skip = scaffoldAdjuster.adjust(
    makeModel({ atRiskTopics: ['MA-S'], velocity: { needsIntervention: ['MA-S'] } }),
    'session-summary',
    { syllabusPoint: 'MA-S1.2' },
  );
  assert(skip.scaffoldNote === '', 'No scaffold note for session-summary skill');
}

// ─────────────────────────────────────────────────────────────
// Format selector tests
// ─────────────────────────────────────────────────────────────

function testFormatSelector() {
  console.log('\n── Format Selector ──');

  // Visual learner + response doesn't mention graphs
  const visual = formatSelector.adjust(
    makeModel({ learningStyle: { preferredRepresentation: 'visual', confidence: 'strong' } }),
    'hsc-worked-example',
    'Step 1: Differentiate y = x² + 3x. Use the power rule...',
  );
  assert(visual.formatNote.length > 0, 'Adds format note for visual learner');
  assert(visual.formatApplied === 'visual', 'Format applied is visual');

  // Visual learner + response already has graph language
  const alreadyVisual = formatSelector.adjust(
    makeModel({ learningStyle: { preferredRepresentation: 'visual', confidence: 'strong' } }),
    'hsc-worked-example',
    'Sketch the graph first — the diagram shows the turning point at...',
  );
  assert(alreadyVisual.formatNote === '', 'No format note when response already visual');
  assert(alreadyVisual.formatApplied === 'already-correct', 'Correctly detects already-visual response');

  // Unknown style — no format note
  const unknown = formatSelector.adjust(
    makeModel({ learningStyle: { preferredRepresentation: null, confidence: 'unknown' } }),
    'hsc-worked-example',
    RAW,
  );
  assert(unknown.formatNote === '', 'No format note for unknown style');

  // Emerging numerical preference
  const numerical = formatSelector.adjust(
    makeModel({ learningStyle: { preferredRepresentation: 'numerical', confidence: 'emerging' } }),
    'hsc-worked-example',
    'Use the product rule: (uv)\' = u\'v + uv\'...',
  );
  assert(numerical.formatNote.length > 0, 'Adds format note for numerical learner');

  // emotional-support skill — always skipped
  const skip = formatSelector.adjust(
    makeModel({ learningStyle: { preferredRepresentation: 'visual', confidence: 'strong' } }),
    'emotional-support',
    RAW,
  );
  assert(skip.formatNote === '', 'No format note for emotional-support skill');
}

// ─────────────────────────────────────────────────────────────
// Urgency calibrator tests
// ─────────────────────────────────────────────────────────────

function testUrgencyCalibrator() {
  console.log('\n── Urgency Calibrator ──');

  // Urgent — 2 weeks, below on-track
  const high = urgencyCalibrator.calibrate(
    makeModel({
      weeksRemaining: 2,
      examReadinessForecast: { overall: 0.50, isUrgent: true, priorityOrder: ['MA-S', 'MA-C'], byTopic: { 'MA-S': { band: 'critical' }, 'MA-C': { band: 'at risk' } } },
    }),
    'hsc-worked-example',
  );
  assert(high.urgencyLevel === 'high', 'Urgency is high at 2 weeks');
  assert(high.urgencyNote.length > 0, 'Adds urgency note');
  assert(high.priorityTopic === 'MA-S', 'Identifies MA-S as priority topic');

  // Medium urgency — 4 weeks
  const medium = urgencyCalibrator.calibrate(
    makeModel({
      weeksRemaining: 4,
      examReadinessForecast: { overall: 0.55, isUrgent: true, priorityOrder: ['MA-T'], byTopic: { 'MA-T': { band: 'at risk' } } },
    }),
    'generate-quiz',
  );
  assert(medium.urgencyLevel === 'medium', 'Urgency is medium at 4 weeks');

  // Low urgency — 6 weeks
  const low = urgencyCalibrator.calibrate(
    makeModel({
      weeksRemaining: 6,
      examReadinessForecast: { overall: 0.60, isUrgent: true, priorityOrder: [], byTopic: {} },
    }),
    'hsc-worked-example',
  );
  assert(low.urgencyLevel === 'low', 'Urgency is low at 6 weeks');

  // No urgency — plenty of time
  const none = urgencyCalibrator.calibrate(
    makeModel({ weeksRemaining: 20 }),
    'hsc-worked-example',
  );
  assert(none.urgencyLevel === 'none', 'No urgency with 20 weeks remaining');

  // On track — no urgency even if close
  const onTrack = urgencyCalibrator.calibrate(
    makeModel({
      weeksRemaining: 3,
      examReadinessForecast: { overall: 0.80, isUrgent: false, priorityOrder: [], byTopic: {} },
    }),
    'hsc-worked-example',
  );
  assert(onTrack.urgencyLevel === 'none', 'No urgency when student is on track');

  // emotional-support — always skipped
  const skip = urgencyCalibrator.calibrate(
    makeModel({ weeksRemaining: 1, examReadinessForecast: { overall: 0.30, isUrgent: true, priorityOrder: [], byTopic: {} } }),
    'emotional-support',
  );
  assert(skip.urgencyLevel === 'none', 'No urgency note for emotional-support skill');
}

// ─────────────────────────────────────────────────────────────
// Full adjustResponse() integration tests
// ─────────────────────────────────────────────────────────────

function testAdjustResponse() {
  console.log('\n── adjustResponse() integration ──');

  // Pass-through for read-only skill
  const readOnly = afe.adjustResponse({
    rawResponse:  RAW,
    studentModel: makeModel({ affectiveState: { currentEngagement: 'frustrated', frustrationDepth: 'severe', recentSuccessRate: 0.1, sessionAttempts: 15 } }),
    skillName:    'emotional-support',
    skillResult:  {},
  });
  assert(readOnly.adjustedResponse === RAW, 'emotional-support is never modified');
  assert(readOnly.adjustmentsApplied.length === 0, 'No adjustments for emotional-support');

  // Frustrated student + normal skill — should get prefix
  const frustrated = afe.adjustResponse({
    rawResponse:  RAW,
    studentModel: makeModel({ affectiveState: { currentEngagement: 'frustrated', frustrationDepth: 'moderate', recentSuccessRate: 0.30, sessionAttempts: 10 } }),
    skillName:    'hsc-worked-example',
    skillResult:  { syllabusPoint: 'MA-C1.3' },
  });
  assert(frustrated.adjustedResponse.length > RAW.length, 'Frustrated response is longer than raw');
  assert(frustrated.adjustmentsApplied.length > 0, 'At least one adjustment applied for frustrated');
  assert(frustrated.adjustmentsApplied.some(a => a.startsWith('tone:')),
    'Tone adjustment applied for frustrated');

  // Max 2 adjustments cap
  const manySignals = afe.adjustResponse({
    rawResponse:  RAW,
    studentModel: makeModel({
      affectiveState:   { currentEngagement: 'frustrated', frustrationDepth: 'moderate', recentSuccessRate: 0.25, sessionAttempts: 8 },
      atRiskTopics:     ['MA-S'],
      velocity:         { needsIntervention: ['MA-S'] },
      weeksRemaining:   3,
      examReadinessForecast: { overall: 0.40, isUrgent: true, priorityOrder: ['MA-S'], byTopic: { 'MA-S': { band: 'critical' } } },
      learningStyle:    { preferredRepresentation: 'visual', confidence: 'strong' },
    }),
    skillName:    'hsc-worked-example',
    skillResult:  { syllabusPoint: 'MA-S1.2' },
  });
  assert(manySignals.adjustmentsApplied.length <= 3,
    `No more than 3 adjustments even with many signals (got ${manySignals.adjustmentsApplied.length})`);

  // Always returns a string even for empty input
  const empty = afe.adjustResponse({ rawResponse: '', studentModel: makeModel(), skillName: 'hsc-worked-example', skillResult: {} });
  assert(typeof empty.adjustedResponse === 'string', 'Returns string for empty rawResponse');

  // Always returns a string even for null input
  const nullInput = afe.adjustResponse({ rawResponse: null, studentModel: makeModel(), skillName: 'hsc-worked-example', skillResult: {} });
  assert(typeof nullInput.adjustedResponse === 'string', 'Returns string for null rawResponse');

  // Normal focused student — no adjustments
  const normal = afe.adjustResponse({
    rawResponse:  RAW,
    studentModel: makeModel(),
    skillName:    'hsc-worked-example',
    skillResult:  {},
  });
  assert(normal.adjustedResponse === RAW, 'Normal focused student — response unchanged');
  assert(Array.isArray(normal.adjustmentsApplied), 'adjustmentsApplied is always array');
}

// ─────────────────────────────────────────────────────────────
// Run all tests
// ─────────────────────────────────────────────────────────────

function runAll() {
  console.log('=== Adaptive Feedback Engine Test Suite ===');

  testToneAdjuster();
  testScaffoldAdjuster();
  testFormatSelector();
  testUrgencyCalibrator();
  testAdjustResponse();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runAll();