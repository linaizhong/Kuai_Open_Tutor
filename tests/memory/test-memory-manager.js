// Memory Manager — Test Suite
// Run with: node test-memory-manager.js

const path = require('path');
const fs = require('fs');
const MemoryManager = require('../../src/main/memory');

// Use a temporary test data directory
const TEST_DATA_ROOT = path.join(__dirname, 'test-data');
const STUDENT_ID = 'test-student';

// Cleanup before test
if (fs.existsSync(TEST_DATA_ROOT)) {
  fs.rmSync(TEST_DATA_ROOT, { recursive: true });
}

const mm = new MemoryManager(TEST_DATA_ROOT);
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

// ─────────────────────────────────────────────
console.log('\n📋 1. Student Profile');
// ─────────────────────────────────────────────

const profile = mm.getProfile(STUDENT_ID);
assert('Profile created with defaults', profile !== null);
assert('Profile has name field', 'name' in profile);

mm.saveProfile(STUDENT_ID, {
  name: 'Alice',
  examDate: '2025-10-15',
  weeklyStudyHours: '10',
  subjectConfidence: 'medium',
  motivationStyle: 'progress visibility',
  year11Background: 'strong',
  extension1Experience: 'no',
});
const saved = mm.getProfile(STUDENT_ID);
assert('Profile name saved correctly', saved.name === 'Alice');
assert('Profile examDate saved correctly', saved.examDate === '2025-10-15');
assert('Profile motivationStyle saved', saved.motivationStyle === 'progress visibility');

// ─────────────────────────────────────────────
console.log('\n📝 2. Attempt Recording & Progress');
// ─────────────────────────────────────────────

mm.recordAttempt(STUDENT_ID, 'MA-C2.1', 'Find dy/dx for y = x^3', 'dy/dx = 3x^2', true);
mm.recordAttempt(STUDENT_ID, 'MA-C2.1', 'Find dy/dx for y = 5x^2', 'dy/dx = 5x', false);
mm.recordAttempt(STUDENT_ID, 'MA-F1.3', 'Sketch y = x^2 - 4', 'parabola with vertex (0,-4)', true);

const prog = mm.getProgress(STUDENT_ID);
assert('Progress total attempts = 3', prog.totalAttempts === 3);
assert('Progress total correct = 2', prog.totalCorrect === 2);
assert('Progress has sessions', prog.sessions.length > 0);

const accuracy = mm.getOverallAccuracy(STUDENT_ID);
assert('Overall accuracy = 0.667', Math.abs(accuracy - 2/3) < 0.001);

// ─────────────────────────────────────────────
console.log('\n🧠 3. Syllabus Mastery');
// ─────────────────────────────────────────────

const masteryScore = mm.getMasteryProfile(STUDENT_ID);
assert('MA-C2.1 has mastery score', 'MA-C2.1' in masteryScore);
assert('MA-F1.3 has mastery score', 'MA-F1.3' in masteryScore);

// MA-C2.1: first attempt correct (score=1.0), then wrong (score=0.0)
// After first: 1.0. After second: 0.7*1.0 + 0.3*0.0 = 0.7
const c21Score = masteryScore['MA-C2.1'];
assert('MA-C2.1 mastery reflects mixed attempts', c21Score > 0.6 && c21Score < 1.0);

// MA-F1.3: one correct attempt
const f13Score = masteryScore['MA-F1.3'];
assert('MA-F1.3 mastery = 1.0 after one correct', f13Score === 1.0);

const byTopic = mm.getMasteryByTopic(STUDENT_ID);
assert('getMasteryByTopic returns MA-C', 'MA-C' in byTopic);
assert('getMasteryByTopic returns MA-F', 'MA-F' in byTopic);

mm.updateDotPointMastery(STUDENT_ID, 'MA-S1.1', 0.3, 'quiz');
mm.updateDotPointMastery(STUDENT_ID, 'MA-S1.2', 0.2, 'quiz');
const weak = mm.getWeakDotPoints(STUDENT_ID, 0.6);
assert('Weak dot-points includes MA-S1.1', weak.some(w => w.code === 'MA-S1.1'));

// ─────────────────────────────────────────────
console.log('\n❌ 4. Mistake Recording');
// ─────────────────────────────────────────────

mm.recordMistake(STUDENT_ID, {
  dotPoint: 'MA-C2.1',
  problem: 'Differentiate y = x^3 + 2x',
  studentAnswer: 'dy/dx = 3x^2',
  errorType: 'computational',
  notes: 'Forgot to differentiate 2x term',
});
mm.recordMistake(STUDENT_ID, {
  dotPoint: 'MA-F1.3',
  problem: 'Find axis of symmetry',
  studentAnswer: 'x = b/2a',
  errorType: 'conceptual',
  notes: 'Used positive b/2a instead of -b/2a',
});

