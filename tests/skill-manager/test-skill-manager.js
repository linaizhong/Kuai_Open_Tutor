// Skill Manager — Test Suite
// Run with: node test-skill-manager.js

const path = require('path');
const fs   = require('fs');

const SkillManager             = require('./index');
const { parseSkillMd }         = require('./loader');
const { findBestSkill,
        getTopMatches,
        scoreSkill,
        normalise }            = require('./matcher');

const TEST_SKILLS_DIR = path.join(__dirname, 'test-skills');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ ${label}`); failed++; }
}

// ─────────────────────────────────────────────
console.log('\n📄 1. SKILL.md Parser');
// ─────────────────────────────────────────────

const sampleMd = `# Skill: hsc-worked-example

## Meta
- **Name**: hsc-worked-example
- **Type**: active
- **Phase**: Phase 1
- **Version**: 0.1.0

## Description
Step-by-step solutions in HSC examiner format

## Triggers
\`\`\`json
{
  "keywords": ["worked example", "show me how", "step by step"],
  "intent": "show a worked solution to a maths problem"
}
\`\`\`
`;

const parsed = parseSkillMd(sampleMd);
assert('Parses name correctly',        parsed.name === 'hsc-worked-example');
assert('Parses type correctly',        parsed.type === 'active');
assert('Parses description',           parsed.description.includes('HSC examiner'));
assert('Parses keywords array',        parsed.triggers.keywords.includes('worked example'));
assert('Parses intent string',         parsed.triggers.intent.includes('worked solution'));
assert('Keywords has 3 entries',       parsed.triggers.keywords.length === 3);

const passiveMd = `# Skill: detect-learning-style
## Meta
- **Name**: detect-learning-style
- **Type**: passive
## Description
Passive background skill
## Triggers
\`\`\`json
{ "keywords": [], "intent": "" }
\`\`\`
`;
const parsedPassive = parseSkillMd(passiveMd);
assert('Parses passive type',          parsedPassive.type === 'passive');
assert('Passive keywords is empty array', parsedPassive.triggers.keywords.length === 0);

// ─────────────────────────────────────────────
console.log('\n📂 2. Loader — Skill Loading');
// ─────────────────────────────────────────────

const sm = new SkillManager(TEST_SKILLS_DIR);

// Should throw if not loaded yet
let threw = false;
try { sm.getAllSkills(); } catch { threw = true; }
assert('Throws if used before load()',   threw);

sm.load();
const allSkills = sm.getAllSkills();
assert('Loads 13 skills total',          allSkills.length === 13);
assert('Active skills count = 9',        sm.getActiveSkills().length === 9);
assert('Passive skills count = 4',       sm.getPassiveSkills().length === 4);

const workedExample = sm.getSkill('hsc-worked-example');
assert('getSkill finds hsc-worked-example',  workedExample !== null);
assert('Skill has correct type',             workedExample.type === 'active');
assert('Skill has keywords loaded',          workedExample.triggers.keywords.length > 0);
assert('Skill module has execute()',         typeof workedExample.module.execute === 'function');

assert('getSkill returns null for unknown',  sm.getSkill('made-up-skill') === null);

const listed = sm.listSkills();
assert('listSkills returns array',           Array.isArray(listed));
assert('listSkills has name/type/desc',      listed[0].name && listed[0].type && listed[0].description);

// ─────────────────────────────────────────────
console.log('\n🎯 3. Matcher — Skill Matching');
// ─────────────────────────────────────────────

// Test normalise
assert('normalise lowercases',           normalise('HELLO World') === 'hello world');
assert('normalise trims whitespace',     normalise('  hi  ') === 'hi');

// Test direct keyword matching
const skills = sm.getAllSkills();

const r1 = findBestSkill('Can you show me how to differentiate x squared?', skills);
assert('Matches hsc-worked-example for "show me how"',  r1.skill?.name === 'hsc-worked-example');
assert('Score > 0',                                      r1.score > 0);

const r2 = findBestSkill('I got this wrong, where did I go wrong?', skills);
assert('Matches error-analysis for "wrong"',             r2.skill?.name === 'error-analysis');

const r3 = findBestSkill('I am so frustrated, I give up on calculus', skills);
assert('Matches emotional-support for "frustrated"',     r3.skill?.name === 'emotional-support');

const r4 = findBestSkill('Can you give me a hint without telling me the answer?', skills);
assert('Matches socratic-questioning for "hint"',        r4.skill?.name === 'socratic-questioning');

const r5 = findBestSkill('Can you test me on integration?', skills);
assert('Matches generate-quiz for "test me"',            r5.skill?.name === 'generate-quiz');

