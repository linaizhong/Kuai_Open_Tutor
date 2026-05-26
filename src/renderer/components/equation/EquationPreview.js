/**
 * Equation Preview Component
 * Renders LaTeX using KaTeX with error handling
 *
 * @module components/equation/EquationPreview
 */

import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Equation Preview Component
 * @param {Object} props
 * @param {string} props.latex - LaTeX string to render
 * @param {Function} props.onError - Error callback (optional)
 */
const EquationPreview = ({ latex, onError }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = ''; // Clear previous content

    if (!latex.trim()) {
      // Show placeholder when empty
      const placeholder = document.createElement('div');
      placeholder.style.color = 'var(--text-muted)';
      placeholder.style.padding = '20px';
      placeholder.style.textAlign = 'center';
      placeholder.style.fontStyle = 'italic';
      placeholder.textContent = 'Preview will appear here';
      container.appendChild(placeholder);
      return;
    }

    try {
      // Render with KaTeX
      katex.render(latex, container, {
        throwOnError: true,
        displayMode: true,
        output: 'html',
        fleqn: false,
        leqno: false,
        trust: true,
        macros: {
          '\\f': '\\frac{#1}{#2}',
        },
      });

      // Clear any previous error
      if (onError) onError(null);

    } catch (error) {
      console.warn('[EquationPreview] KaTeX error:', error.message);

      // Show error message in preview
      const errorDiv = document.createElement('div');
      errorDiv.style.color = 'var(--error)';
      errorDiv.style.padding = '12px';
      errorDiv.style.background = 'var(--error-soft)';
      errorDiv.style.borderRadius = 'var(--radius-md)';
      errorDiv.style.border = '1px solid var(--error)';
      errorDiv.style.fontFamily = 'var(--font-mono)';
      errorDiv.style.fontSize = '0.85rem';
      errorDiv.style.whiteSpace = 'pre-wrap';
      errorDiv.textContent = `❌ ${error.message}`;
      container.appendChild(errorDiv);

      if (onError) onError(error.message);
    }
  }, [latex, onError]);

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100px',
        padding: '16px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflowX: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
      }}
    />
  );
};

EquationPreview.propTypes = {
  latex: PropTypes.string.isRequired,
  onError: PropTypes.func,
};

export default EquationPreview;