const allMistakes = mm.getMistakes(STUDENT_ID);
assert('Mistakes list has 2 entries', allMistakes.length === 2);

const c21Mistakes = mm.getMistakesForDotPoint(STUDENT_ID, 'MA-C2.1');
assert('MA-C2.1 has 1 mistake', c21Mistakes.length === 1);
assert('Mistake error type recorded', c21Mistakes[0].errorType === 'computational');

const summary = mm.getMistakeSummary(STUDENT_ID);
assert('Mistake summary has MA-C2.1', summary['MA-C2.1'] === 1);

// ─────────────────────────────────────────────
console.log('\n🎓 5. Exam Readiness');
// ─────────────────────────────────────────────

mm.updateExamReadiness(STUDENT_ID, 0.61, { 'MA-F': 0.82, 'MA-C': 0.55, 'MA-S': 0.38 });
const readiness = mm.getExamReadiness(STUDENT_ID);
assert('Exam readiness overall = 0.61', readiness.overall === 0.61);
assert('Exam readiness MA-F = 0.82', readiness.byTopic['MA-F'] === 0.82);
assert('lastUpdated is set', readiness.lastUpdated !== null);

// ─────────────────────────────────────────────
console.log('\n🎨 6. Learning Style');
// ─────────────────────────────────────────────

mm.updateLearningStyle(STUDENT_ID, {
  preferredRepresentation: 'visual',
  respondsWellTo: ['worked examples', 'diagrams'],
  strugglesWith: ['abstract notation'],
});
mm.updateLearningStyle(STUDENT_ID, {
  preferredRepresentation: 'visual',
  respondsWellTo: ['analogies'],
  strugglesWith: [],
});

const style = mm.getLearningStyle(STUDENT_ID);
assert('Preferred representation = visual', style.preferredRepresentation === 'visual');
assert('respondsWellTo has 3 items (no duplicates merged)', style.respondsWellTo.length === 3);
assert('strugglesWith has 1 item', style.strugglesWith.length === 1);
assert('Observation count = 2', style.observationCount === 2);

// ─────────────────────────────────────────────
console.log('\n⚡ 7. Learning Velocity');
// ─────────────────────────────────────────────

mm.updateVelocity(STUDENT_ID, 'MA-C', 'Calculus', 0.04, 6);
mm.updateVelocity(STUDENT_ID, 'MA-S', 'Statistical Analysis', 0.005, 14);

const vel = mm.getVelocity(STUDENT_ID);
assert('Velocity has MA-C', 'MA-C' in vel.topics);
assert('MA-C trend = improving', vel.topics['MA-C'].trend === 'improving');
assert('MA-S trend = stalling', vel.topics['MA-S'].trend === 'stalling');

const stalling = mm.getStallingTopics(STUDENT_ID);
assert('Stalling topics includes MA-S', stalling.some(t => t.code === 'MA-S'));

// ─────────────────────────────────────────────
console.log('\n😤 8. Affective State');
// ─────────────────────────────────────────────

mm.updateAffectiveState(STUDENT_ID, {
  engagement: 'frustrated',
  sessionAttempts: 8,
  recentSuccessRate: 0.25,
  notes: 'Student got 2 wrong in a row',
});
mm.updateAffectiveState(STUDENT_ID, {
  engagement: 'frustrated',
  sessionAttempts: 10,
  recentSuccessRate: 0.3,
});

const affectiveState = mm.getCurrentAffectiveState(STUDENT_ID);
assert('Current engagement = frustrated', affectiveState.currentEngagement === 'frustrated');
assert('Session attempts recorded', affectiveState.sessionAttempts === 10);

// ─────────────────────────────────────────────
console.log('\n🔬 9. Full Context (getContext)');
// ─────────────────────────────────────────────

const ctx = mm.getContext(STUDENT_ID);
assert('Context has studentId', ctx.studentId === STUDENT_ID);
assert('Context has profile', ctx.profile.name === 'Alice');
assert('Context has masteryProfile', typeof ctx.masteryProfile === 'object');
assert('Context has weakDotPoints', Array.isArray(ctx.weakDotPoints));
assert('Context has currentAffective', ctx.currentAffective.currentEngagement === 'frustrated');
assert('Context has stallingTopics', Array.isArray(ctx.stallingTopics));
assert('Context has learningStyle', ctx.learningStyle.preferredRepresentation === 'visual');

// ─────────────────────────────────────────────
// Cleanup test data
fs.rmSync(TEST_DATA_ROOT, { recursive: true });

// ─────────────────────────────────────────────
console.log('\n─────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('✅ All tests passed — Memory Manager is ready.\n');
} else {
  console.log('❌ Some tests failed — please review above.\n');
  process.exit(1);
}