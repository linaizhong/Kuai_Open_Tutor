// TeacherModeHeader.js
// Teacher mode header component matching the design preview
//
// MODIFIED: Added teaching phase display and auto-advance indicator

import React from 'react';

function TeacherModeHeader({
  phase = 'teaching',
  subPhase = 'introduction', // NEW: sub-phase (introduction/explanation/checking/practice/feedback)
  progress = 25,
  topic = 'Calculus',
  duration = '45min',
  onResume,
  canResume = false,
  autoAdvance = false, // NEW: whether lesson is auto-advancing
  nextPhase = null,    // NEW: next phase after auto-advance
}) {
  const phaseConfig = {
    teaching: { label: 'Teaching Phase', color: 'var(--accent)' },
    practicing: { label: 'Practice Phase', color: 'var(--teal)' },
    assessing: { label: 'Assessment Phase', color: 'var(--success)' },
    interrupted: { label: 'Interrupted', color: 'var(--warning)' }
  };

  // ===== NEW: Sub-phase configuration =====
  const subPhaseConfig = {
    introduction: { label: 'Introduction', icon: '📖', description: 'Introducing the topic' },
    explanation: { label: 'Explaining', icon: '📚', description: 'Explaining key concepts' },
    checking: { label: 'Checking Understanding', icon: '❓', description: 'Asking questions' },
    practice: { label: 'Practice', icon: '✏️', description: 'Working on exercises' },
    feedback: { label: 'Feedback', icon: '💬', description: 'Providing feedback' }
  };

  const config = phaseConfig[phase] || phaseConfig.teaching;
  const subConfig = subPhaseConfig[subPhase] || null;

  // ===== NEW: Auto-advance indicator =====
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
      {/* Left side: Teacher info and topic */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>👩‍🏫</span>
          <span style={{
            fontWeight: 600,
            fontSize: '0.95rem',
            color: 'var(--text-primary)',
          }}>AI Teacher</span>
        </div>

        <div style={{
          width: '1px',
          height: '24px',
          background: 'var(--border)',
        }} />

        <div style={{
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
        }}>
          {topic} · {duration}
        </div>
      </div>

      {/* Center: Phase indicator, sub-phase, and progress bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flex: 1,
        maxWidth: '600px',
        flexWrap: 'wrap',
      }}>
        {/* Main phase badge */}
        <div style={{
          padding: '4px 12px',
          background: `${config.color}15`,
          borderRadius: 'var(--radius-full)',
          color: config.color,
          fontSize: '0.8rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          {config.label}
        </div>

        {/* ===== NEW: Sub-phase badge ===== */}
        {subConfig && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              background: `${config.color}10`,
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              whiteSpace: 'nowrap',
            }}>
              <span>{subConfig.icon}</span>
              <span>{subConfig.label}</span>
              {subConfig.description && (
                <span style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginLeft: '4px',
                }}>
                  · {subConfig.description}
                </span>
              )}
            </div>
          </>
        )}

        {/* Progress bar */}
        <div style={{
          flex: 1,
          minWidth: '120px',
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
            {progress}%
          </span>
        </div>

        {/* ===== NEW: Auto-advance indicator ===== */}
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
          Resume Lesson
        </button>
      )}
    </div>
  );
}

export default TeacherModeHeader;