// renderer/components/test/AnswerInput.js
// Enhanced answer input component for Test-Led mode
// Supports multiple input modes: plain text, working area, multiple choice
//
// Features:
// - Expandable text area for showing work
// - Multiple choice option buttons
// - Hint button integration
// - Submit with Enter or button

import React, { useState, useRef, useEffect } from 'react';

function AnswerInput({
  question,
  onSubmit,
  onHint,
  showHint = true,
  placeholder = "Type your answer here...",
  disabled = false,
  className = ''
}) {
  const [answer, setAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWorking, setShowWorking] = useState(false);
  const [working, setWorking] = useState('');
  const textareaRef = useRef(null);

  // Determine if this is a multiple choice question
  const isMultipleChoice = question?.type === 'multiple-choice' ||
                          (question?.options && question.options.length > 0);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [answer, working]);

  const handleSubmit = async () => {
    const finalAnswer = isMultipleChoice ? selectedOption : answer;
    if (!finalAnswer || isSubmitting) return;

    setIsSubmitting(true);

    // Combine answer with working if provided
    const submittedAnswer = showWorking && working.trim()
      ? `${finalAnswer}\n\n[Working]:\n${working}`
      : finalAnswer;

    await onSubmit(submittedAnswer);

    // Reset after submission (but keep working for next question if desired)
    setAnswer('');
    setSelectedOption(null);
    setShowWorking(false);
    setWorking('');
    setIsSubmitting(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isMultipleChoice) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleOptionSelect = (optionLetter) => {
    setSelectedOption(optionLetter);
    // Auto-submit for multiple choice? Could be optional
    // handleSubmit();
  };

  // Multiple choice rendering
  if (isMultipleChoice && question.options) {
    return (
      <div className={`answer-input multiple-choice ${className}`}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '16px'
        }}>
          {question.options.map((option, index) => {
            const optionLetter = String.fromCharCode(65 + index);
            const isSelected = selectedOption === optionLetter;

            return (
              <button
                key={index}
                onClick={() => handleOptionSelect(optionLetter)}
                disabled={disabled || isSubmitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: isSelected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                  border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '0.95rem',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  width: '100%',
                  opacity: disabled ? 0.6 : 1
                }}
                onMouseEnter={e => {
                  if (!isSelected && !disabled) {
                    e.currentTarget.style.borderColor = 'var(--accent-glow)';
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected && !disabled) {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                  }
                }}
              >
                <span style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: isSelected ? 'var(--accent)' : 'var(--bg-surface)',
                  border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  color: isSelected ? 'var(--btn-text)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                }}>
                  {optionLetter}
                </span>
                <span style={{ flex: 1 }}>{option}</span>
              </button>
            );
          })}
        </div>

        {/* Submit button for multiple choice */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          {showHint && onHint && (
            <button
              onClick={onHint}
              disabled={disabled || isSubmitting}
              style={{
                padding: '10px 20px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={e => {
                if (!disabled) {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-bright)';
                }
              }}
              onMouseLeave={e => {
                if (!disabled) {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }
              }}
            >
              <span>💡</span> Hint
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!selectedOption || disabled || isSubmitting}
            style={{
              padding: '10px 24px',
              background: selectedOption && !disabled && !isSubmitting
                ? 'var(--accent)'
                : 'var(--bg-elevated)',
              color: selectedOption && !disabled && !isSubmitting
                ? 'var(--btn-text)'
                : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: selectedOption && !disabled && !isSubmitting ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              boxShadow: selectedOption && !disabled && !isSubmitting ? 'var(--shadow-accent)' : 'none'
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Answer'}
          </button>
        </div>
      </div>
    );
  }

  // Open-ended answer with working area
  return (
    <div className={`answer-input open-ended ${className}`}>
      {/* Main answer input */}
      <div style={{ marginBottom: '12px' }}>
        <textarea
          ref={textareaRef}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSubmitting}
          rows={3}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--bg-elevated)',
            border: '2px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.95rem',
            resize: 'vertical',
            minHeight: '80px',
            maxHeight: '300px',
            outline: 'none',
            transition: 'all var(--transition-fast)',
            opacity: disabled ? 0.6 : 1
          }}
          onFocus={e => {
            if (!disabled) {
              e.target.style.borderColor = 'var(--accent)';
              e.target.style.boxShadow = '0 0 0 3px var(--accent-soft)';
            }
          }}
          onBlur={e => {
            if (!disabled) {
              e.target.style.borderColor = 'var(--border)';
              e.target.style.boxShadow = 'none';
            }
          }}
        />
      </div>

      {/* Toggle working area */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => setShowWorking(!showWorking)}
          disabled={disabled}
          style={{
            background: 'none',
            border: 'none',
            color: showWorking ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '0.85rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 0'
          }}
        >
          <span style={{ fontSize: '1rem' }}>{showWorking ? '▼' : '▶'}</span>
          {showWorking ? 'Hide working' : 'Show working (step-by-step)'}
        </button>
      </div>

      {/* Working area (expandable) */}
      {showWorking && (
        <div style={{
          marginBottom: '16px',
          animation: 'slideDown 0.2s ease'
        }}>
          <textarea
            value={working}
            onChange={(e) => setWorking(e.target.value)}
            placeholder="Show your working here... (optional)"
            disabled={disabled || isSubmitting}
            rows={4}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'var(--bg-surface)',
              border: '1px dashed var(--border-bright)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9rem',
              resize: 'vertical',
              minHeight: '100px',
              outline: 'none',
              opacity: disabled ? 0.6 : 1
            }}
          />
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginTop: '4px'
          }}>
            Show your step-by-step working here. This helps us provide better feedback.
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        {showHint && onHint && (
          <button
            onClick={onHint}
            disabled={disabled || isSubmitting}
            style={{
              padding: '10px 20px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              if (!disabled) {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.borderColor = 'var(--border-bright)';
              }
            }}
            onMouseLeave={e => {
              if (!disabled) {
                e.currentTarget.style.background = 'var(--bg-elevated)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }
            }}
          >
            <span>💡</span> Hint
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!answer.trim() || disabled || isSubmitting}
          style={{
            padding: '10px 24px',
            background: answer.trim() && !disabled && !isSubmitting
              ? 'var(--accent)'
              : 'var(--bg-elevated)',
            color: answer.trim() && !disabled && !isSubmitting
              ? 'var(--btn-text)'
              : 'var(--text-muted)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: answer.trim() && !disabled && !isSubmitting ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            boxShadow: answer.trim() && !disabled && !isSubmitting ? 'var(--shadow-accent)' : 'none'
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Answer'}
        </button>
      </div>
    </div>
  );
}

export default AnswerInput;