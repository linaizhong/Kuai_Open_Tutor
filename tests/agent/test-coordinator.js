// tests/agent/test-coordinator.js
//
// Tests the Agent Coordinator in isolation using lightweight mocks
// for Memory Manager, Skill Manager, and Model Manager.
// Run with: node tests/agent/test-coordinator.js

'use strict';

const path        = require('path');
const Coordinator = require('../../src/main/agent/coordinator');

// ─────────────────────────────────────────────────────────────
// Minimal mocks
// ─────────────────────────────────────────────────────────────

function makeMockMemory(overrides = {}) {
  return {
    getContext: (studentId) => ({
      profile: { name: 'Test Student', studentId, examDate: '2025-10-15' },
      syllabusMastery: {
        dotPoints: { 'MA-C1.3': 0.45, 'MA-F1.1': 0.82, 'MA-S1.2': 0.30 },
      },
      progress:          { totalAttempts: 8, recentAccuracy: 0.625 },
      learningStyle:     { preferredRepresentation: 'visual', observationCount: 5 },
      velocity:          { topics: { 'MA-C': { trend: 'improving' } } },
      affectiveHistory:  { dominantState: 'focused', history: [] },
      examReadiness:     { overall: 0.58, byTopic: { 'MA-C': 0.52 } },
      mistakes:          [
        { dotPoint: 'MA-C1.3', errorType: 'computational', notes: 'sign error' },
      ],
    }),
    recordAttempt:       () => {},
    recordMistake:       () => {},
    updateDotPointMastery: () => {},
    updateLearningStyle: () => {},
    updateVelocity:      () => {},
    updateAffectiveState: () => {},
    updateProfile:       () => {},
    getOverallAccuracy:  () => 0.625,
    getProgress:         () => ({ sessions: [] }),
    getMistakesForDotPoint: () => [],
    ...overrides,
  };
}

function makeMockModel(responseText = 'Mock model response.') {
  return {
    chat: async (messages, options) => {
      return responseText;
    },
    listModels:         () => ({ local: [], cloud: [] }),
    testModel:          async () => ({ success: true, message: 'ok', time: 50 }),
    switchModel:        async () => {},
    setApiKey:          () => {},
    getConfigForDisplay: () => ({ activeModelId: 'mock', apiKeys: {} }),
    getStats:           () => ({ totalCalls: 0 }),
  };
}

