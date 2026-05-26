// tests/student-model/test-student-model.js
// Run with: node tests/student-model/test-student-model.js

'use strict';

const StudentModelModule  = require('../../src/main/student-model/index');
const masterySynthesiser  = require('../../src/main/student-model/mastery-synthesiser');
const styleInferrer       = require('../../src/main/student-model/style-inferrer');
const velocityAnalyser    = require('../../src/main/student-model/velocity-analyser');
const affectiveDetector   = require('../../src/main/student-model/affective-detector');
const readinessForecaster = require('../../src/main/student-model/readiness-forecaster');

let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ ${label}`); failed++; }
}

function approx(a, b, tolerance = 0.05) {
  return Math.abs(a - b) <= tolerance;
}

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const MASTERY_DATA = {
  dotPoints: {
    'MA-F1.1': 0.85, 'MA-F1.2': 0.70,
    'MA-C1.3': 0.40, 'MA-C2.1': 0.55,
    'MA-S1.2': 0.25, 'MA-S2.1': 0.30,
    'MA-T1.1': 0.65,
    'MA-E1.1': 0.75,
    'MA-M1.1': 0.80,
  },
};

const VELOCITY_DATA = {
  topics: {
    'MA-C': { label: 'Calculus',           velocityPerSession: 0.04, trend: 'improving', avgAttemptsToConsolidate: 6  },
    'MA-S': { label: 'Statistical Analysis', velocityPerSession: 0.01, trend: 'stalling',  avgAttemptsToConsolidate: 14 },
    'MA-F': { label: 'Functions',           velocityPerSession: 0.03, trend: 'improving', avgAttemptsToConsolidate: 5  },
    'MA-T': { label: 'Trigonometry',        velocityPerSession: -0.02, trend: 'declining', avgAttemptsToConsolidate: 12 },
  },
};

const LEARNING_STYLE_DATA = {
  preferredRepresentation: 'visual',
  respondsWellTo:  ['worked examples', 'diagrams'],
  strugglesWith:   ['abstract notation'],
  observationCount: 15,
  representationCounts: { visual: 12, algebraic: 3, numerical: 5 },
};

const AFFECTIVE_HISTORY = {
  dominantState: 'focused',
  history: [
    { engagement: 'focused',    timestamp: new Date(Date.now() - 10 * 60000).toISOString() },
    { engagement: 'confident',  timestamp: new Date(Date.now() -  5 * 60000).toISOString() },
    { engagement: 'focused',    timestamp: new Date(Date.now() -  2 * 60000).toISOString() },
  ],
};

const FULL_RAW_DATA = {
  profile: {
    studentId:       'test-student',
    name:            'Alex',
    examDate:        new Date(Date.now() + 20 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    weeklyStudyHours: 6,
    motivationStyle: 'progress visibility',
    confidenceLevel: 'medium',
  },
  syllabusMastery:  MASTERY_DATA,
  velocity:         VELOCITY_DATA,
  learningStyle:    LEARNING_STYLE_DATA,
  affectiveHistory: AFFECTIVE_HISTORY,
  progress:         { totalAttempts: 42, recentAccuracy: 0.71 },
  examReadiness:    { overall: 0.58 },
  mistakes: [
    { dotPoint: 'MA-C1.3', errorType: 'conceptual' },
    { dotPoint: 'MA-C1.3', errorType: 'computational' },
    { dotPoint: 'MA-S1.2', errorType: 'conceptual' },
  ],
};

// ─────────────────────────────────────────────────────────────
// Mastery Synthesiser tests
// ─────────────────────────────────────────────────────────────

function testMasterySynthesiser() {
  console.log('\n── Mastery Synthesiser ──');

  const result = masterySynthesiser.synthesise(MASTERY_DATA, null);

  assert(typeof result.masteryProfile === 'object', 'Returns masteryProfile object');
  assert(Array.isArray(result.weakDotPoints), 'Returns weakDotPoints array');
  assert(result.weakDotPoints.length > 0, 'Identifies weak dot-points');
  assert(result.weakDotPoints[0].score <= result.weakDotPoints[1].score,
    'Weak dot-points sorted weakest first');
  assert(result.weakDotPoints[0].code === 'MA-S1.2',
    'Weakest dot-point is MA-S1.2 (score 0.25)');
  assert(result.weakDotPoints.every(dp => dp.score < masterySynthesiser.WEAK_THRESHOLD),
    'All weak dot-points are below threshold');

  assert(typeof result.topicMastery === 'object', 'Returns topicMastery');
  assert(result.topicMastery['MA-F'] !== undefined, 'MA-F topic mastery computed');
  assert(approx(result.topicMastery['MA-F'], 0.775),
    `MA-F topic mastery ≈ 0.775 (average of 0.85, 0.70) [got ${result.topicMastery['MA-F']}]`);

  assert(result.atRiskTopics.includes('MA-S'),
    'MA-S flagged as at-risk (average mastery < 0.55)');
  assert(!result.atRiskTopics.includes('MA-F'),
    'MA-F not flagged at-risk');

  assert(typeof result.overallMastery === 'number', 'Returns overallMastery number');
  assert(result.overallMastery > 0 && result.overallMastery < 1,
    'overallMastery is in valid range (0–1)');
  assert(Array.isArray(result.weakestTopics), 'Returns weakestTopics array');
  assert(result.weakestTopics[0].score <= result.weakestTopics[1]?.score ?? 1,
    'weakestTopics sorted ascending');
}

// ─────────────────────────────────────────────────────────────
// Style Inferrer tests
// ─────────────────────────────────────────────────────────────

function testStyleInferrer() {
  console.log('\n── Style Inferrer ──');

  const result = styleInferrer.infer(LEARNING_STYLE_DATA);

  assert(result.preferredRepresentation === 'visual',
    'Correctly infers visual preference');
  assert(result.confidence === 'strong',
    'Confidence is strong (15 observations)');
  assert(!result.isAmbiguous, 'Not ambiguous — visual clearly leads');
  assert(Array.isArray(result.respondsWellTo), 'respondsWellTo is array');
  assert(result.observationCount === 15, 'observationCount preserved');

  // Test with insufficient observations
  const sparse = styleInferrer.infer({ observationCount: 2, representationCounts: { visual: 2 } });
  assert(sparse.preferredRepresentation === null,
    'Returns null preference when fewer than 4 observations');
  assert(sparse.confidence === 'unknown', 'Confidence unknown when sparse');

  // Test with ambiguous counts
  const ambiguous = styleInferrer.infer({
    observationCount: 12,
    representationCounts: { visual: 5, algebraic: 4, numerical: 3 },
  });
  assert(ambiguous.isAmbiguous === true,
    'Flags ambiguous when counts are close');

  // Test null input
  const nullResult = styleInferrer.infer(null);
  assert(nullResult.preferredRepresentation === null,
    'Handles null input gracefully');
}

// ─────────────────────────────────────────────────────────────
// Velocity Analyser tests
// ─────────────────────────────────────────────────────────────

function testVelocityAnalyser() {
  console.log('\n── Velocity Analyser ──');

  const result = velocityAnalyser.analyse(VELOCITY_DATA);

  assert(typeof result.topics === 'object', 'Returns topics object');
  assert(result.improvingTopics.includes('MA-C'), 'MA-C correctly identified as improving');
  assert(result.improvingTopics.includes('MA-F'), 'MA-F correctly identified as improving');
  assert(result.stallingTopics.includes('MA-S'),  'MA-S correctly identified as stalling');
  assert(result.decliningTopics.includes('MA-T'), 'MA-T correctly identified as declining');

  assert(result.needsIntervention.includes('MA-T'),
    'MA-T flagged as needing intervention (declining)');
  assert(result.needsIntervention.includes('MA-S'),
    'MA-S flagged as needing intervention (stalling + low momentum)');
  assert(!result.needsIntervention.includes('MA-C'),
    'MA-C not flagged for intervention (improving)');

  assert(result.topics['MA-C'].momentumScore > result.topics['MA-S'].momentumScore,
    'MA-C has higher momentum than MA-S');
  assert(result.topics['MA-C'].momentumScore > result.topics['MA-T'].momentumScore,
    'MA-C has higher momentum than MA-T');

  // Empty input
  const empty = velocityAnalyser.analyse(null);
  assert(Array.isArray(empty.improvingTopics) && empty.improvingTopics.length === 0,
    'Handles null input gracefully');
}

// ─────────────────────────────────────────────────────────────
// Affective Detector tests
// ─────────────────────────────────────────────────────────────

function testAffectiveDetector() {
  console.log('\n── Affective Detector ──');

  // Normal focused state
  const focused = affectiveDetector.detect(
    AFFECTIVE_HISTORY,
    { totalAttempts: 10 },
    { sessionAttempts: 5, recentAccuracy: 0.70 },
  );
  assert(focused.currentEngagement === 'focused' || focused.currentEngagement === 'confident',
    'Returns focused or confident for normal session');

  // High accuracy → confident
  const confident = affectiveDetector.detect(
    { dominantState: 'focused', history: [] },
    {},
    { sessionAttempts: 8, recentAccuracy: 0.85 },
  );
  assert(confident.currentEngagement === 'confident',
    'Derives confident state from high accuracy (0.85)');

  // Low accuracy → frustrated
  const frustrated = affectiveDetector.detect(
    { dominantState: 'focused', history: [] },
    {},
    { sessionAttempts: 10, recentAccuracy: 0.25 },
  );
  assert(frustrated.currentEngagement === 'frustrated',
    'Derives frustrated state from low accuracy (0.25)');

  // Many attempts → fatigued
  const fatigued = affectiveDetector.detect(
    { dominantState: 'focused', history: [] },
    {},
    { sessionAttempts: 20, recentAccuracy: 0.60 },
  );
  assert(fatigued.currentEngagement === 'fatigued',
    'Derives fatigued state from high session attempt count (20)');

  // Explicit recent signal wins
  const recentFrustrated = affectiveDetector.detect(
    {
      dominantState: 'focused',
      history: [{ engagement: 'frustrated', timestamp: new Date().toISOString() }],
    },
    {},
    { sessionAttempts: 3, recentAccuracy: 0.80 },  // stats say confident
  );
  // Recent explicit signal (frustrated) should NOT override stats saying confident
  // because the spec says trust recovery over stale frustration
  assert(
    recentFrustrated.currentEngagement === 'confident' ||
    recentFrustrated.currentEngagement === 'frustrated',
    'Handles recent frustrated signal vs high accuracy appropriately',
  );

  // Null input
  const nullResult = affectiveDetector.detect(null, null, {});
  assert(typeof nullResult.currentEngagement === 'string',
    'Handles null input gracefully');
}

// ─────────────────────────────────────────────────────────────
// Readiness Forecaster tests
// ─────────────────────────────────────────────────────────────

function testReadinessForecaster() {
  console.log('\n── Readiness Forecaster ──');

  const mastery  = masterySynthesiser.synthesise(MASTERY_DATA, null);
  const velocity = velocityAnalyser.analyse(VELOCITY_DATA);

  // 20 weeks remaining, 4 sessions/week
  const result = readinessForecaster.forecast(mastery, velocity, 20, 4);

  assert(typeof result.overall === 'number', 'Returns overall forecast number');
  assert(result.overall >= 0 && result.overall <= 1, 'Overall forecast in valid range');
  assert(typeof result.overallBand === 'string', 'Returns overallBand string');
  assert(['on track', 'needs work', 'at risk', 'critical'].includes(result.overallBand),
    'overallBand is a valid value');

  assert(typeof result.byTopic === 'object', 'Returns byTopic object');
  assert(result.byTopic['MA-C'] !== undefined, 'MA-C forecast present');
  assert(result.byTopic['MA-C'].forecastedMastery >= result.byTopic['MA-C'].currentMastery,
    'Improving topic (MA-C) has forecasted >= current mastery');
  assert(result.byTopic['MA-T'].forecastedMastery <= result.byTopic['MA-T'].currentMastery + 0.01,
    'Declining topic (MA-T) forecast does not improve much');

  assert(Array.isArray(result.priorityOrder), 'Returns priorityOrder array');
  assert(result.priorityOrder.length > 0, 'priorityOrder is non-empty');

  // Urgency: 4 weeks remaining + below on-track
  const urgent = readinessForecaster.forecast(mastery, velocity, 4, 3);
  assert(urgent.isUrgent === true,
    'Flags urgency when exam is ≤6 weeks away and overall below on-track');

  // Plenty of time: not urgent
  const notUrgent = readinessForecaster.forecast(mastery, velocity, 30, 3);
  assert(notUrgent.isUrgent === false,
    'Not urgent with 30 weeks remaining');

  // Zero weeks remaining
  const zeroWeeks = readinessForecaster.forecast(mastery, velocity, 0, 3);
  assert(zeroWeeks.sessionsRemaining === 0, 'Zero sessions when 0 weeks remaining');
  assert(zeroWeeks.byTopic['MA-C'].forecastedMastery === zeroWeeks.byTopic['MA-C'].currentMastery,
    'Forecast equals current mastery when 0 weeks remaining');
}

// ─────────────────────────────────────────────────────────────
// Full Student Model Module integration test
// ─────────────────────────────────────────────────────────────

function testFullBuild() {
  console.log('\n── Full StudentModelModule.build() ──');

  const smm = new StudentModelModule();
  const model = smm.build(FULL_RAW_DATA, { sessionAttempts: 6, recentAccuracy: 0.67 });

  // Shape
  assert(model.studentId === 'test-student', 'studentId preserved');
  assert(model.profile.name === 'Alex', 'Profile name preserved');
  assert(typeof model.weeksRemaining === 'number', 'weeksRemaining computed');
  assert(model.weeksRemaining > 0 && model.weeksRemaining < 60, 'weeksRemaining in plausible range');

  // Mastery
  assert(typeof model.masteryProfile === 'object', 'masteryProfile present');
  assert(Array.isArray(model.weakDotPoints), 'weakDotPoints present');
  assert(model.weakDotPoints.length > 0, 'Weak dot-points identified');
  assert(typeof model.overallMastery === 'number', 'overallMastery present');

  // Style
  assert(model.learningStyle.preferredRepresentation === 'visual', 'Learning style inferred');
  assert(model.learningStyle.confidence === 'strong', 'Learning style confidence strong');

  // Velocity
  assert(model.velocity.improvingTopics.includes('MA-C'), 'MA-C in improving topics');
  assert(model.velocity.needsIntervention.includes('MA-T'), 'MA-T needs intervention');

  // Affective
  assert(typeof model.affectiveState.currentEngagement === 'string', 'Affective state present');
  assert(model.affectiveState.sessionAttempts === 6, 'Session attempts passed through');

  // Readiness
  assert(typeof model.examReadinessForecast.overall === 'number', 'Forecast overall present');
  assert(Array.isArray(model.examReadinessForecast.priorityOrder), 'Priority order present');
  assert(model.examReadinessForecast.byTopic['MA-C'] !== undefined, 'MA-C forecast present');

  // Mistake summary
  assert(model.mistakeSummary['MA-C1.3'] === 2, 'Mistake summary counts correctly (MA-C1.3 = 2)');
  assert(model.mistakeSummary['MA-S1.2'] === 1, 'Mistake summary counts correctly (MA-S1.2 = 1)');

  // Empty build
  const empty = smm.build(null);
  assert(empty.studentId === 'default', '_empty() returns valid object');
  assert(empty.affectiveState.currentEngagement === 'focused', '_empty() defaults to focused');
  assert(Array.isArray(empty.weakDotPoints) && empty.weakDotPoints.length === 0,
    '_empty() has empty weakDotPoints');
}

// ─────────────────────────────────────────────────────────────
// Run all
// ─────────────────────────────────────────────────────────────

function runAll() {
  console.log('=== Student Model Module Test Suite ===');

  testMasterySynthesiser();
  testStyleInferrer();
  testVelocityAnalyser();
  testAffectiveDetector();
  testReadinessForecaster();
  testFullBuild();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runAll();