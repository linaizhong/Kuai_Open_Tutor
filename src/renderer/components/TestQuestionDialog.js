// TestQuestionDialog.js
// Modal dialog for test-led questions.
// Replaces the inline TestQuestionMessage card so the chat scroll area
// is never affected by question content or feedback.
//
// Flow:
//   1. Dialog opens with the question
//   2. Student answers → feedback toast appears inside the dialog
//   3. Student dismisses toast (X) → dialog closes, compact card added to chat
//   4. Next question opens a fresh dialog

import React, { useState, useEffect, useRef } from 'react';
import RichMathText from './FormulaRenderer';
import AnswerInput from './test/AnswerInput';
import { CopyButton, TTSButton, ExportButton } from './ActionButtons';

export default function TestQuestionDialog({
  question,        // { text, hint, options, type, marks, difficulty, topic }
  questionIndex,
  totalQuestions,
  onSubmit,        // (answer) => void  — called when student submits
  onClose,         // () => void        — called when dialog is dismissed (skip)
  // Feedback state (set by parent after submission)
  feedback,        // null | { isCorrect, detailedFeedback, workedSolution }
  onFeedbackClose, // () => void — called when student dismisses feedback
  // Streaming support
  streaming = false,          // true while the question text is still arriving
  streamingContent = null,    // live accumulated text from chunks
}) {
  const [showHint, setShowHint] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contentRef = useRef(null);  // ref for the scrollable content area

  // Context-aware messages shown inside the dialog while waiting for LLM
  const SUBMITTING_MESSAGES = [
    'Checking your answer...',
    'Evaluating your working...',
    'Analysing your response...',
  ];
  const [submittingMsgIndex, setSubmittingMsgIndex] = useState(0);

  // Cycle through messages while submitting so it feels alive
  useEffect(() => {
    if (!isSubmitting) { setSubmittingMsgIndex(0); return; }
    const interval = setInterval(() => {
      setSubmittingMsgIndex(i => (i + 1) % SUBMITTING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [isSubmitting]);

  // Auto-scroll to bottom as streaming content arrives
  useEffect(() => {
    if (streaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamingContent, streaming]);

  // The displayed question text: use streamingContent while streaming, else question.text
  const displayText = streaming
    ? (streamingContent || '')
    : (question?.text || streamingContent || '');

  // Reset hint when question changes
  useEffect(() => {
    setShowHint(false);
  }, [questionIndex]);

  const handleSubmit = async (answer) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    await onSubmit(answer);
    setIsSubmitting(false);
  };

  if (!question) return null;

  return (
    // Backdrop
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 500,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      {/* Dialog */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '740px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>

        {/* ── Submitting overlay (shown inside dialog while LLM checks answer) ── */}
        {isSubmitting && (
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
              border: '3px solid var(--accent-soft)',
              borderTopColor: 'var(--accent)',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 600,
              letterSpacing: '0.01em',
              textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              transition: 'opacity 0.3s ease',
            }}>
              {SUBMITTING_MESSAGES[submittingMsgIndex]}
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          background: 'var(--bg-elevated)',
        }}>
          <span style={{
            fontSize: '1.3rem',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--accent-soft)',
            borderRadius: '10px',
            border: '1px solid var(--accent-glow)',
          }}>
            📝
          </span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--accent)',
              background: 'var(--accent-soft)',
              padding: '3px 12px',
              borderRadius: '999px',
              border: '1px solid var(--accent-glow)',
              display: 'inline-block',
            }}>
              Question {questionIndex} of {totalQuestions}
            </div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              {question.topic && <span>Topic: {question.topic}</span>}
              {question.difficulty && <span style={{ marginLeft: 8 }}>• Difficulty: {question.difficulty}</span>}
              {question.marks && <span style={{ marginLeft: 8 }}>• {question.marks} mark{question.marks > 1 ? 's' : ''}</span>}
            </div>
          </div>
          {/* ── Action buttons (Copy / Listen / Export) ── */}
          {!streaming && displayText && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <CopyButton content={displayText} />
              <TTSButton  content={displayText} className="tts-button" />
              <ExportButton content={displayText} />
            </div>
          )}

          <button
            onClick={onClose}
            title="Skip question"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
              cursor: 'pointer',
              padding: '4px 10px',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            ✕
          </button>
        </div>

        {/* ── Feedback banner (shown after submission) ── */}
        {feedback && (
          <div style={{
            flexShrink: 0,
            margin: '12px 20px 0',
            background: feedback.isCorrect
              ? 'var(--success-soft, rgba(34,197,94,0.12))'
              : 'var(--error-soft, rgba(239,68,68,0.12))',
            border: `1px solid ${feedback.isCorrect ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)'}`,
            borderRadius: '12px',
            padding: '12px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>
                {feedback.isCorrect ? '✅' : '❌'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: feedback.isCorrect ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)',
                  marginBottom: feedback.detailedFeedback ? '5px' : 0,
                }}>
                  {feedback.isCorrect ? 'Correct!' : 'Not quite right'}
                </div>
                {feedback.detailedFeedback && (
                  <div style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.82rem',
                    lineHeight: 1.55,
                    maxHeight: '90px',
                    overflowY: 'auto',
                  }}>
                    <RichMathText content={feedback.detailedFeedback} />
                  </div>
                )}
                {/* Worked solution — only shown for incorrect answers */}
                {!feedback.isCorrect && feedback.workedSolution && (
                  <details style={{ marginTop: '10px' }}>
                    <summary style={{
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--accent)',
                      userSelect: 'none',
                    }}>
                      📖 Show worked solution
                    </summary>
                    <div style={{
                      marginTop: '8px',
                      padding: '10px 12px',
                      background: 'var(--bg-surface)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.82rem',
                      lineHeight: 1.6,
                      color: 'var(--text-primary)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}>
                      <RichMathText content={feedback.workedSolution} />
                    </div>
                  </details>
                )}
              </div>
              <button
                onClick={onFeedbackClose}
                title="Dismiss"
                style={{
                  flexShrink: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  padding: '0 4px',
                  opacity: 0.7,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ── Question content ── */}
        <div ref={contentRef} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          minHeight: 0,
        }}>
          <div style={{
            fontSize: '1rem',
            lineHeight: 1.8,
            color: 'var(--text-primary)',
            marginBottom: '20px',
            minHeight: '2em',
          }}>
            {streaming && !displayText ? (
              // Show pulsing placeholder while waiting for first token
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Generating question
                <span className="streaming-dots">...</span>
              </span>
            ) : (
              <>
                <RichMathText content={displayText} />
                {streaming && (
                  <span className="streaming-cursor" style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '1.1em',
                    background: 'var(--accent)',
                    marginLeft: '2px',
                    verticalAlign: 'text-bottom',
                    animation: 'blink 0.8s step-end infinite',
                  }} />
                )}
              </>
            )}
          </div>

          {/* Hint */}
          {showHint && question.hint && (
            <div style={{
              marginBottom: '16px',
              padding: '12px 16px',
              background: 'var(--bg-elevated)',
              borderRadius: '10px',
              borderLeft: '4px solid var(--warning)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                color: 'var(--warning)', fontWeight: 600, fontSize: '0.85rem',
                marginBottom: '4px',
              }}>
                <span>💡</span><span>Hint</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {question.hint}
              </div>
            </div>
          )}

          {/* Answer input — only shown before submission and after streaming completes */}
          {!feedback && !streaming && (
            <AnswerInput
              question={question}
              onSubmit={handleSubmit}
              onHint={() => setShowHint(true)}
              showHint={!showHint && !!question.hint}
              placeholder="Type your answer here... (Press Enter to submit, Shift+Enter for new line)"
              disabled={isSubmitting}
            />
          )}
          {/* While streaming, show a subtle loading indicator where the input will appear */}
          {!feedback && streaming && (
            <div style={{
              padding: '12px 16px',
              background: 'var(--bg-elevated)',
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              fontStyle: 'italic',
              opacity: 0.6,
            }}>
              Answer input will appear when question loads...
            </div>
          )}

          {/* After feedback — show Next Question button */}
          {feedback && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={onFeedbackClose}
                style={{
                  padding: '10px 28px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px var(--accent-glow)',
                }}
              >
                Next Question →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}