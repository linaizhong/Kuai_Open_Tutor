// TeacherModeIndicators.js
// UI components specific to Teacher-Led mode
// Shows teaching phase, progress, interruption controls, and content generation indicators
//
// MODIFIED: Added ContentGenerationIndicator component for dynamic content generation feedback
// MODIFIED: Added teaching phase timeline and lesson progress indicators

import React from 'react';

// ── Teaching phase indicator ─────────────────────────────────
export function TeachingPhaseIndicator({ phase, progress, className = '' }) {
  const phaseConfig = {
    teaching: {
      label: 'Teaching',
      icon: '📚',
      color: 'var(--accent)',
      next: 'Practice'
    },
    practicing: {
      label: 'Practice',
      icon: '✏️',
      color: 'var(--teal)',
      next: 'Assessment'
    },
    assessing: {
      label: 'Assessment',
      icon: '📝',
      color: 'var(--success)',
      next: 'Complete'
    },
    interrupted: {
      label: 'Interrupted',
      icon: '⏸️',
      color: 'var(--warning)',
      next: 'Resume'
    }
  };

  const config = phaseConfig[phase] || phaseConfig.teaching;

  return (
    <div className={`teaching-phase-indicator ${className}`} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-full)',
      padding: '4px 12px 4px 8px',
      fontSize: '0.75rem',
    }}>
      <span style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: `${config.color}20`,
        color: config.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.7rem',
      }}>
        {config.icon}
      </span>
      <span style={{ fontWeight: 600, color: config.color }}>
        {config.label}
      </span>
      {progress !== undefined && (
        <>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {Math.round(progress)}%
          </span>
        </>
      )}
    </div>
  );
}

// ── Phase progress bar ──────────────────────────────────────
export function PhaseProgressBar({ progress, phase, className = '' }) {
  const phaseColors = {
    teaching: 'var(--accent)',
    practicing: 'var(--teal)',
    assessing: 'var(--success)',
    interrupted: 'var(--warning)'
  };

  const color = phaseColors[phase] || 'var(--accent)';

  return (
    <div className={`phase-progress ${className}`} style={{
      width: '100%',
      height: '4px',
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-full)',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${progress}%`,
        height: '100%',
        background: `linear-gradient(90deg, ${color}, ${color}dd)`,
        borderRadius: 'var(--radius-full)',
        transition: 'width 0.3s ease',
      }} />
    </div>
  );
}

