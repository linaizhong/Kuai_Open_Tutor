// Model Manager — Test Suite
// Tests all logic that does NOT require a live model connection.
// Run with: node test-model-manager.js
//
// To test live Ollama: node test-model-manager.js --live

const path = require('path');
const fs   = require('fs');

const ModelManager = require('../../src/main/model-manager/index');
const registry     = require('../../src/main/model-manager/registry');
const Config       = require('../../src/main/model-manager/config');
const Stats        = require('../../src/main/model-manager/stats');

const TEST_DATA_ROOT = path.join(__dirname, 'test-data-mm');
const LIVE = process.argv.includes('--live');

// Cleanup
if (fs.existsSync(TEST_DATA_ROOT)) fs.rmSync(TEST_DATA_ROOT, { recursive: true });

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ ${label}`); failed++; }
}

// ─────────────────────────────────────────────
console.log('\n📋 1. Registry');
// ─────────────────────────────────────────────

const local = registry.getLocalModels();
const cloud = registry.getCloudModels();
assert('Local models loaded',            local.length > 0);
assert('Cloud models loaded',            cloud.length > 0);
assert('qwen2.5-coder:3b in local',      local.some(m => m.id === 'qwen2.5-coder:3b'));
assert('deepseek-chat in cloud',         cloud.some(m => m.id === 'deepseek-chat'));
assert('claude-haiku in cloud',          cloud.some(m => m.id === 'claude-haiku-4-5-20251001'));

const found = registry.findModel('qwen2.5-coder:3b');
assert('findModel returns correct entry',  found?.adapter === 'ollama');

const notFound = registry.findModel('nonexistent-model');
assert('findModel returns null for unknown', notFound === null);

assert('Recommended local model is qwen2.5-coder:3b',
  registry.getRecommendedLocalModel() === 'qwen2.5-coder:3b');

// ─────────────────────────────────────────────
console.log('\n⚙️  2. Config');
// ─────────────────────────────────────────────

const cfgPath = path.join(TEST_DATA_ROOT, 'config', 'user-config.json');
const cfg = new Config(cfgPath);

assert('Config created with defaults',       fs.existsSync(cfgPath));
assert('Default model is qwen2.5-coder:3b',  cfg.getActiveModelId() === 'qwen2.5-coder:3b');
assert('Default API keys are empty strings', cfg.getApiKey('deepseek') === '');

cfg.setActiveModelId('deepseek-chat');
assert('setActiveModelId persists',          cfg.getActiveModelId() === 'deepseek-chat');

cfg.setApiKey('deepseek', 'sk-test-12345');
assert('setApiKey persists',                 cfg.getApiKey('deepseek') === 'sk-test-12345');

cfg.setActiveModelId('qwen2.5-coder:3b');  // reset

const ollamaCfg = cfg.getOllamaConfig();
assert('Ollama config has host',             ollamaCfg.host === 'localhost');
assert('Ollama config has port',             ollamaCfg.port === 11434);

// ─────────────────────────────────────────────
console.log('\n📊 3. Stats');
// ─────────────────────────────────────────────

const statsPath = path.join(TEST_DATA_ROOT, 'config', 'model-stats.json');
const stats = new Stats(statsPath);

assert('Stats file created',  fs.existsSync(statsPath));

stats.record({ modelId: 'qwen2.5-coder:3b', success: true,  timeMs: 1200, skillName: 'hsc-worked-example', studentId: 'default' });
stats.record({ modelId: 'qwen2.5-coder:3b', success: true,  timeMs: 980,  skillName: 'error-analysis',     studentId: 'default' });
stats.record({ modelId: 'qwen2.5-coder:3b', success: false, timeMs: 100,  errorMessage: 'timeout',         studentId: 'default' });
stats.record({ modelId: 'deepseek-chat',    success: true,  timeMs: 3200, skillName: 'past-paper-practice', studentId: 'default' });

const summary = stats.getSummary();
assert('Total calls = 4',                   summary.totalCalls === 4);
assert('Success rate = 0.75',               summary.successRate === 0.75);
assert('byModel has qwen2.5-coder:3b',      'qwen2.5-coder:3b' in summary.byModel);
assert('byModel has deepseek-chat',         'deepseek-chat' in summary.byModel);
assert('qwen avg latency calculated',       summary.byModel['qwen2.5-coder:3b'].avgLatencyMs === 1090);
assert('lastCall is set',                   summary.lastCall !== null);

stats.clear();
assert('Clear resets total calls to 0',     stats.getSummary().totalCalls === 0);

// ─────────────────────────────────────────────
console.log('\n🤖 4. ModelManager (offline)');
// ─────────────────────────────────────────────

const mm = new ModelManager(TEST_DATA_ROOT);

const models = mm.listModels();
assert('listModels returns local',          models.local.length > 0);
assert('listModels returns cloud',          models.cloud.length > 0);
assert('listModels shows active model',     models.activeModelId === 'qwen2.5-coder:3b');

mm.switchModel('deepseek-chat');
assert('switchModel updates active model',  mm.config.getActiveModelId() === 'deepseek-chat');
assert('getActiveModel returns deepseek',   mm.getActiveModel()?.id === 'deepseek-chat');
mm.switchModel('qwen2.5-coder:3b');  // reset

mm.setApiKey('openai', 'sk-test-openai');
assert('setApiKey saves correctly',         mm.config.getApiKey('openai') === 'sk-test-openai');

const displayCfg = mm.getConfigForDisplay();
assert('Display config masks API keys',     displayCfg.apiKeys.openai.endsWith('...'));

let threwOnUnknownModel = false;
try { mm.switchModel('made-up-model-xyz'); } catch { threwOnUnknownModel = true; }
assert('switchModel throws on unknown model', threwOnUnknownModel);

// ─────────────────────────────────────────────
console.log('\n🔌 5. Adapter instantiation');
// ─────────────────────────────────────────────

const OllamaAdapter   = require('../../src/main/model-manager/adapters/ollama');
const DeepSeekAdapter = require('../../src/main/model-manager/adapters/deepseek');
const ClaudeAdapter   = require('../../src/main/model-manager/adapters/claude');
const OpenAIAdapter   = require('../../src/main/model-manager/adapters/openai');
const QwenAdapter     = require('../../src/main/model-manager/adapters/qwen');

const ollamaAdapter = registry.createAdapter('qwen2.5-coder:3b', { host: 'localhost', port: 11434 });
assert('Ollama adapter created correctly',   ollamaAdapter instanceof OllamaAdapter);
assert('Ollama adapter type = ollama',       ollamaAdapter.getType() === 'ollama');

const deepseekAdapter = registry.createAdapter('deepseek-chat', { apiKey: 'sk-test' });
assert('DeepSeek adapter created correctly', deepseekAdapter instanceof DeepSeekAdapter);
assert('DeepSeek adapter type = deepseek',   deepseekAdapter.getType() === 'deepseek');

const claudeAdapter = registry.createAdapter('claude-haiku-4-5-20251001', { apiKey: 'sk-test' });
assert('Claude adapter created correctly',   claudeAdapter instanceof ClaudeAdapter);
assert('Claude adapter type = claude',       claudeAdapter.getType() === 'claude');

let threwOnAbstract = false;
const BaseAdapter = require('./adapters/base');
try { new BaseAdapter('test'); } catch { threwOnAbstract = true; }
assert('BaseAdapter throws when instantiated directly', threwOnAbstract);

// ─────────────────────────────────────────────
if (LIVE) {
  console.log('\n🌐 6. Live Ollama test (--live flag)');
  console.log('   Testing qwen2.5-coder:3b via Ollama...');
  mm.testActiveModel().then(result => {
    assert(`Live test success: ${result.message}`, result.success);
    assert('Response time recorded', result.timeMs > 0);
    printResults();
  }).catch(err => {
    console.error(`  ❌ Live test error: ${err.message}`);
    failed++;
    printResults();
  });
} else {
  console.log('\n  ℹ️  Skipping live Ollama test. Run with --live to test real model.');
  printResults();
}

function printResults() {
  // Cleanup
  if (fs.existsSync(TEST_DATA_ROOT)) fs.rmSync(TEST_DATA_ROOT, { recursive: true });

  console.log('\n─────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('✅ All tests passed — Model Manager is ready.\n');
  } else {
    console.log('❌ Some tests failed — please review above.\n');
    process.exit(1);
  }
}