const r6 = findBestSkill('I want to do a past paper question', skills);
assert('Matches past-paper-practice for "past paper"',   r6.skill?.name === 'past-paper-practice');

const r7 = findBestSkill('How many marks would I get for this answer?', skills);
assert('Matches marking-guideline-feedback for "marks"', r7.skill?.name === 'marking-guideline-feedback');

const r8 = findBestSkill('Which topic does this question belong to?', skills);
assert('Matches identify-syllabus-topic for "which topic"', r8.skill?.name === 'identify-syllabus-topic');

// Fallback test
const r9 = findBestSkill('Hello there, how are you today?', skills);
assert('Falls back to general-conversation',             r9.skill?.name === 'general-conversation');
assert('Fallback matchedBy = fallback',                  r9.matchedBy === 'fallback');

// Top matches
const top = getTopMatches('show me how to solve this step by step', skills, 3);
assert('getTopMatches returns array',                    Array.isArray(top));
assert('Top match includes hsc-worked-example',          top[0]?.name === 'hsc-worked-example');

// Passive skills not matched by findBestSkill
const detectStyle = sm.getSkill('detect-learning-style');
const score = scoreSkill(detectStyle, 'show me how to differentiate');
assert('Passive skills score 0 (no keywords)',           score === 0);

// ─────────────────────────────────────────────
console.log('\n⚡ 4. Skill Execution');
// ─────────────────────────────────────────────

const mockContext = {
  studentId:    'test-student',
  memory:       {},
  studentModel: {},
  model:        {},
  knowledgeBase: {},
};

// Execute a known active skill
async function runTests() {
  const result1 = await sm.executeSkill('hsc-worked-example', { userInput: 'differentiate x^3' }, mockContext);
  assert('executeSkill returns result',           result1.result !== undefined);
  assert('executeSkill attaches _skillName',      result1._skillName === 'hsc-worked-example');
  assert('executeSkill result contains input',    result1.result.includes('differentiate x^3'));

  // Execute throws for unknown skill
  let threwOnUnknown = false;
  try { await sm.executeSkill('nonexistent-skill', {}, mockContext); } catch { threwOnUnknown = true; }
  assert('executeSkill throws for unknown skill', threwOnUnknown);

  // ─────────────────────────────────────────────
  console.log('\n🔇 5. Passive Skill Execution');
  // ─────────────────────────────────────────────

  const passiveUpdates = await sm.executePassiveSkills(
    { userInput: 'test interaction', response: 'test response' },
    mockContext
  );
  assert('executePassiveSkills returns array',    Array.isArray(passiveUpdates));
  assert('Returns 4 passive skill results',       passiveUpdates.length === 4);
  assert('Each result has skillName',             passiveUpdates[0].skillName !== undefined);
  assert('Each result has memoryUpdates',         passiveUpdates[0].memoryUpdates !== undefined);

  // Verify passive skills don't crash main flow even if one throws
  const smWithBrokenPassive = new SkillManager(TEST_SKILLS_DIR);
  smWithBrokenPassive.load();
  // Override one passive skill's execute to throw
  const brokenSkill = smWithBrokenPassive.getSkill('detect-learning-style');
  brokenSkill.module.execute = async () => { throw new Error('Simulated passive failure'); };
  let crashedOnPassiveError = false;
  try {
    await smWithBrokenPassive.executePassiveSkills({}, mockContext);
  } catch {
    crashedOnPassiveError = true;
  }
  assert('Passive skill error does NOT crash execution', !crashedOnPassiveError);

  // ─────────────────────────────────────────────
  console.log('\n🔗 6. matchAndExecute (full pipeline)');
  // ─────────────────────────────────────────────

  const r = await sm.matchAndExecute(
    'I got the wrong answer, what did I do wrong?',
    { extra: 'data' },
    mockContext
  );
  assert('matchAndExecute returns skillName',     r.skillName === 'error-analysis');
  assert('matchAndExecute returns score',         r.matchScore > 0);
  assert('matchAndExecute returns result object', r.result !== undefined);

  const rFallback = await sm.matchAndExecute('hello!', {}, mockContext);
  assert('matchAndExecute uses fallback skill',   rFallback.skillName === 'general-conversation');

  // ─────────────────────────────────────────────
  console.log('\n🔄 7. Reload');
  // ─────────────────────────────────────────────

  sm.reload();
  assert('reload() reloads skills successfully',  sm.getAllSkills().length === 13);

  // ─────────────────────────────────────────────
  console.log('\n─────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('✅ All tests passed — Skill Manager is ready.\n');
  } else {
    console.log('❌ Some tests failed — please review above.\n');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});