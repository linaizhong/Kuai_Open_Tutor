/**
 * Math Editor Button Component
 * Small button in ChatWindow that opens the equation editor dialog
 *
 * @module components/equation/MathEditorButton
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * Math Editor Button Component
 * @param {Object} props
 * @param {Function} props.onClick - Function to call when button is clicked
 * @param {boolean} props.disabled - Whether button is disabled
 */
const MathEditorButton = ({ onClick, disabled = false }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="math-editor-button"
      data-tooltip="Open equation editor (∑)"
      style={{
        position: 'absolute',
        right: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '32px',
        height: '32px',
        borderRadius: 'var(--radius-md)',
        background: disabled ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        border: '1px solid var(--border)',
        color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        fontSize: '1.1rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all var(--transition-fast)',
        zIndex: 5,
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'var(--bg-elevated)';
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'var(--bg-surface)';
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      <span role="img" aria-label="Equation editor">∑</span>
    </button>
  );
};

MathEditorButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default MathEditorButton;