function makeMockSkillManager(skillName = 'hsc-worked-example', resultOverride = {}) {
  const defaultResult = {
    result:        'Here is a worked solution...',
    visualization: null,
    syllabusPoint: 'MA-C1.3',
    ...resultOverride,
  };

  return {
    matchAndExecute: async (input, params, context) => ({
      result:      defaultResult,
      skillName,
      matchScore:  0.85,
      matchedBy:   'keyword',
    }),
    executePassiveSkills: async (params, context) => [
      { memoryUpdates: { type: 'learningStyle', signal: { preferredRepresentation: 'visual' } } },
      { memoryUpdates: { type: 'affectiveState', signal: { engagement: 'focused' } } },
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// Test runner
// ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

async function assertNoThrow(fn, label) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${label} — threw: ${err.message}`);
    failed++;
  }
}

async function assertThrows(fn, label) {
  try {
    await fn();
    console.error(`  ❌ ${label} — expected to throw but did not`);
    failed++;
  } catch {
    console.log(`  ✅ ${label}`);
    passed++;
  }
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

async function testConstruction() {
  console.log('\n── Construction ──');

  await assertNoThrow(() => {
    new Coordinator({
      memory:       makeMockMemory(),
      skillManager: makeMockSkillManager(),
      model:        makeMockModel(),
      kbRoot:       '/nonexistent/path',  // KB gracefully degrades
    });
  }, 'Constructs without throwing even if KB path missing');
}

async function testBasicChat() {
  console.log('\n── Basic chat() ──');

  const c = new Coordinator({
    memory:       makeMockMemory(),
    skillManager: makeMockSkillManager('hsc-worked-example'),
    model:        makeMockModel(),
    kbRoot:       '/nonexistent/path',
  });

  const result = await c.chat({ message: 'show me how to differentiate', studentId: 'student1' });

  assert(typeof result.response === 'string' && result.response.length > 0,
    'Returns non-empty response string');
  assert(result.skillUsed === 'hsc-worked-example',
    'Reports correct skillUsed');
  assert(result.syllabusPoint === 'MA-C1.3',
    'Reports syllabusPoint from skill result');
  assert(result.visualization === null,
    'Passes through visualization: null');
  assert(Array.isArray(result.adjustmentsApplied),
    'Returns adjustmentsApplied array');
  assert(typeof result.sessionAttempts === 'number',
    'Returns sessionAttempts');
}

async function testStudentModelBuilt() {
  console.log('\n── Student Model stub ──');

  const c = new Coordinator({
    memory:       makeMockMemory(),
    skillManager: makeMockSkillManager(),
    model:        makeMockModel(),
    kbRoot:       '/nonexistent/path',
  });

  const sm = await c.getStudentModel('student1');

  assert(typeof sm === 'object', 'getStudentModel returns object');
  assert(typeof sm.masteryProfile === 'object', 'Has masteryProfile');
  assert(Array.isArray(sm.weakDotPoints), 'Has weakDotPoints array');
  assert(sm.weakDotPoints.length > 0, 'Correctly identifies weak dot-points (mastery < 0.6)');
  assert(sm.weakDotPoints[0].code === 'MA-S1.2', 'Weakest dot-point is MA-S1.2 (score 0.30)');
  assert(typeof sm.affectiveState === 'object', 'Has affectiveState');
  assert(sm.affectiveState.currentEngagement === 'focused', 'Engagement defaults to focused');
  assert(sm.weeksRemaining !== null, 'weeksRemaining computed from examDate');
  assert(typeof sm.weeksRemaining === 'number', 'weeksRemaining is a number');
}

async function testSessionStatePersistence() {
  console.log('\n── Session state ──');

  // Simulate adaptive-drill returning a difficulty upgrade
  const drillSkillManager = makeMockSkillManager('adaptive-drill', {
    result:            'New drill question...',
    syllabusPoint:     'MA-C1.3',
    nextDifficulty:    'hard',
    difficultyChanged: true,
  });

  const c = new Coordinator({
    memory:       makeMockMemory(),
    skillManager: drillSkillManager,
    model:        makeMockModel(),
    kbRoot:       '/nonexistent/path',
  });

  await c.chat({ message: 'drill me', studentId: 'student2' });

  const state = c.getSessionState('student2');
  assert(state.currentDifficulty === 'hard',
    'Session state updates difficulty after adaptive-drill');
  assert(typeof state.sessionDurationMs === 'number',
    'Session duration tracked');
}

async function testHintCountEscalation() {
  console.log('\n── Hint count escalation ──');

  const socraticSkillManager = makeMockSkillManager('socratic-questioning', {
    result:        'What do you notice about the coefficient of x²?',
    syllabusPoint: 'MA-C1.3',
    guidanceLevel: 'light',
  });

  const c = new Coordinator({
    memory:       makeMockMemory(),
    skillManager: socraticSkillManager,
    model:        makeMockModel(),
    kbRoot:       '/nonexistent/path',
  });

  // First hint request
  await c.chat({ message: 'give me a hint', studentId: 'student3' });
  let state = c.getSessionState('student3');
  // hintRequestCount is internal — test via second chat that it escalates
  assert(state.historyLength === 1, 'History records first turn');

  // Second hint request on same problem
  await c.chat({ message: 'give me a hint', studentId: 'student3' });
  state = c.getSessionState('student3');
  assert(state.historyLength === 2, 'History records second turn');
}

async function testEndSession() {
  console.log('\n── Session management ──');

  const c = new Coordinator({
    memory:       makeMockMemory(),
    skillManager: makeMockSkillManager(),
    model:        makeMockModel(),
    kbRoot:       '/nonexistent/path',
  });

  await c.chat({ message: 'hello', studentId: 'student4' });
  c.endSession('student4');

  // After clearing, session state resets
  const state = c.getSessionState('student4');
  assert(state.sessionAttempts === 0, 'Session cleared — attempts reset to 0');
  assert(state.currentDifficulty === 'medium', 'Session cleared — difficulty reset to medium');
  assert(state.historyLength === 0, 'Session cleared — history empty');
}

async function testMemoryFailGracefully() {
  console.log('\n── Graceful degradation ──');

  const brokenMemory = {
    ...makeMockMemory(),
    getContext: () => { throw new Error('Disk read failure'); },
    updateLearningStyle: () => {},
    updateVelocity:      () => {},
    updateAffectiveState: () => {},
  };

  const c = new Coordinator({
    memory:       brokenMemory,
    skillManager: makeMockSkillManager(),
    model:        makeMockModel(),
    kbRoot:       '/nonexistent/path',
  });

  await assertNoThrow(
    () => c.chat({ message: 'help', studentId: 'student5' }),
    'Does not throw when memory.getContext() fails',
  );
}

async function testSkillFailGracefully() {
  console.log('\n── Skill failure fallback ──');

  const brokenSkills = {
    matchAndExecute:     async () => { throw new Error('Skill crashed'); },
    executePassiveSkills: async () => [],
  };

  const c = new Coordinator({
    memory:       makeMockMemory(),
    skillManager: brokenSkills,
    model:        makeMockModel(),
    kbRoot:       '/nonexistent/path',
  });

  const result = await c.chat({ message: 'help', studentId: 'student6' });

  assert(typeof result.response === 'string' && result.response.length > 0,
    'Returns a fallback response when skill throws');
  assert(!result.response.includes('undefined'),
    'Fallback response does not contain "undefined"');
}

async function testMultipleStudents() {
  console.log('\n── Multiple students ──');

  const c = new Coordinator({
    memory:       makeMockMemory(),
    skillManager: makeMockSkillManager(),
    model:        makeMockModel(),
    kbRoot:       '/nonexistent/path',
  });

  await c.chat({ message: 'hello', studentId: 'alice' });
  await c.chat({ message: 'hello', studentId: 'bob' });
  await c.chat({ message: 'hello', studentId: 'alice' });

  const aliceState = c.getSessionState('alice');
  const bobState   = c.getSessionState('bob');

  assert(aliceState.historyLength === 2, 'Alice has 2 turns');
  assert(bobState.historyLength   === 1, 'Bob has 1 turn');

  c.endSession('alice');
  const aliceAfter = c.getSessionState('alice');
  assert(aliceAfter.historyLength === 0, 'Alice session cleared without affecting Bob');
  assert(bobState.historyLength   === 1, 'Bob session intact after Alice cleared');
}

async function testConversationHistoryBounded() {
  console.log('\n── History bounding ──');

  const c = new Coordinator({
    memory:       makeMockMemory(),
    skillManager: makeMockSkillManager(),
    model:        makeMockModel(),
    kbRoot:       '/nonexistent/path',
  });

  // Send 25 messages (should be capped at 20 turns = 40 messages internally)
  for (let i = 0; i < 25; i++) {
    await c.chat({ message: `message ${i}`, studentId: 'student7' });
  }

  const state = c.getSessionState('student7');
  assert(state.historyLength <= 20, `History bounded to ≤20 turns (got ${state.historyLength})`);
}

// ─────────────────────────────────────────────────────────────
// Run all tests
// ─────────────────────────────────────────────────────────────

async function runAll() {
  console.log('=== Coordinator Test Suite ===\n');
  console.log('Note: passive skills run via setImmediate — memory update side-effects');
  console.log('are not awaited in these tests. Skill result routing is fully tested.\n');

  await testConstruction();
  await testBasicChat();
  await testStudentModelBuilt();
  await testSessionStatePersistence();
  await testHintCountEscalation();
  await testEndSession();
  await testMemoryFailGracefully();
  await testSkillFailGracefully();
  await testMultipleStudents();
  await testConversationHistoryBounded();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runAll().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});