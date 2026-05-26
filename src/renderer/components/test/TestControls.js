// renderer/components/test/TestControls.js
// Navigation controls for tests (Next, Previous, Flag, etc.)

import React from 'react';

function TestControls({
  currentIndex,
  totalQuestions,
  onNext,
  onPrevious,
  onFlag,
  onReview,
  isFlagged = false,
  disabled = false,
  className = ''
}) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalQuestions - 1;

  return (
    <div className={`test-controls ${className}`} style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 0',
      borderTop: '1px solid var(--border)',
      marginTop: '16px',
    }}>
      {/* Left side - Navigation */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onPrevious}
          disabled={isFirst || disabled}
          style={{
            padding: '8px 16px',
            background: isFirst ? 'var(--bg-elevated)' : 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: isFirst ? 'var(--text-muted)' : 'var(--text-secondary)',
            fontSize: '0.85rem',
            cursor: isFirst || disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            opacity: isFirst ? 0.6 : 1,
          }}
          onMouseEnter={e => {
            if (!isFirst && !disabled) {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.borderColor = 'var(--border-bright)';
            }
          }}
          onMouseLeave={e => {
            if (!isFirst && !disabled) {
              e.currentTarget.style.background = 'var(--bg-surface)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }
          }}
        >
          <span>←</span> Previous
        </button>

        <button
          onClick={onNext}
          disabled={isLast || disabled}
          style={{
            padding: '8px 16px',
            background: isLast ? 'var(--bg-elevated)' : 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: isLast ? 'var(--text-muted)' : 'var(--text-secondary)',
            fontSize: '0.85rem',
            cursor: isLast || disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            opacity: isLast ? 0.6 : 1,
          }}
          onMouseEnter={e => {
            if (!isLast && !disabled) {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.borderColor = 'var(--border-bright)';
            }
          }}
          onMouseLeave={e => {
            if (!isLast && !disabled) {
              e.currentTarget.style.background = 'var(--bg-surface)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }
          }}
        >
          Next <span>→</span>
        </button>
      </div>

      {/* Center - Question indicator */}
      <div style={{
        fontSize: '0.85rem',
        color: 'var(--text-muted)',
        background: 'var(--bg-elevated)',
        padding: '4px 12px',
        borderRadius: 'var(--radius-full)',
      }}>
        {currentIndex + 1} / {totalQuestions}
      </div>

      {/* Right side - Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onFlag}
          disabled={disabled}
          style={{
            padding: '8px 16px',
            background: isFlagged ? 'var(--warning-soft)' : 'var(--bg-surface)',
            border: `1px solid ${isFlagged ? 'var(--warning)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            color: isFlagged ? 'var(--warning)' : 'var(--text-secondary)',
            fontSize: '0.85rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          onMouseEnter={e => {
            if (!disabled) {
              e.currentTarget.style.background = isFlagged ? 'var(--warning-soft)' : 'var(--bg-hover)';
              e.currentTarget.style.borderColor = isFlagged ? 'var(--warning)' : 'var(--border-bright)';
            }
          }}
          onMouseLeave={e => {
            if (!disabled) {
              e.currentTarget.style.background = isFlagged ? 'var(--warning-soft)' : 'var(--bg-surface)';
              e.currentTarget.style.borderColor = isFlagged ? 'var(--warning)' : 'var(--border)';
            }
          }}
        >
          <span>{isFlagged ? '🏁' : '🚩'}</span>
          {isFlagged ? 'Flagged' : 'Flag'}
        </button>

        <button
          onClick={onReview}
          disabled={disabled}
          style={{
            padding: '8px 16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          onMouseEnter={e => {
            if (!disabled) {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.borderColor = 'var(--border-bright)';
            }
          }}
          onMouseLeave={e => {
            if (!disabled) {
              e.currentTarget.style.background = 'var(--bg-surface)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }
          }}
        >
          <span>📋</span> Review
        </button>
      </div>
    </div>
  );
}

export default TestControls;