// ── Resume lesson button ────────────────────────────────────
export function ResumeButton({ onClick, className = '' }) {
  return (
    <button
      className={`btn btn-primary ${className}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        fontSize: '0.8rem',
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent)',
        color: 'var(--accent)',
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
      <span>↺</span>
      Resume Lesson
    </button>
  );
}

// ── Homework indicator ──────────────────────────────────────
export function HomeworkIndicator({ homework, onView, className = '' }) {
  if (!homework || !homework.exercises || homework.exercises.length === 0) {
    return null;
  }

  return (
    <div className={`homework-indicator ${className}`} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-full)',
      padding: '4px 12px',
      fontSize: '0.75rem',
    }}>
      <span style={{ color: 'var(--warning)' }}>📋</span>
      <span style={{ color: 'var(--text-secondary)' }}>
        {homework.exercises.length} homework {homework.exercises.length === 1 ? 'exercise' : 'exercises'}
      </span>
      <button
        onClick={onView}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontSize: '0.7rem',
          cursor: 'pointer',
          textDecoration: 'underline',
          padding: '2px 4px',
        }}
      >
        View
      </button>
    </div>
  );
}

// ── Next topic suggestion ────────────────────────────────────
export function NextTopicSuggestion({ topic, onAccept, className = '' }) {
  if (!topic) return null;

  return (
    <div className={`next-topic-suggestion ${className}`} style={{
      padding: '12px 16px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
    }}>
      <div>
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '4px',
        }}>
          Next Topic Suggestion
        </div>
        <div style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          {topic}
        </div>
      </div>
      <button
        className="btn btn-sm btn-primary"
        onClick={onAccept}
        style={{ whiteSpace: 'nowrap' }}
      >
        Start Learning
      </button>
    </div>
  );
}

// ============================================================
// NEW: Teaching Phase Timeline Component
// ============================================================

/**
 * TeachingPhaseTimeline - Shows the sequence of teaching phases
 *
 * @param {object} props
 * @param {string} props.currentPhase - Current phase
 * @param {string} props.currentSubPhase - Current sub-phase
 * @param {Array} props.phases - List of phases to display
 * @param {string} props.className - Optional CSS class
 */
export function TeachingPhaseTimeline({
  currentPhase,
  currentSubPhase,
  phases = ['introduction', 'explanation', 'checking', 'practice', 'feedback'],
  className = ''
}) {
  const phaseConfig = {
    introduction: { label: 'Introduction', icon: '📖', color: 'var(--accent)' },
    explanation: { label: 'Explanation', icon: '📚', color: 'var(--teal)' },
    checking: { label: 'Check', icon: '❓', color: 'var(--topic-c)' },
    practice: { label: 'Practice', icon: '✏️', color: 'var(--success)' },
    feedback: { label: 'Feedback', icon: '💬', color: 'var(--topic-s)' }
  };

  const getPhaseStatus = (phase) => {
    const phaseIndex = phases.indexOf(phase);
    const currentIndex = phases.indexOf(currentSubPhase || currentPhase);

    if (phaseIndex < currentIndex) return 'completed';
    if (phaseIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className={`teaching-phase-timeline ${className}`} style={{
      padding: '12px 20px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      marginBottom: '8px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '4px',
        marginBottom: '8px',
        padding: '0 4px',
      }}>
        {phases.map((phase, index) => {
          const config = phaseConfig[phase] || { icon: '📌', label: phase, color: 'var(--text-muted)' };
          const status = getPhaseStatus(phase);

          return (
            <React.Fragment key={phase}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                background: status === 'active'
                  ? `${config.color}20`
                  : status === 'completed'
                    ? 'var(--success-soft)'
                    : 'var(--bg-elevated)',
                color: status === 'active'
                  ? config.color
                  : status === 'completed'
                    ? 'var(--success)'
                    : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: status === 'active' ? 600 : 400,
                transition: 'all 0.3s ease',
                flex: 1,
                justifyContent: 'center',
                border: status === 'active' ? `1px solid ${config.color}` : '1px solid transparent',
              }}>
                <span style={{ fontSize: '0.9rem' }}>{config.icon}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{config.label}</span>
                {status === 'completed' && (
                  <span style={{ marginLeft: '4px', fontSize: '0.8rem' }}>✓</span>
                )}
              </div>
              {index < phases.length - 1 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {currentSubPhase ? `${currentSubPhase} phase` : `${currentPhase} phase`}
      </div>
    </div>
  );
}

// ============================================================
// NEW: Lesson Progress Component
// ============================================================

/**
 * LessonProgress - Shows progress through the current lesson
 *
 * @param {object} props
 * @param {number} props.currentStep - Current step number
 * @param {number} props.totalSteps - Total steps in lesson
 * @param {string} props.stepName - Name of current step
 * @param {number} props.progress - Progress percentage
 * @param {string} props.className - Optional CSS class
 */
export function LessonProgress({
  currentStep,
  totalSteps,
  stepName,
  progress,
  className = ''
}) {
  return (
    <div className={`lesson-progress ${className}`} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '8px 16px',
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-md)',
      margin: '8px 0',
    }}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
      }}>
        Step {currentStep} of {totalSteps}
      </div>

      <div style={{
        fontSize: '0.85rem',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        flex: 1,
      }}>
        {stepName}
      </div>

      <div style={{
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          gap: '4px',
        }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: i < currentStep
                  ? 'var(--accent)'
                  : i === currentStep - 1
                    ? 'var(--accent)'
                    : 'var(--bg-hover)',
                opacity: i < currentStep ? 0.7 : 1,
                transform: i === currentStep - 1 ? 'scale(1.3)' : 'scale(1)',
                boxShadow: i === currentStep - 1 ? '0 0 10px var(--accent-glow)' : 'none',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
        {progress !== undefined && (
          <span style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            minWidth: '45px',
            textAlign: 'right',
          }}>
            {Math.round(progress)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ── Teacher mode header (existing) ───────────────────────────
export function TeacherModeHeader({ phase, progress, topic, onResume, className = '' }) {
  return (
    <div className={`teacher-mode-header ${className}`} style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      flexWrap: 'wrap',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <TeachingPhaseIndicator phase={phase} progress={progress} />
        {topic && (
          <div style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span>📌</span>
            <span>{topic}</span>
          </div>
        )}
        <PhaseProgressBar progress={progress} phase={phase} style={{ width: '120px' }} />
      </div>

      {phase === 'interrupted' && (
        <ResumeButton onClick={onResume} />
      )}
    </div>
  );
}

// ============================================================
// Content Generation Indicator Component (existing)
// ============================================================

/**
 * ContentGenerationIndicator - Shows progress of dynamic content generation
 * Used when the system is generating explanations, questions, or feedback
 *
 * @param {object} props
 * @param {string} props.stage - Generation stage: 'explanation' | 'questions' | 'examples' | 'feedback' | 'evaluation'
 * @param {number} props.progress - Progress percentage (0-100)
 * @param {string} props.message - Optional status message
 * @param {string} props.className - Optional CSS class
 */
export function ContentGenerationIndicator({ stage, progress, message, className = '' }) {
  // Stage-specific configuration
  const stageConfig = {
    explanation: {
      icon: '📝',
      label: 'Generating explanation',
      color: 'var(--accent)',
      message: 'Creating a clear explanation...'
    },
    questions: {
      icon: '❓',
      label: 'Creating questions',
      color: 'var(--teal)',
      message: 'Preparing practice questions...'
    },
    examples: {
      icon: '📐',
      label: 'Creating examples',
      color: 'var(--topic-c)',
      message: 'Working through examples...'
    },
    feedback: {
      icon: '💬',
      label: 'Preparing feedback',
      color: 'var(--success)',
      message: 'Analyzing your response...'
    },
    evaluation: {
      icon: '📊',
      label: 'Evaluating answer',
      color: 'var(--topic-s)',
      message: 'Assessing your work...'
    },
    preparing: {
      icon: '✨',
      label: 'Preparing content',
      color: 'var(--text-muted)',
      message: 'Getting ready...'
    }
  };

  const config = stageConfig[stage] || stageConfig.preparing;
  const displayMessage = message || config.message;

  return (
    <div className={`content-generation-indicator ${className}`} style={{
      padding: '16px 20px',
      margin: '8px 16px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      animation: 'slideDown 0.3s ease',
    }}>
      {/* Header with icon and stage */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: `${config.color}20`,
          color: config.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.1rem',
        }}>
          {config.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 600,
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
          }}>
            {config.label}
          </div>
          {displayMessage && (
            <div style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginTop: '2px',
            }}>
              {displayMessage}
            </div>
          )}
        </div>
        {progress !== undefined && (
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: config.color,
            background: `${config.color}15`,
            padding: '4px 8px',
            borderRadius: 'var(--radius-full)',
          }}>
            {Math.round(progress)}%
          </div>
        )}
      </div>

      {/* Progress bar */}
      {progress !== undefined && (
        <div style={{
          width: '100%',
          height: '4px',
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
      )}

      {/* Animated dots for indeterminate progress */}
      {progress === undefined && (
        <div style={{
          display: 'flex',
          gap: '4px',
          marginTop: '8px',
        }}>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      )}
    </div>
  );
}

// ── Export all components ───────────────────────────────────
// Note: All components are already exported individually above
// This comment is for clarity