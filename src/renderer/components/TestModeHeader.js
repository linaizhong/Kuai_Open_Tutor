// TestModeHeader.js (updated with timer support)
// Test mode header component matching the design preview
//
// MODIFIED: Added timer display and question counter

import React from 'react';
import TestTimer from './test/TestTimer'; // Import the timer component

function TestModeHeader({
  phase = 'testing',
  subPhase = 'diagnostic',
  progress = 25,
  testType = 'diagnostic',
  score = null,
  currentQuestion = null,
  timeRemaining = null,
  onTimeUp,
  onResume,
  canResume = false,
  autoAdvance = false,
  nextPhase = null,
}) {
  // Phase configuration for display
  const phaseConfig = {
    testing: {
      label: 'Testing',
      color: 'var(--accent)',
      icon: '📝'
    },
    diagnosis: {
      label: 'Diagnosis',
      color: 'var(--teal)',
      icon: '🔍'
    },
    remediation: {
      label: 'Remediation',
      color: 'var(--topic-c)',
      icon: '📚'
    },
    verification: {
      label: 'Verification',
      color: 'var(--success)',
      icon: '✅'
    },
    complete: {
      label: 'Complete',
      color: 'var(--text-muted)',
      icon: '🏁'
    },
    interrupted: {
      label: 'Interrupted',
      color: 'var(--warning)',
      icon: '⏸️'
    }
  };

  // Test type configuration
  const testTypeConfig = {
    diagnostic: {
      label: 'Diagnostic',
      icon: '📊',
      description: 'Broad assessment'
    },
    topic: {
      label: 'Topic Test',
      icon: '🎯',
      description: 'Focused on specific topics'
    },
    mixed: {
      label: 'Mixed Test',
      icon: '🔄',
      description: 'Multiple topics'
    },
    mastery: {
      label: 'Mastery Check',
      icon: '✅',
      description: 'Verifying understanding'
    }
  };

  const config = phaseConfig[phase] || phaseConfig.testing;
  const testConfig = testTypeConfig[subPhase] || testTypeConfig[testType] || {
    label: testType,
    icon: '📝',
    description: ''
  };

  // Score color based on percentage
  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--error)';
  };

  // Auto-advance indicator component
  const AutoAdvanceIndicator = () => (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      background: 'var(--accent-soft)',
      border: '1px solid var(--accent)',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.75rem',
      color: 'var(--accent)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      <span className="spinner-sm" style={{
        borderTopColor: 'var(--accent)',
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: 'transparent',
      }} />
      <span>Auto-advancing {nextPhase ? `to ${nextPhase}` : ''}...</span>
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 20px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      flexWrap: 'wrap',
      gap: '12px',
    }}>
      {/* Left side: Test info and type */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>{testConfig.icon}</span>
          <span style={{
            fontWeight: 600,
            fontSize: '0.95rem',
            color: 'var(--text-primary)',
          }}>{testConfig.label} Test</span>
        </div>

        <div style={{
          width: '1px',
          height: '24px',
          background: 'var(--border)',
        }} />

        <div style={{
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </span>

          {score !== null && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{
                color: getScoreColor(score),
                fontWeight: 600
              }}>
                {Math.round(score)}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* Center: Progress, timer, and question counter */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flex: 1,
        maxWidth: '800px',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {/* Phase badge */}
        <div style={{
          padding: '4px 12px',
          background: `${config.color}15`,
          borderRadius: 'var(--radius-full)',
          color: config.color,
          fontSize: '0.8rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span>{config.icon}</span>
          <span>{config.label}</span>
        </div>

        {/* Timer - NEW */}
        {timeRemaining !== null && phase === 'testing' && (
          <TestTimer
            initialSeconds={timeRemaining}
            onTimeUp={onTimeUp}
            warningThreshold={60}
            criticalThreshold={30}
          />
        )}

        {/* Question counter */}
        {currentQuestion && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: '0.9rem' }}>❓</span>
            <span>Q{currentQuestion.index} of {currentQuestion.total}</span>
          </div>
        )}

        {/* Progress bar */}
        <div style={{
          flex: 1,
          minWidth: '150px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            flex: 1,
            height: '8px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${config.color}, ${config.color}dd)`,
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            minWidth: '45px',
          }}>
            {Math.round(progress)}%
          </span>
        </div>

        {/* Auto-advance indicator */}
        {autoAdvance && <AutoAdvanceIndicator />}
      </div>

      {/* Right side: Resume button if interrupted */}
      {canResume && (
        <button
          onClick={onResume}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--accent)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--accent)';
            e.currentTarget.style.color = '#0d1117';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--accent-soft)';
            e.currentTarget.style.color = 'var(--accent)';
          }}
        >
          <span style={{ fontSize: '1rem' }}>↺</span>
          Resume Test
        </button>
      )}
    </div>
  );
}

export default TestModeHeader;