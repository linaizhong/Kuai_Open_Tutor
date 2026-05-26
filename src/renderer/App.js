// App.js
// MODIFIED: Added teaching mode state (v4.0)
// Root React component for OpenTutor.
// Handles the full-window layout:
//   - Draggable title bar
//   - Left sidebar (navigation + mascot + exam countdown)
//   - Main content area (Chat / Progress / Settings)
//   - Background constellation canvas

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatWindow        from './components/ChatWindow';
import ProgressDashboard from './components/ProgressDashboard';
import Settings          from './components/Settings';
import Mascot            from './components/Mascot';
import ipc from './ipc';

// ── Theme loader — applies saved theme CSS vars on startup ────
function applyThemeVars(vars) {
  if (!vars || typeof vars !== 'object') return;
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  const accent = vars['--accent'];
  if (accent && /^#[0-9a-fA-F]{6}$/.test(accent)) {
    const r = parseInt(accent.slice(1, 3), 16);
    const g = parseInt(accent.slice(3, 5), 16);
    const b = parseInt(accent.slice(5, 7), 16);
    root.style.setProperty('--shadow-accent', `0 4px 24px rgba(${r},${g},${b},0.25)`);
    root.style.setProperty('--shadow-glow',   `0 0 30px rgba(${r},${g},${b},0.15)`);
    root.style.setProperty('--accent-soft',   `${accent}22`);
    root.style.setProperty('--accent-glow',   `${accent}44`);
    root.style.setProperty('--text-accent',   accent);
    root.style.setProperty('--border-accent', `${accent}44`);
  }
}

// ── Navigation items ──────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'chat',     icon: '💬', label: 'Chat'      },
  { id: 'progress', icon: '📊', label: 'Progress'  },
  { id: 'settings', icon: '⚙️', label: 'Settings'  },
  { id: 'tools',    icon: '🛠️', label: 'Tools'     },
];

