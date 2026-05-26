// constants/test-modes.js
// Test mode constants for consistent reference across components

export const TEST_TYPES = {
  DIAGNOSTIC: 'diagnostic',
  TOPIC: 'topic',
  MIXED: 'mixed',
  MASTERY: 'mastery'
};

export const TEST_PHASES = {
  NOT_STARTED: 'not_started',
  TESTING: 'testing',
  DIAGNOSIS: 'diagnosis',
  REMEDIATION: 'remediation',
  VERIFICATION: 'verification',
  COMPLETE: 'complete',
  INTERRUPTED: 'interrupted'
};

export const TEST_SUB_PHASES = {
  // Testing sub-phases
  DIAGNOSTIC: 'diagnostic',
  TOPIC: 'topic',
  MIXED: 'mixed',
  MASTERY: 'mastery',

  // Diagnosis sub-phases
  ANALYZING: 'analyzing',
  REVIEW: 'review',

  // Remediation sub-phases
  PREPARING: 'preparing',
  SWITCHING: 'switching',
  REPEAT: 'repeat',

  // Verification sub-phases
  PREPARING_VERIFY: 'preparing',
  TESTING_VERIFY: 'testing'
};

export const ERROR_TYPES = {
  CONCEPTUAL: 'Conceptual',
  COMPUTATIONAL: 'Computational',
  MISREAD: 'Misread',
  SKIPPED: 'skipped',
  UNKNOWN: 'unknown'
};

export const MASTERY_THRESHOLDS = {
  MASTERED: 80,    // 80%+ = mastered
  CONCERN: 60,     // 60-79% = needs attention
  CRITICAL: 40     // Below 40% = critical
};

export const TEST_COMMANDS = {
  START_DIAGNOSTIC: '__START_DIAGNOSTIC__',
  START_TOPIC: '__START_TOPIC_TEST__',
  START_MIXED: '__START_MIXED_TEST__',
  START_MASTERY: '__START_MASTERY_CHECK__',
  START_TEST: '__START_TEST__',
  AUTO_ADVANCE: '__AUTO_ADVANCE__',
  SKIP: 'skip',
  HINT: 'hint',
  RESULTS: 'results',
  REVIEW: 'review',
  REMEDIATE: 'remediate',
  RETAKE: 'retest',
  MASTERY_CHECK: 'mastery'
};