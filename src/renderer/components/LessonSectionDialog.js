// LessonSectionDialog.js
// Modal dialog shown for each teacher-led lesson section.
// Replaces the section_start chat bubble with a full-screen overlay.
// Student clicks "Continue" (or submits an answer) to proceed.

import React, { useState, useEffect, useRef } from 'react';
import RichMathText from './FormulaRenderer';
import { CopyButton, TTSButton, ExportButton } from './ActionButtons';

const PHASE_META = {
  introducing:  { icon: '📋', label: 'Introduction',        color: '#6366f1' },
  explanation:  { icon: '📖', label: 'Explanation',         color: '#0ea5e9' },
  check:        { icon: '❓', label: 'Check Understanding', color: '#f59e0b' },
  checking:     { icon: '❓', label: 'Check Understanding', color: '#f59e0b' },
  practice:     { icon: '✏️', label: 'Practice',            color: '#10b981' },
  assessment:   { icon: '📝', label: 'Assessment',          color: '#ef4444' },
  summary:      { icon: '✅', label: 'Summary',             color: '#8b5cf6' },
  complete:     { icon: '🎉', label: 'Complete',            color: '#22c55e' },
};

/**
 * @param {object}   props
 * @param {object}   props.section        — { phase, subPhase, content, questionIndex, totalQuestions, topic }
 * @param {function} props.onContinue     — called when student clicks Continue / Submit
 * @param {function} props.onClose        — called when student dismisses without continuing (X)
 * @param {boolean}  props.isCheckPhase  — true when student must type an answer
 */
export default function LessonSectionDialog({
  section,
  onContinue,
  onClose,
  isCheckPhase,
  streaming = false,           // true while content is still arriving
  streamingContent = null,     // live accumulated text from chunks
}) {
  const [answer, setAnswer]       = useState('');
  const [submitted, setSubmitted] = useState(false);
  const textareaRef               = useRef(null);
  const contentRef                = useRef(null);  // ref for the scrollable content area

  // Context-aware cycling messages while waiting for LLM response
  const SUBMITTED_MESSAGES = isCheckPhase
    ? ['Checking your answer...', 'Evaluating your response...', 'Analysing your working...']
    : ['Preparing next section...', 'Loading content...', 'Getting ready...'];
  const [submittedMsgIndex, setSubmittedMsgIndex] = useState(0);

  useEffect(() => {
    if (!submitted) { setSubmittedMsgIndex(0); return; }
    const interval = setInterval(() => {
      setSubmittedMsgIndex(i => (i + 1) % SUBMITTED_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [submitted]);

  // Auto-scroll to bottom as streaming content arrives
  useEffect(() => {
    if (streaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamingContent, streaming]);

  const phase = section?.phase || 'introducing';
  const meta  = PHASE_META[phase] || PHASE_META.introducing;

  // Use streamingContent while streaming, else fall back to section.content
  const displayContent = streaming
    ? (streamingContent || '')
    : (section?.content || streamingContent || '');

  // Auto-focus textarea in check phase
  useEffect(() => {
    if (isCheckPhase && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isCheckPhase]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [answer]);

  const handleSubmit = () => {
    if (isCheckPhase && !answer.trim()) return;
    setSubmitted(true);
    onContinue(isCheckPhase ? answer.trim() : null);
    setAnswer('');
    // NOTE: do NOT reset submitted — overlay stays visible until dialog unmounts
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!section) return null;

  const questionInfo = section.questionIndex && section.totalQuestions
    ? `Question ${section.questionIndex} of ${section.totalQuestions}`
    : null;

  return (
    // Backdrop
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 500,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      animation: 'fadeIn 0.2s ease',
    }}>
      {/* Dialog box */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.25s ease',
        overflow: 'hidden',
      }}>

        {/* ── Submitted overlay (shown while LLM processes the response) ── */}
        {submitted && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            borderRadius: '20px',
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: `3px solid ${meta.color}44`,
              borderTopColor: meta.color,
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 600,
              letterSpacing: '0.01em',
              textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}>
              {SUBMITTED_MESSAGES[submittedMsgIndex]}
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          background: 'var(--bg-elevated)',
        }}>
          <span style={{
            fontSize: '1.4rem',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: meta.color + '22',
            borderRadius: '10px',
            border: `1px solid ${meta.color}44`,
          }}>
            {meta.icon}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontWeight: 700,
              fontSize: '1rem',
              color: 'var(--text-primary)',
            }}>
              {meta.label}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {section.topic && <span>{section.topic}</span>}
              {questionInfo && (
                <span style={{
                  marginLeft: section.topic ? '8px' : 0,
                  color: meta.color,
                  fontWeight: 600,
                }}>
                  • {questionInfo}
                </span>
              )}
            </div>
          </div>

          {/* ── Action buttons (Copy / Listen / Export) ── */}
          {!streaming && displayContent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <CopyButton content={displayContent} />
              <TTSButton  content={displayContent} className="tts-button" />
              <ExportButton content={displayContent} />
            </div>
          )}

          {/* Close (X) button */}
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              fontSize: '1rem',
              cursor: 'pointer',
              padding: '4px 10px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div ref={contentRef} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          minHeight: 0,
        }}>
          <div style={{
            color: 'var(--text-primary)',
            fontSize: '0.95rem',
            lineHeight: 1.8,
            minHeight: '2em',
          }}>
            {streaming && !displayContent ? (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Loading lesson content
                <span className="streaming-dots">...</span>
              </span>
            ) : (
              <>
                <RichMathText content={displayContent} />
                {streaming && (
                  <span style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '1.1em',
                    background: meta.color,
                    marginLeft: '2px',
                    verticalAlign: 'text-bottom',
                    animation: 'blink 0.8s step-end infinite',
                  }} />
                )}
              </>
            )}
          </div>

          {/* Answer input for check/practice phases */}
          {isCheckPhase && (
            <div style={{ marginTop: '20px' }}>
              <div style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '8px',
                fontWeight: 500,
              }}>
                Your answer:
              </div>
              <textarea
                ref={textareaRef}
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer here... (Enter to submit, Shift+Enter for new line)"
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--bg-elevated)',
                  border: '2px solid var(--border)',
                  borderRadius: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9rem',
                  resize: 'none',
                  outline: 'none',
                  minHeight: '80px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  transition: 'border-color 0.2s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = meta.color}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          flexShrink: 0,
          background: 'var(--bg-elevated)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Skip
          </button>

          <button
            onClick={handleSubmit}
            disabled={streaming || (isCheckPhase && !answer.trim()) || submitted}
            style={{
              padding: '10px 28px',
              background: isCheckPhase && !answer.trim() ? 'var(--bg-elevated)' : meta.color,
              border: 'none',
              borderRadius: '10px',
              color: isCheckPhase && !answer.trim() ? 'var(--text-muted)' : '#fff',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: isCheckPhase && !answer.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: isCheckPhase && !answer.trim() ? 'none' : `0 4px 12px ${meta.color}44`,
            }}
          >
            {submitted ? '...' : isCheckPhase ? 'Submit Answer' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}