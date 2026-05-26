// FormulaRenderer.js
// Renders rich text containing:
//   • Markdown (bold, italic, lists, headings, code blocks, etc.)
//   • LaTeX inline:   $...$ or \(...\)
//   • LaTeX display:  $$...$$ or \[...\]
// Falls back gracefully if KaTeX or marked are unavailable.

import React, { useEffect, useRef, useMemo } from 'react';

// ── Optional dependencies ─────────────────────────────────────
let katex = null;
try {
  katex = require('katex');
  require('katex/dist/katex.min.css');
} catch (e) {
  console.warn('[FormulaRenderer] KaTeX not available — formulae will render as plain text.');
}

let marked = null;
try {
  const markedModule = require('marked');
  marked = markedModule.marked || markedModule.default || markedModule;
  if (typeof marked !== 'function') marked = null;
} catch (e) {
  console.warn('[FormulaRenderer] marked not available — markdown will render as plain text.');
}

// ── Inline formula ────────────────────────────────────────────
export function InlineFormula({ formula, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !katex || !formula) return;
    try {
      katex.render(formula, ref.current, {
        throwOnError: false,
        displayMode: false,
        strict: false,
        trust: false,
      });
    } catch (err) {
      if (ref.current) ref.current.textContent = formula;
    }
  }, [formula]);

  if (!katex) return <code className={`font-mono ${className}`}>{formula}</code>;
  return <span ref={ref} className={`katex-inline ${className}`} />;
}

// ── Display (block) formula ───────────────────────────────────
export function DisplayFormula({ formula, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !katex || !formula) return;
    try {
      katex.render(formula, ref.current, {
        throwOnError: false,
        displayMode: true,
        strict: false,
        trust: false,
      });
    } catch (err) {
      if (ref.current) ref.current.textContent = formula;
    }
  }, [formula]);

  if (!katex) {
    return (
      <pre className={`font-mono p-md rounded-md ${className}`}
           style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}>
        {formula}
      </pre>
    );
  }
  return <div ref={ref} className={`katex-display-block ${className}`} />;
}

// ── Normalise LaTeX delimiters ────────────────────────────────
// Converts \(...\) → $...$ and \[...\] → $$...$$ so the parser
// only needs to handle one delimiter style.
function normaliseLatexDelimiters(text) {
  // \[...\]  →  $$...$$   (must come before inline to avoid partial matches)
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);
  // \(...\)  →  $...$
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`);
  return text;
}

// ── Parse content into math / text segments ───────────────────
function parseMathContent(text) {
  const parts = [];
  let remaining = normaliseLatexDelimiters(text);

  while (remaining.length > 0) {
    const displayMatch = remaining.match(/\$\$([\s\S]*?)\$\$/);
    const inlineMatch  = remaining.match(/\$((?:[^$]|\\.)+?)\$/);

    const displayIdx = displayMatch ? remaining.indexOf(displayMatch[0]) : Infinity;
    const inlineIdx  = inlineMatch  ? remaining.indexOf(inlineMatch[0])  : Infinity;

    if (displayIdx === Infinity && inlineIdx === Infinity) {
      parts.push({ type: 'text', content: remaining });
      break;
    }

    if (displayIdx <= inlineIdx) {
      if (displayIdx > 0) {
        parts.push({ type: 'text', content: remaining.slice(0, displayIdx) });
      }
      parts.push({ type: 'display', content: displayMatch[1].trim() });
      remaining = remaining.slice(displayIdx + displayMatch[0].length);
    } else {
      if (inlineIdx > 0) {
        parts.push({ type: 'text', content: remaining.slice(0, inlineIdx) });
      }
      parts.push({ type: 'inline', content: inlineMatch[1].trim() });
      remaining = remaining.slice(inlineIdx + inlineMatch[0].length);
    }
  }

  return parts;
}

// ── Render a markdown string with embedded LaTeX ──────────────
// Strategy: extract all LaTeX tokens before passing to marked,
// replace them with placeholders, render markdown, then swap back
// the rendered KaTeX HTML for each placeholder.
function renderMarkdownWithMath(rawText) {
  if (!rawText) return '';

  const normalised = normaliseLatexDelimiters(rawText);
  const tokens = [];

  // Extract display math first, then inline
  let text = normalised.replace(/\$\$([\s\S]*?)\$\$/g, (match, inner) => {
    const id = `MATHBLOCK${tokens.length}ENDMATH`;
    tokens.push({ id, type: 'display', formula: inner.trim() });
    return id;
  });

  text = text.replace(/\$((?:[^$]|\\.)+?)\$/g, (match, inner) => {
    const id = `MATHINLINE${tokens.length}ENDMATH`;
    tokens.push({ id, type: 'inline', formula: inner.trim() });
    return id;
  });

  // Render markdown
  let html = '';
  if (marked) {
    try {
      html = marked(text, { breaks: true, gfm: true });
    } catch (e) {
      html = `<p>${text.replace(/\n/g, '<br/>')}</p>`;
    }
  } else {
    html = `<p>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>')}</p>`;
  }

  // Swap placeholders back with KaTeX-rendered HTML
  tokens.forEach(({ id, type, formula }) => {
    let rendered = '';
    if (katex) {
      try {
        rendered = katex.renderToString(formula, {
          throwOnError: false,
          displayMode: type === 'display',
          strict: false,
          trust: false,
        });
        if (type === 'display') {
          rendered = `<div class="katex-display-block">${rendered}</div>`;
        }
      } catch (e) {
        rendered = `<code>${formula}</code>`;
      }
    } else {
      rendered = type === 'display'
        ? `<pre class="font-mono">${formula}</pre>`
        : `<code>${formula}</code>`;
    }
    html = html.replace(id, rendered);
  });

  return html;
}

// ── Main component: RichMathText ──────────────────────────────
// Renders markdown + LaTeX in a message bubble.
export function RichMathText({ content, className = '' }) {
  const html = useMemo(() => renderMarkdownWithMath(content), [content]);

  return (
    <span
      className={`rich-math-text ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ display: 'block' }}
    />
  );
}

export default RichMathText;