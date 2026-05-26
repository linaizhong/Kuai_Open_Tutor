// ActionButtons.js
// Self-contained action button components rendered inside assistant message bubbles:
//   CopyButton  — copies plain-text content to clipboard
//   TTSButton   — text-to-speech playback with voice picker
//   ExportButton — exports response as .md or .html to Downloads

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ipc from '../ipc';

// ── Copy to Clipboard Button ──────────────────────────────────
export function CopyButton({ content }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!content) return;
    // Strip markdown formatting for clean plain-text copy
    const plain = content
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    navigator.clipboard.writeText(plain).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for environments without clipboard API
      const ta = document.createElement('textarea');
      ta.value = plain;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      style={{
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 6,
        color: copied ? 'var(--accent)' : 'var(--text-muted)',
        cursor: 'pointer',
        padding: '3px 6px',
        fontSize: '0.75rem',
        lineHeight: 1,
        transition: 'all 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
      onMouseEnter={e => {
        if (!copied) {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
      onMouseLeave={e => {
        if (!copied) {
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-muted)';
        }
      }}
    >
      {copied ? '✓' : '⎘'}
      <span style={{ fontSize: '0.7rem' }}>
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  );
}

// ── Text-to-Speech Component ──────────────────────────────────
export function TTSButton({ content, className }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);

  const utteranceRef = useRef(null);
  const buttonRef = useRef(null);

  // Check if speech synthesis is supported
  useEffect(() => {
    if (!window.speechSynthesis) {
      setIsSupported(false);
      return;
    }

    // Load available voices
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      // Filter for English voices (prefer Australian if available)
      const englishVoices = availableVoices.filter(v =>
        v.lang.startsWith('en-') || v.lang.startsWith('en')
      );

      // Try to find an Australian voice first, then fall back to other English voices
      const auVoice = englishVoices.find(v => v.lang === 'en-AU');
      const ukVoice = englishVoices.find(v => v.lang === 'en-GB');
      const usVoice = englishVoices.find(v => v.lang === 'en-US');

      setVoices(englishVoices);
      setSelectedVoice(auVoice || ukVoice || usVoice || englishVoices[0] || null);
    };

    loadVoices();

    // Chrome loads voices asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      // Clean up: cancel any ongoing speech when component unmounts
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Clean up text for TTS (remove markdown, LaTeX, etc.)
  const cleanTextForTTS = (text) => {
    if (!text) return '';

    return text
      // Remove LaTeX delimiters
      .replace(/\\\(/g, '')
      .replace(/\\\)/g, '')
      .replace(/\\\[/g, '')
      .replace(/\\\]/g, '')
      .replace(/\$\$/g, '')
      .replace(/\$/g, '')
      // Remove markdown formatting
      .replace(/#{1,6}\s+/g, '') // Headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
      .replace(/\*([^*]+)\*/g, '$1') // Italic
      .replace(/`([^`]+)`/g, '$1') // Inline code
      .replace(/```[\s\S]*?```/g, '(code block)') // Code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      // Replace common math symbols with words
      .replace(/≈/g, 'approximately')
      .replace(/≠/g, 'not equal to')
      .replace(/≤/g, 'less than or equal to')
      .replace(/≥/g, 'greater than or equal to')
      .replace(/×/g, 'times')
      .replace(/÷/g, 'divided by')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'square root of')
      .replace(/∞/g, 'infinity')
      .replace(/∑/g, 'sum')
      .replace(/∫/g, 'integral')
      .replace(/∂/g, 'partial derivative')
      .replace(/Δ/g, 'delta')
      .replace(/θ/g, 'theta')
      .replace(/λ/g, 'lambda')
      // Handle common LaTeX commands
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2')
      .replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1')
      .replace(/\\sin/g, 'sine')
      .replace(/\\cos/g, 'cosine')
      .replace(/\\tan/g, 'tangent')
      .replace(/\\log/g, 'log')
      .replace(/\\ln/g, 'natural log')
      .replace(/\\lim/g, 'limit')
      .replace(/\\to/g, 'to')
      .replace(/\\infty/g, 'infinity')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  };

  const stopSpeech = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, []);

  const pauseSpeech = useCallback(() => {
    if (window.speechSynthesis && isPlaying) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isPlaying]);

  const resumeSpeech = useCallback(() => {
    if (window.speechSynthesis && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isPaused]);

  const togglePlay = useCallback(() => {
    if (!isSupported) return;

    if (isPlaying) {
      if (isPaused) {
        resumeSpeech();
      } else {
        pauseSpeech();
      }
    } else {
      // Start new speech
      stopSpeech(); // Cancel any ongoing speech

      const cleanedText = cleanTextForTTS(content);
      if (!cleanedText) return;

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utteranceRef.current = utterance;

      // Set voice if selected
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Set speech properties for better math/science explanations
      utterance.rate = 0.9; // Slightly slower for technical content
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Event handlers
      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
        utteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        console.error('TTS error:', event);
        setIsPlaying(false);
        setIsPaused(false);
        utteranceRef.current = null;
      };

      utterance.onpause = () => {
        setIsPaused(true);
      };

      utterance.onresume = () => {
        setIsPaused(false);
      };

      window.speechSynthesis.speak(utterance);
    }
  }, [content, isPlaying, isPaused, selectedVoice, isSupported, pauseSpeech, resumeSpeech, stopSpeech]);

  const changeVoice = useCallback((voice) => {
    setSelectedVoice(voice);
    setShowVoiceMenu(false);

    // If currently playing, restart with new voice
    if (isPlaying) {
      stopSpeech();
      // Small delay to ensure clean restart
      setTimeout(() => togglePlay(), 50);
    }
  }, [isPlaying, stopSpeech, togglePlay]);

  if (!isSupported) {
    return (
      <button
        disabled
        title="Text-to-speech not supported in this browser"
        style={{
          background: 'transparent',
          border: '1px solid transparent',
          borderRadius: 6,
          color: 'var(--text-muted)',
          padding: '3px 6px',
          fontSize: '0.75rem',
          opacity: 0.5,
          cursor: 'not-allowed',
        }}
      >
        🔊
      </button>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={buttonRef}>
      {/* Main TTS button */}
      <button
        className={className}
        onClick={togglePlay}
        title={isPlaying ? (isPaused ? 'Resume' : 'Pause') : 'Read aloud'}
        style={{
          background: 'transparent',
          border: '1px solid transparent',
          borderRadius: 6,
          color: isPlaying
            ? (isPaused ? 'var(--accent)' : '#ffaa00')
            : 'var(--text-muted)',
          cursor: 'pointer',
          padding: '3px 6px',
          fontSize: '0.75rem',
          lineHeight: 1,
          transition: 'all 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
        onMouseEnter={e => {
          if (!isPlaying) {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }
        }}
        onMouseLeave={e => {
          if (!isPlaying) {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }
        }}
      >
        {isPlaying ? (isPaused ? '⏸️' : '⏸️') : '🔊'}
        <span style={{ fontSize: '0.7rem' }}>
          {isPlaying ? (isPaused ? 'Paused' : 'Playing') : 'Listen'}
        </span>
        {!isPlaying && voices.length > 0 && (
          <span
            onClick={e => { e.stopPropagation(); setShowVoiceMenu(v => !v); }}
            title="Change voice"
            style={{
              fontSize: '0.6rem',
              color: 'var(--text-muted)',
              lineHeight: 1,
              cursor: 'pointer',
              paddingLeft: 2,
            }}
          >
            ▼
          </span>
        )}
      </button>

      {/* Voice selection dropdown */}
      {showVoiceMenu && (
        <>
          <div
            onClick={() => setShowVoiceMenu(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 99,
            }}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-bright)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-md)',
            zIndex: 100,
            minWidth: 220,
            maxHeight: 300,
            overflowY: 'auto',
          }}>
            {voices.map((voice, index) => (
              <button
                key={index}
                onClick={() => changeVoice(voice)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: selectedVoice === voice ? 'var(--bg-hover)' : 'none',
                  border: 'none',
                  padding: '8px 14px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  borderBottom: index < voices.length - 1 ? '1px solid var(--border)' : 'none',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => {
                  if (selectedVoice !== voice) {
                    e.currentTarget.style.background = 'none';
                  }
                }}
              >
                {voice.name} ({voice.lang})
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Export button ─────────────────────────────────────────────
export function ExportButton({ content }) {
  const [open,    setOpen]    = useState(false);
  const [status,  setStatus]  = useState(null); // null | 'saving' | 'done' | 'error'
  const [savedAs, setSavedAs] = useState('');

  const doExport = async (format) => {
    setOpen(false);
    setStatus('saving');
    // Generate a filename from the first ~8 words of the response
    const words  = content.trim().replace(/[#*`_]/g, '').split(/\s+/).slice(0, 8).join(' ');
    const base   = words || 'response';
    try {
      const res = await ipc.invoke('export:response', { content, format, filename: base });
      if (res?.success) {
        setSavedAs(res.filename);
        setStatus('done');
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus(null), 3000);
      }
    } catch {
      setStatus('error');
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Export response"
        style={{
          background:   'transparent',
          border:       '1px solid transparent',
          borderRadius: 6,
          color:        status === 'done'  ? 'var(--accent)'
                      : status === 'error' ? '#ff6666'
                      : 'var(--text-muted)',
          cursor:       'pointer',
          padding:      '3px 6px',
          fontSize:     '0.75rem',
          lineHeight:   1,
          transition:   'all 0.15s ease',
          display:      'flex',
          alignItems:   'center',
          gap:          4,
        }}
        onMouseEnter={e => {
          if (!status) {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }
        }}
        onMouseLeave={e => {
          if (!status) {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }
        }}
      >
        {status === 'saving' ? '⏳' : status === 'done' ? '✓' : status === 'error' ? '✗' : '↓'}
        <span style={{ fontSize: '0.7rem' }}>
          {status === 'done'  ? savedAs.slice(0, 28) + (savedAs.length > 28 ? '…' : '')
         : status === 'error' ? 'Failed'
         : status === 'saving'? 'Saving…'
         : 'Export'}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Click-away backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 99,
            }}
          />
          <div style={{
            position:     'absolute',
            top:          '100%',
            right:        0,
            marginTop:    4,
            background:   'var(--bg-elevated)',
            border:       '1px solid var(--border-bright)',
            borderRadius: 10,
            boxShadow:    'var(--shadow-md)',
            zIndex:       100,
            minWidth:     140,
            overflow:     'hidden',
          }}>
            {[
              { fmt: 'md',   icon: '📄', label: 'Markdown (.md)' },
              { fmt: 'html', icon: '🌐', label: 'HTML (.html)'    },
            ].map(({ fmt, icon, label }) => (
              <button
                key={fmt}
                onClick={() => doExport(fmt)}
                style={{
                  display:    'block',
                  width:      '100%',
                  textAlign:  'left',
                  background: 'none',
                  border:     'none',
                  padding:    '9px 14px',
                  fontSize:   '0.8rem',
                  color:      'var(--text-secondary)',
                  cursor:     'pointer',
                  transition: 'background 0.1s',
                  alignItems: 'center',
                  gap:        8,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}