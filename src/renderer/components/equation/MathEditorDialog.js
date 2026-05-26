/**
 * Math Editor Dialog Component
 * Modal dialog with equation editor, toolbar, and live preview
 *
 * @module components/equation/MathEditorDialog
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import MathToolbar from './MathToolbar';
import EquationPreview from './EquationPreview';

/**
 * Math Editor Dialog Component
 * @param {Object} props
 * @param {Function} props.onClose - Function to call when dialog closes
 * @param {Function} props.onInsert - Function to call with LaTeX when inserting
 * @param {string} props.initialLatex - Initial LaTeX content (optional)
 */
const MathEditorDialog = ({ onClose, onInsert, initialLatex = '' }) => {
  const [latex, setLatex] = useState(initialLatex);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);
  const dialogRef = useRef(null);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Handle escape key to close
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Handle toolbar button click
  const handleToolbarInsert = (latexSnippet) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = latex;

    // Insert at cursor position or replace selection
    const newText = text.substring(0, start) + latexSnippet + text.substring(end);
    setLatex(newText);

    // Set cursor position after inserted snippet
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + latexSnippet.length, start + latexSnippet.length);
    }, 0);
  };

  // Handle insert button click
  const handleInsert = () => {
    if (latex.trim()) {
      onInsert(latex);
    }
    onClose();
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-modal, 200)',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        ref={dialogRef}
        style={{
          width: '90%',
          maxWidth: '700px',
          maxHeight: '90vh',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn 0.2s ease',
          overflow: 'hidden',
          // Use theme-aware CSS variables instead of glass-bright
          // so the dialog respects light/dark theme correctly.
          background: 'var(--bg-base)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1.2rem',
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span role="img" aria-label="Math">📐</span> Equation Editor
          </h3>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ fontSize: '1.2rem' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Math Toolbar */}
        <MathToolbar onInsert={handleToolbarInsert} />

        {/* Body */}
        <div
          style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            overflowY: 'auto',
          }}
        >
          {/* LaTeX Input */}
          <div className="input-group">
            <label className="input-label">LaTeX</label>
            <textarea
              ref={textareaRef}
              value={latex}
              onChange={(e) => {
                setLatex(e.target.value);
                setError(null);
              }}
              placeholder="Type LaTeX here... e.g., \frac{x^2 + y^2}{z}"
              rows={4}
              className="input"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Preview */}
          <div className="input-group">
            <label className="input-label">Preview</label>
            <EquationPreview latex={latex} onError={setError} />
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--error-soft)',
                border: '1px solid var(--error)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--error)',
                fontSize: '0.85rem',
              }}
            >
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            className="btn btn-primary"
            disabled={!latex.trim()}
          >
            Insert Equation
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

MathEditorDialog.propTypes = {
  onClose: PropTypes.func.isRequired,
  onInsert: PropTypes.func.isRequired,
  initialLatex: PropTypes.string,
};

export default MathEditorDialog;