// ── Starfield background canvas ───────────────────────────────
function StarfieldCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Generate stars
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.2,
      opacity: Math.random() * 0.4 + 0.05,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
    }));

    // Generate constellation lines (pairs of nearby stars)
    const lines = [];
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.08 && lines.length < 40) {
          lines.push([i, j, dist]);
        }
      }
    }

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.016;

      // Draw lines
      lines.forEach(([i, j, dist]) => {
        const opacity = Math.max(0, 0.06 - dist) * 600;
        ctx.beginPath();
        ctx.moveTo(stars[i].x * canvas.width, stars[i].y * canvas.height);
        ctx.lineTo(stars[j].x * canvas.width, stars[j].y * canvas.height);
        ctx.strokeStyle = `rgba(245,166,35,${opacity * 0.3})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      // Draw stars
      stars.forEach(s => {
        const twinkle = Math.sin(t * s.twinkleSpeed * 60 + s.twinkleOffset) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232,237,243,${s.opacity * twinkle})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.6,
      }}
    />
  );
}

// ── Exam countdown pill ───────────────────────────────────────
function ExamCountdown({ examDate }) {
  if (!examDate) return null;

  const now   = new Date();
  const exam  = new Date(examDate);
  const diffMs = exam - now;
  if (diffMs <= 0) return null;

  const days  = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);

  const urgency = days < 14 ? 'var(--error)'
                : days < 42 ? 'var(--warning)'
                : 'var(--success)';

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 'var(--radius-md)',
      background: `${urgency}12`,
      border: `1px solid ${urgency}33`,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: '1.4rem',
        fontWeight: 700,
        color: urgency,
        fontFamily: 'var(--font-display)',
        lineHeight: 1,
      }}>
        {weeks > 0 ? `${weeks}w` : `${days}d`}
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '3px' }}>
        until HSC
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
        {exam.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
      </div>
    </div>
  );
}

// ── Nav button ────────────────────────────────────────────────
function NavButton({ item, isActive, onClick }) {
  return (
    <button
      onClick={() => onClick(item.id)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        background: isActive
          ? 'linear-gradient(135deg, var(--accent-soft), rgba(245,166,35,0.05))'
          : 'transparent',
        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
        fontFamily: 'var(--font-body)',
        fontSize: '0.875rem',
        fontWeight: isActive ? 600 : 400,
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        textAlign: 'left',
        borderLeft: isActive
          ? '2px solid var(--accent)'
          : '2px solid transparent',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--bg-elevated)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-muted)';
        }
      }}
    >
      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{item.icon}</span>
      <span>{item.label}</span>
    </button>
  );
}

// ── MD → HTML Converter panel ────────────────────────────────
function ToolsPanel({ onOpenViewer }) {
  // MD → HTML state
  const [mdStatus,   setMdStatus]   = React.useState(null);
  const [mdResult,   setMdResult]   = React.useState(null);
  const [mdError,    setMdError]    = React.useState('');

  // PDF → MD state
  const [pdfStatus,  setPdfStatus]  = React.useState(null);
  const [pdfResult,  setPdfResult]  = React.useState(null);
  const [pdfError,   setPdfError]   = React.useState('');

  const handleMdConvert = async () => {
    setMdStatus('converting'); setMdResult(null); setMdError('');
    try {
      const res = await ipc.invoke('tools:md-to-html');
      if (res?.canceled) { setMdStatus(null); return; }
      if (res?.success)  { setMdResult(res); setMdStatus('done'); }
      else               { setMdError(res?.error || 'Conversion failed.'); setMdStatus('error'); }
    } catch (err) { setMdError(err.message || 'Unexpected error.'); setMdStatus('error'); }
  };

  const handlePdfConvert = async () => {
    setPdfStatus('converting'); setPdfResult(null); setPdfError('');
    try {
      const res = await ipc.invoke('tools:pdf-to-md');
      if (res?.canceled) { setPdfStatus(null); return; }
      if (res?.success)  { setPdfResult(res); setPdfStatus('done'); }
      else               { setPdfError(res?.error || 'Conversion failed.'); setPdfStatus('error'); }
    } catch (err) { setPdfError(err.message || 'Unexpected error.'); setPdfStatus('error'); }
  };

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', padding:'32px', display:'flex', flexDirection:'column', gap:'24px' }}>
      <div>
        <h2 style={{ margin:0, fontSize:'1.3rem', fontWeight:700, color:'var(--text-primary)', fontFamily:'var(--font-display)' }}>
          🛠️ Tools
        </h2>
        <p style={{ margin:'6px 0 0', color:'var(--text-muted)', fontSize:'0.85rem' }}>
          Utilities for working with your study materials.
        </p>
      </div>

      {/* ── Cards grid — 2 columns ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'16px', maxWidth:'1100px' }}>

      {/* ── Markdown → HTML converter card ── */}
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'16px', padding:'24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
          <span style={{ fontSize:'1.6rem', width:'44px', height:'44px', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--accent-soft)', borderRadius:'12px', border:'1px solid var(--accent-glow)' }}>📄</span>
          <div>
            <div style={{ fontWeight:700, fontSize:'1rem', color:'var(--text-primary)' }}>Markdown → HTML</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:'2px' }}>
              Converts a .md file to a standalone .html with MathJax and syntax highlighting, saved next to the source file.
            </div>
          </div>
        </div>

        <ul style={{ margin:'0 0 20px 0', padding:'0 0 0 20px', color:'var(--text-secondary)', fontSize:'0.82rem', lineHeight:1.7 }}>
          <li>Renders LaTeX maths via MathJax (inline and display)</li>
          <li>Supports Mermaid diagrams</li>
          <li>Full GFM: tables, code blocks with language labels, blockquotes</li>
          <li>Clean print-ready typography</li>
          <li>Saved as <code style={{ fontFamily:'var(--font-mono)', background:'var(--bg-elevated)', padding:'1px 5px', borderRadius:4 }}>filename.html</code> next to your .md file</li>
        </ul>

        <button
          onClick={handleMdConvert}
          disabled={mdStatus === 'converting'}
          style={{
            padding:'10px 28px',
            background: mdStatus === 'converting' ? 'var(--bg-elevated)' : 'var(--accent)',
            border:'none', borderRadius:'10px',
            color: mdStatus === 'converting' ? 'var(--text-muted)' : '#fff',
            fontSize:'0.9rem', fontWeight:600,
            cursor: mdStatus === 'converting' ? 'not-allowed' : 'pointer',
            boxShadow: mdStatus === 'converting' ? 'none' : '0 4px 12px var(--accent-glow)',
            transition:'all 0.15s ease',
            display:'flex', alignItems:'center', gap:'8px',
          }}
        >
          {mdStatus === 'converting' ? (
            <>
              <span style={{ width:'14px', height:'14px', borderRadius:'50%', border:'2px solid var(--text-muted)', borderTopColor:'transparent', display:'inline-block', animation:'spin 0.7s linear infinite' }} />
              Converting...
            </>
          ) : '📂 Choose Markdown File'}
        </button>

        {mdStatus === 'done' && mdResult && (
          <div style={{ marginTop:'16px', padding:'12px 16px', background:'rgba(34,197,94,0.10)', border:'1px solid #22c55e', borderRadius:'10px', fontSize:'0.82rem', color:'var(--text-secondary)' }}>
            <div style={{ fontWeight:700, color:'#22c55e', marginBottom:'4px' }}>✅ Converted successfully!</div>
            <div>Saved as <strong style={{ color:'var(--text-primary)' }}>{mdResult.filename}</strong></div>
            <div style={{ marginTop:'3px', color:'var(--text-muted)', wordBreak:'break-all' }}>{mdResult.destPath}</div>
          </div>
        )}

        {mdStatus === 'error' && (
          <div style={{ marginTop:'16px', padding:'12px 16px', background:'rgba(239,68,68,0.10)', border:'1px solid #ef4444', borderRadius:'10px', fontSize:'0.82rem', color:'#ef4444' }}>
            ❌ {mdError}
          </div>
        )}
      </div>

      {/* ── PDF → Markdown converter card ── */}
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'16px', padding:'24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
          <span style={{ fontSize:'1.6rem', width:'44px', height:'44px', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.12)', borderRadius:'12px', border:'1px solid rgba(239,68,68,0.3)' }}>📕</span>
          <div>
            <div style={{ fontWeight:700, fontSize:'1rem', color:'var(--text-primary)' }}>PDF → Markdown</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:'2px' }}>
              Extracts text from a .pdf and saves it as a clean .md file next to the source, ready to edit or convert further.
            </div>
          </div>
        </div>

        <ul style={{ margin:'0 0 20px 0', padding:'0 0 0 20px', color:'var(--text-secondary)', fontSize:'0.82rem', lineHeight:1.7 }}>
          <li>Extracts all text content from text-based PDFs</li>
          <li>Auto-detects headings, bullet points and section breaks</li>
          <li>Adds front-matter with title, author and page count</li>
          <li>Saved as <code style={{ fontFamily:'var(--font-mono)', background:'var(--bg-elevated)', padding:'1px 5px', borderRadius:4 }}>filename.md</code> next to your .pdf file</li>
          <li style={{ color:'var(--text-muted)' }}>Note: works best with text-based PDFs — scanned image PDFs will produce limited output</li>
        </ul>

        <button
          onClick={handlePdfConvert}
          disabled={pdfStatus === 'converting'}
          style={{
            padding:'10px 28px',
            background: pdfStatus === 'converting' ? 'var(--bg-elevated)' : '#ef4444',
            border:'none', borderRadius:'10px',
            color: pdfStatus === 'converting' ? 'var(--text-muted)' : '#fff',
            fontSize:'0.9rem', fontWeight:600,
            cursor: pdfStatus === 'converting' ? 'not-allowed' : 'pointer',
            boxShadow: pdfStatus === 'converting' ? 'none' : '0 4px 12px rgba(239,68,68,0.3)',
            transition:'all 0.15s ease',
            display:'flex', alignItems:'center', gap:'8px',
          }}
        >
          {pdfStatus === 'converting' ? (
            <>
              <span style={{ width:'14px', height:'14px', borderRadius:'50%', border:'2px solid var(--text-muted)', borderTopColor:'transparent', display:'inline-block', animation:'spin 0.7s linear infinite' }} />
              Extracting...
            </>
          ) : '📂 Choose PDF File'}
        </button>

        {pdfStatus === 'done' && pdfResult && (
          <div style={{ marginTop:'16px', padding:'12px 16px', background:'rgba(34,197,94,0.10)', border:'1px solid #22c55e', borderRadius:'10px', fontSize:'0.82rem', color:'var(--text-secondary)' }}>
            <div style={{ fontWeight:700, color:'#22c55e', marginBottom:'4px' }}>✅ Extracted successfully!</div>
            <div>Saved as <strong style={{ color:'var(--text-primary)' }}>{pdfResult.filename}</strong></div>
            {pdfResult.numPages && <div style={{ marginTop:'2px', color:'var(--text-muted)' }}>{pdfResult.numPages} page{pdfResult.numPages !== 1 ? 's' : ''} extracted</div>}
            <div style={{ marginTop:'3px', color:'var(--text-muted)', wordBreak:'break-all' }}>{pdfResult.destPath}</div>
          </div>
        )}

        {pdfStatus === 'error' && (
          <div style={{ marginTop:'16px', padding:'12px 16px', background:'rgba(239,68,68,0.10)', border:'1px solid #ef4444', borderRadius:'10px', fontSize:'0.82rem', color:'#ef4444' }}>
            ❌ {pdfError}
          </div>
        )}
      </div>

      {/* ── Markdown Viewer card ── */}
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'16px', padding:'24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
          <span style={{ fontSize:'1.6rem', width:'44px', height:'44px', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(99,102,241,0.12)', borderRadius:'12px', border:'1px solid rgba(99,102,241,0.3)' }}>👁️</span>
          <div>
            <div style={{ fontWeight:700, fontSize:'1rem', color:'var(--text-primary)' }}>Markdown Viewer</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:'2px' }}>
              Open and read any .md file in a full-screen reader with a table of contents and dark/light mode.
            </div>
          </div>
        </div>
        <ul style={{ margin:'0 0 20px 0', padding:'0 0 0 20px', color:'var(--text-secondary)', fontSize:'0.82rem', lineHeight:1.7 }}>
          <li>Auto-generated table of contents from headings</li>
          <li>Renders bold, italic, code, tables, blockquotes and lists</li>
          <li>MathJax for LaTeX maths (inline and display)</li>
          <li>Dark and light reading modes</li>
        </ul>
        <button
          onClick={onOpenViewer}
          style={{
            padding:'10px 28px',
            background:'#6366f1', border:'none', borderRadius:'10px',
            color:'#fff', fontSize:'0.9rem', fontWeight:600, cursor:'pointer',
            boxShadow:'0 4px 12px rgba(99,102,241,0.3)',
            transition:'all 0.15s ease',
            display:'flex', alignItems:'center', gap:'8px',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'}
          onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}
        >
          📂 Open Markdown File
        </button>
      </div>

      </div> {/* end 2-column grid */}
    </div>
  );
}

// ── Markdown Viewer panel ────────────────────────────────────
// Full-screen document reader with TOC sidebar, dark/light toggle,
// and a back button to return to Tools.
function MarkdownViewer({ onClose }) {
  const [mdContent,  setMdContent]  = React.useState(null);  // raw markdown
  const [renderedHtml, setRenderedHtml] = React.useState(''); // HTML from main process
  const [filename,   setFilename]   = React.useState('');
  const [lightMode,  setLightMode]  = React.useState(false);
  const [toc,        setToc]        = React.useState([]);
  const [loading,    setLoading]    = React.useState(false);
  const [rendering,  setRendering]  = React.useState(false);
  const [error,      setError]      = React.useState('');
  const contentRef                  = React.useRef(null);

  // ── Open + render file ────────────────────────────────────────
  const handleOpen = async () => {
    setLoading(true); setError('');
    try {
      const res = await ipc.invoke('tools:read-file', { extensions: ['md', 'markdown'] });
      if (res?.canceled) { setLoading(false); return; }
      if (!res?.success) { setError(res?.error || 'Failed to open file.'); setLoading(false); return; }

      setMdContent(res.content);
      setFilename(res.filename);
      buildToc(res.content);

      // Send to main process for proper marked rendering
      setRendering(true);
      const rendered = await ipc.invoke('tools:render-markdown', { markdown: res.content });
      if (rendered?.success) {
        setRenderedHtml(rendered.html);
      } else {
        setError(rendered?.error || 'Render failed.');
      }
      setRendering(false);
    } catch (err) {
      setError(err.message || 'Unexpected error.');
    }
    setLoading(false);
    setRendering(false);
  };

  // ── Build TOC from headings ───────────────────────────────────
  const buildToc = (text) => {
    const headings = [];
    const re = /^(#{1,3})\s+(.+)/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
      const level = m[1].length;
      const label = m[2].trim().replace(/[*_`#]/g, '').replace(/:[\w\-]+:/g, '').trim();
      const slug  = label.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
      headings.push({ level, label, slug });
    }
    setToc(headings);
  };

  // ── Scroll to heading — match by data-id on the rendered HTML ──
  const scrollTo = (slug) => {
    if (!contentRef.current) return;
    // Try data-id first (set by afterRender), then id
    const el = contentRef.current.querySelector('[data-slug="' + slug + '"], #' + CSS.escape(slug));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── After HTML is injected, stamp data-slug onto headings ──────
  React.useEffect(() => {
    if (!contentRef.current || !renderedHtml) return;
    const headings = contentRef.current.querySelectorAll('h1,h2,h3,h4,h5,h6');
    headings.forEach(h => {
      const slug = h.textContent.trim().toLowerCase().replace(/[^\w\s-]/g,'').replace(/\s+/g,'-').slice(0,60);
      h.setAttribute('data-slug', slug);
      h.id = slug;
    });
    // Trigger MathJax typesetting on the new content
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([contentRef.current]).catch(() => {});
    } else if (window.MathJax?.typeset) {
      try { window.MathJax.typeset([contentRef.current]); } catch {}
    }
  }, [renderedHtml]);

  const isLoading = loading || rendering;
  const bg      = lightMode ? '#ffffff' : 'var(--bg-base)';
  const fg      = lightMode ? '#1a1a2e' : 'var(--text-primary)';
  const surface = lightMode ? '#f4f6fa' : 'var(--bg-surface)';
  const border  = lightMode ? '#d0d7e2' : 'var(--border)';
  const muted   = lightMode ? '#666'    : 'var(--text-muted)';
  const accent  = 'var(--accent)';

  // Reader CSS — scoped to .ot-reader class
  const readerCss = `
    .ot-reader{font-family:${lightMode ? 'Georgia,serif' : 'var(--font-body)'};font-size:0.96rem;line-height:1.85;color:${fg}}
    .ot-reader h1,.ot-reader h2,.ot-reader h3,.ot-reader h4{margin:1.5em 0 0.5em;font-family:var(--font-display);color:${fg};scroll-margin-top:20px}
    .ot-reader h1{font-size:1.7rem;border-bottom:2px solid ${border};padding-bottom:0.3em}
    .ot-reader h2{font-size:1.3rem;border-bottom:1px solid ${border};padding-bottom:0.2em}
    .ot-reader h3{font-size:1.1rem}.ot-reader h4{font-size:1rem;font-weight:600}
    .ot-reader p{margin:0.7em 0}
    .ot-reader hr{border:none;border-top:2px solid ${border};margin:2em 0}
    .ot-reader ul,.ot-reader ol{margin:0.5em 0 0.8em 1.6em}.ot-reader li{margin-bottom:0.3em}
    .ot-reader blockquote{border-left:4px solid ${accent};margin:1em 0;padding:8px 16px;background:${lightMode ? '#fffbf0' : 'rgba(245,166,35,0.07)'};border-radius:0 8px 8px 0;color:${muted}}
    .ot-reader table{border-collapse:collapse;width:100%;margin:1em 0;font-size:0.9rem;overflow-x:auto;display:block}
    .ot-reader th,.ot-reader td{border:1px solid ${border};padding:8px 12px;text-align:left}
    .ot-reader th{background:${lightMode ? '#f0f4fa' : 'rgba(255,255,255,0.06)'};font-weight:600}
    .ot-reader tr:nth-child(even) td{background:${lightMode ? '#f8fafc' : 'rgba(255,255,255,0.03)'}}
    .ot-reader code{background:${lightMode ? '#f0f0f5' : 'rgba(255,255,255,0.1)'};padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:0.86em;color:${lightMode ? '#d63384' : '#e879a0'}}
    .ot-reader .ot-cw{position:relative;margin:1.2em 0}
    .ot-reader .ot-code-lang{position:absolute;top:8px;right:10px;font-family:var(--font-mono);font-size:11px;color:#aaa;background:#1e1e2e;padding:2px 6px;border-radius:4px}
    .ot-reader pre{background:${lightMode ? '#1e1e2e' : '#0d1117'};color:#c9d1d9;padding:16px;border-radius:8px;overflow-x:auto;margin:0;font-size:0.87rem;line-height:1.6}
    .ot-reader pre code{background:none;padding:0;color:#c9d1d9;font-size:1em}
    .ot-reader a{color:${accent};text-decoration:none}.ot-reader a:hover{text-decoration:underline}
    .ot-reader strong{font-weight:700}.ot-reader em{font-style:italic}
    .ot-reader img{max-width:100%;border-radius:6px;margin:0.5em 0}
    .ot-mermaid-wrap{background:${lightMode ? '#f8fafc' : 'rgba(255,255,255,0.04)'};border:1px solid ${border};border-radius:8px;padding:16px;margin:1.2em 0;text-align:center;overflow-x:auto}
  `;

  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', background:bg, color:fg }}>

      {/* ── Top bar ── */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 16px', borderBottom:'1px solid ' + border, background:surface, flexShrink:0 }}>
        <button
          onClick={onClose}
          style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 14px', background:'transparent', border:'1px solid ' + border, borderRadius:'8px', color:muted, fontSize:'0.85rem', cursor:'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = lightMode ? '#e8ecf2' : 'var(--bg-elevated)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >← Back</button>

        <span style={{ flex:1, fontWeight:600, fontSize:'0.88rem', color:fg, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {filename ? '📄 ' + filename : '📄 Markdown Viewer'}
        </span>

        {isLoading && (
          <span style={{ fontSize:'0.8rem', color:muted, display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ width:'12px', height:'12px', borderRadius:'50%', border:'2px solid ' + muted, borderTopColor:accent, display:'inline-block', animation:'spin 0.7s linear infinite' }} />
            {rendering ? 'Rendering...' : 'Opening...'}
          </span>
        )}

        <button
          onClick={() => setLightMode(m => !m)}
          style={{ padding:'6px 14px', background:'transparent', border:'1px solid ' + border, borderRadius:'8px', color:muted, fontSize:'0.82rem', cursor:'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = lightMode ? '#e8ecf2' : 'var(--bg-elevated)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >{lightMode ? '🌙 Dark' : '☀️ Light'}</button>

        <button
          onClick={handleOpen}
          disabled={isLoading}
          style={{ padding:'6px 18px', background: isLoading ? (lightMode?'#e8ecf2':'var(--bg-elevated)') : accent, border:'none', borderRadius:'8px', color: isLoading ? muted : '#fff', fontSize:'0.85rem', fontWeight:600, cursor: isLoading ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', gap:'6px' }}
        >📂 Open File</button>
      </div>

      {error && (
        <div style={{ padding:'10px 20px', background:'rgba(239,68,68,0.1)', borderBottom:'1px solid #ef4444', color:'#ef4444', fontSize:'0.82rem', flexShrink:0 }}>
          ❌ {error}
        </div>
      )}

      {/* ── Body: TOC + Content ── */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* TOC sidebar */}
        {renderedHtml && toc.length > 0 && (
          <div style={{ width:'230px', flexShrink:0, borderRight:'1px solid ' + border, background:surface, overflowY:'auto', padding:'16px 0' }}>
            <div style={{ padding:'0 16px 10px', fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:muted }}>
              Contents
            </div>
            {toc.map((item, i) => (
              <button key={i} onClick={() => scrollTo(item.slug)} style={{
                display:'block', width:'100%', textAlign:'left',
                padding:'4px ' + (item.level === 1 ? 14 : item.level === 2 ? 22 : 30) + 'px',
                background:'transparent', border:'none',
                fontSize: item.level === 1 ? '0.82rem' : '0.77rem',
                fontWeight: item.level === 1 ? 600 : 400,
                color: item.level === 1 ? fg : muted,
                cursor:'pointer', lineHeight:1.45,
                borderLeft: item.level === 1 ? '2px solid transparent' : 'none',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = accent; e.currentTarget.style.background = lightMode ? '#eef2fa' : 'var(--bg-elevated)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = item.level === 1 ? fg : muted; e.currentTarget.style.background = 'transparent'; }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        <div ref={contentRef} style={{ flex:1, overflowY:'auto', padding:'36px 52px' }}>
          <style>{readerCss}</style>

          {!renderedHtml && !isLoading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:'16px', color:muted }}>
              <span style={{ fontSize:'3rem' }}>📄</span>
              <div style={{ fontSize:'1.1rem', fontWeight:600, color:fg }}>No file open</div>
              <div style={{ fontSize:'0.85rem' }}>Click <strong>Open File</strong> to load a Markdown document</div>
              <button onClick={handleOpen} style={{ marginTop:'8px', padding:'10px 28px', background:accent, border:'none', borderRadius:'10px', color:'#fff', fontSize:'0.9rem', fontWeight:600, cursor:'pointer', boxShadow:'0 4px 12px var(--accent-glow)' }}>
                📂 Open Markdown File
              </button>
            </div>
          ) : (
            <div className="ot-reader" style={{ maxWidth:'800px', margin:'0 auto' }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Subject meta (dynamic) ────────────────────────────────────
function getSubjectMeta(subjectId, subjectsList) {
  const subject = subjectsList.find(s => s.id === subjectId);
  return subject || { id: subjectId, name: subjectId, shortName: subjectId, icon: '📚' };
}

// ── Subject switcher dropdown ─────────────────────────────────
function SubjectSwitcher({ activeSubject, enrolledSubjects, onSwitch, subjectsList }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const meta      = getSubjectMeta(activeSubject, subjectsList);
  const canSwitch = enrolledSubjects.length > 1;

  return (
    <div ref={ref} style={{ position: 'relative', WebkitAppRegion: 'no-drag' }}>
      <button
        onClick={() => canSwitch && setOpen(o => !o)}
        title={canSwitch ? 'Switch subject' : 'Enrol in more subjects in Settings → Profile'}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: '0.72rem',
          color:      open ? 'var(--accent)'      : 'var(--text-muted)',
          background: open ? 'var(--accent-soft)' : 'var(--bg-elevated)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          cursor: canSwitch ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
          fontFamily: 'var(--font-body)',
          whiteSpace: 'nowrap',
        }}
      >
        {meta.icon} {meta.name}
        {canSwitch && (
          <span style={{
            fontSize: '0.6rem', opacity: 0.7, display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}>▾</span>
        )}
      </button>

      {open && canSwitch && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          minWidth: '210px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 1000, overflow: 'hidden',
        }}>
          {enrolledSubjects.map(sid => {
            const m = getSubjectMeta(sid, subjectsList);
            const isActive = sid === activeSubject;
            return (
              <button
                key={sid}
                onClick={() => { setOpen(false); if (!isActive) onSwitch(sid); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', border: 'none',
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  color:      isActive ? 'var(--accent)'      : 'var(--text-secondary)',
                  fontSize: '0.8rem', fontWeight: isActive ? 600 : 400,
                  cursor: isActive ? 'default' : 'pointer',
                  textAlign: 'left', fontFamily: 'var(--font-body)',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '0.7rem', color: isActive ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }}>
                  {isActive ? '●' : '○'}
                </span>
                {m.icon} {m.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
function App() {
  const [view, setView]                   = useState('chat');
  const [viewerOpen, setViewerOpen]       = useState(false); // Markdown Viewer full-screen overlay
  const [studentModel, setModel]          = useState(null);
  const [appVersion, setVersion]          = useState('');
  const [mascotState, setMascot]          = useState('idle');
  const [, setTick]                       = useState(0); // forces 1-min countdown refresh
  const [activeSubject, setActiveSubject] = useState('maths-advanced');
  const [enrolledSubjects, setEnrolled]   = useState(['maths-advanced']);
  const [subjectsList, setSubjectsList]   = useState([]); // Dynamic subjects from backend

  // NEW: Teaching mode state for mascot
  const [teachingMode, setTeachingMode]   = useState('student-led');

  // Load student model, app info, subjects, and saved theme on mount
  useEffect(() => {
    Promise.all([
      ipc.invoke('student:model', { studentId: 'default' }).catch(() => null),
      ipc.invoke('config:get').catch(() => null),
      ipc.invoke('subject:list').catch(() => null),
      ipc.invoke('subject:info').catch(() => null),
      // NEW: Load teaching mode
      ipc.invoke('teaching:getCurrent', { studentId: 'default' }).catch(() => null),
    ]).then(([modelRes, configRes, subjectsRes, infoRes, teachingRes]) => {
      // Set student model
      setModel(modelRes?.studentModel || null);

      // Set app version and theme
      const cfg = configRes?.config || configRes;
      if (cfg?.version) setVersion(cfg.version);
      if (cfg?.theme && typeof cfg.theme === 'object' && cfg.theme.vars) {
        applyThemeVars(cfg.theme.vars);
      }

      // Set subjects list
      if (subjectsRes?.success && subjectsRes.subjects) {
        setSubjectsList(subjectsRes.subjects);
      }

      // Set active subject and enrolled subjects
      if (infoRes?.success) {
        if (infoRes.activeSubject) setActiveSubject(infoRes.activeSubject);
        if (infoRes.enrolledSubjects) setEnrolled(infoRes.enrolledSubjects);
      }

      // NEW: Set teaching mode
      if (teachingRes?.modelId) {
        setTeachingMode(teachingRes.modelId);
      }
    }).catch(err => console.error('[App] Failed to load initial data:', err));
  }, []);

  // Refresh countdown every 60 seconds
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Refresh student model whenever leaving any view (especially settings/profile)
  const handleNavChange = useCallback((id) => {
    setView(id);
    // Reload student model so name + examDate reflect latest saved profile
    ipc.invoke('student:model', { studentId: 'default' })
      .then(res => setModel(res?.studentModel || null))
      .catch(() => {});
    // Re-read enrolled subjects in case user saved changes in Profile settings
    ipc.invoke('subject:info')
      .then(res => { if (res?.enrolledSubjects) setEnrolled(res.enrolledSubjects); })
      .catch(() => {});
    // ===== FIXED: Refresh teaching mode when switching back to Chat =====
    // Settings may have changed the teaching mode while Chat was hidden.
    if (id === 'chat') {
      ipc.invoke('teaching:getCurrent', { studentId: 'default' })
        .then(res => { if (res?.modelId) setTeachingMode(res.modelId); })
        .catch(() => {});
    }
    // ===== END FIXED =====
  }, []);

  const handleSubjectSwitch = useCallback(async (subjectId) => {
    try {
      const res = await ipc.invoke('subject:switch', { subjectId });
      if (res?.success) {
        setActiveSubject(subjectId);
        // Clear the backend session so the coordinator starts fresh
        // with the new subject's knowledge base on the next chat turn.
        await ipc.invoke('chat:end-session', { studentId: 'default' }).catch(() => {});
      }
    } catch (e) {
      console.error('[App] Subject switch failed:', e.message);
    }
  }, []);

  // All panels are always mounted so their state (messages, scroll position, etc.)
  // survives tab switches. Inactive panels are hidden with display:none —
  // zero re-render cost and no unmount/remount of ChatWindow between navigation.
  const panelStyle = (id) => ({
    // Each panel fills the content area exactly using absolute positioning.
    // display:none hides inactive panels without unmounting them (preserves ChatWindow state).
    // position:relative is the anchor point for ChatWindow's position:absolute inset:0.
    display: view === id ? 'block' : 'none',
    position: 'absolute',
    inset: 0,
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      height: '100vh',
      background: 'var(--bg-deep)',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Animated starfield background */}
      <StarfieldCanvas />

      {/* Radial glow behind sidebar */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: '30%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle at 0% 50%, rgba(245,166,35,0.06), transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ── Title bar (electron draggable) ── */}
      <div style={{
        height: '38px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        WebkitAppRegion: 'drag',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* App name */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          WebkitAppRegion: 'no-drag',
        }}>
          <span style={{ fontSize: '1rem' }}>{teachingMode === 'teacher-led' ? '👩‍🏫' : '🦉'}</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '0.95rem',
            color: 'var(--text-primary)',
            letterSpacing: '0.01em',
          }}>
            OpenTutor {teachingMode === 'teacher-led' && '· Teacher Mode'}
          </span>
          {appVersion && (
            <span style={{
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              padding: '1px 5px',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
            }}>
              v{appVersion}
            </span>
          )}
        </div>

        {/* Centre: current view label */}
        <div style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          fontWeight: 500,
          WebkitAppRegion: 'drag',
        }}>
          {NAV_ITEMS.find(n => n.id === view)?.label || ''}
        </div>

        {/* Right: subject switcher dropdown */}
        <SubjectSwitcher
          activeSubject={activeSubject}
          enrolledSubjects={enrolledSubjects}
          onSwitch={handleSubjectSwitch}
          subjectsList={subjectsList}
        />
      </div>

      {/* ── Main layout: sidebar + content ── */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* ── Sidebar ── */}
        <div style={{
          width: '180px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '16px 10px',
          gap: '4px',
          overflowY: 'auto',
        }}>

          {/* Mascot */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0 16px',
          }}>
            <Mascot affectiveState={mascotState} />
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
            {NAV_ITEMS.map(item => (
              <NavButton
                key={item.id}
                item={item}
                isActive={view === item.id}
                onClick={handleNavChange}
              />
            ))}
          </div>

          {/* Exam countdown */}
          <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
            <ExamCountdown examDate={studentModel?.profile?.examDate} />
          </div>

          {/* Student name */}
          {studentModel?.profile?.name && studentModel.profile.name !== 'Student' && (
            <div style={{
              marginTop: '8px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              👤 {studentModel.profile.name}
            </div>
          )}
        </div>

        {/* ── Content area ── */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: 'var(--bg-base)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {/* All three panels stay mounted — display:none hides inactive ones.
              This preserves ChatWindow's message history across tab switches. */}
          <div style={panelStyle('chat')}>
            <ChatWindow
              activeSubject={activeSubject}
              subjectsList={subjectsList}
              // NEW: Pass teaching mode as prop
              teachingMode={teachingMode}
              onTeachingModeChange={setTeachingMode}
              // ===== FIXED: Tell ChatWindow when it becomes visible =====
              isVisible={view === 'chat'}
              // ===== END FIXED =====
            />
          </div>
          <div style={panelStyle('progress')}>
            <ProgressDashboard />
          </div>
          <div style={panelStyle('settings')}>
            <Settings
              subjectsList={subjectsList}
              onSubjectsChange={setEnrolled}
              // NEW: Pass teaching mode change handler
              onTeachingModeChange={setTeachingMode}
            />
          </div>
          <div style={panelStyle('tools')}>
            <ToolsPanel onOpenViewer={() => setViewerOpen(true)} />
          </div>

          {/* ── Markdown Viewer full-screen overlay ── */}
          {viewerOpen && (
            <div style={{ position:'absolute', inset:0, zIndex:50 }}>
              <MarkdownViewer onClose={() => setViewerOpen(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;