// Mascot.js
// Animated mascot component for OpenTutor.
// Responds to the student's affective state with different
// expressions, animations and motivational messages.

import React, { useState, useEffect, useCallback } from 'react';

// ── Mascot state definitions ──────────────────────────────────
const MASCOT_STATES = {
  idle: {
    emoji: '🦉',
    expression: '(◕‿◕)',
    label: 'Ready to help',
    colour: 'var(--accent)',
    messages: [
      "What shall we tackle today?",
      "Ask me anything about HSC Maths!",
      "Ready when you are ✨",
      "Let's make progress together!",
    ],
    animation: 'float',
  },
  thinking: {
    emoji: '🦉',
    expression: '(・・ )',
    label: 'Thinking...',
    colour: 'var(--teal)',
    messages: [
      "Let me work this out...",
      "Hmm, good question...",
      "Consulting my maths brain...",
      "One moment...",
    ],
    animation: 'pulse',
  },
  excited: {
    emoji: '🦉',
    expression: '(◉‿◉)',
    label: 'Excited!',
    colour: '#a78bfa',
    messages: [
      "Great question! I love this topic!",
      "Oh, this is a good one!",
      "Let's dive in! 🚀",
      "This is where it gets interesting!",
    ],
    animation: 'bounce',
  },
  encouraging: {
    emoji: '🦉',
    expression: '(ᵔ◡ᵔ)',
    label: 'Encouraging',
    colour: 'var(--success)',
    messages: [
      "You're doing really well!",
      "Don't give up — you've got this! 💪",
      "Every mistake is a step forward.",
      "Progress, not perfection!",
    ],
    animation: 'float',
  },
  frustrated: {
    emoji: '🦉',
    expression: '(>﹏<)',
    label: 'Sensing frustration',
    colour: 'var(--warning)',
    messages: [
      "This one is tough — let's slow down 🤝",
      "Let's try a different approach.",
      "Breaks help too — your brain is working!",
      "Let me explain this another way.",
    ],
    animation: 'wobble',
  },
  celebrating: {
    emoji: '🦉',
    expression: '(★‿★)',
    label: 'Celebrating!',
    colour: 'var(--accent)',
    messages: [
      "YES! You got it! 🎉",
      "Excellent work!!",
      "That's exactly right — brilliant!",
      "See? You had it in you all along! ⭐",
    ],
    animation: 'celebrate',
  },
  sleeping: {
    emoji: '🦉',
    expression: '(-_- )💤',
    label: 'Resting',
    colour: 'var(--text-muted)',
    messages: [
      "Zzz... I'm here when you need me.",
    ],
    animation: 'sleep',
  },
};

// ── CSS animations (injected once) ───────────────────────────
const ANIMATION_STYLES = `
  @keyframes mascot-float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-6px) rotate(2deg); }
  }
  @keyframes mascot-bounce {
    0%, 100% { transform: translateY(0) scale(1); }
    30%       { transform: translateY(-10px) scale(1.05); }
    60%       { transform: translateY(-4px) scale(1.02); }
  }
  @keyframes mascot-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%       { transform: scale(0.95); opacity: 0.8; }
  }
  @keyframes mascot-wobble {
    0%, 100% { transform: rotate(0deg); }
    20%       { transform: rotate(-8deg); }
    40%       { transform: rotate(8deg); }
    60%       { transform: rotate(-4deg); }
    80%       { transform: rotate(4deg); }
  }
  @keyframes mascot-celebrate {
    0%   { transform: scale(1) rotate(0deg); }
    15%  { transform: scale(1.2) rotate(-10deg); }
    30%  { transform: scale(1.1) rotate(10deg); }
    45%  { transform: scale(1.15) rotate(-5deg); }
    60%  { transform: scale(1.1) rotate(5deg); }
    75%  { transform: scale(1.05) rotate(-2deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  @keyframes mascot-sleep {
    0%, 100% { transform: translateY(0) rotate(-5deg); }
    50%       { transform: translateY(3px) rotate(-3deg); }
  }
  @keyframes particle-fly {
    0%   { transform: translate(0,0) scale(1); opacity: 1; }
    100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
  }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = ANIMATION_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

// ── Mascot component ─────────────────────────────────────────
function Mascot({ affectiveState = 'idle', isTyping = false, compact = false }) {
  const [currentState, setCurrentState] = useState('idle');
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [particles, setParticles] = useState([]);
  const messageTimerRef = React.useRef(null);

  useEffect(() => { injectStyles(); }, []);

  // Map affective state to mascot state
  useEffect(() => {
    const stateMap = {
      idle:        'idle',
      thinking:    'thinking',
      frustrated:  'frustrated',
      bored:       'frustrated',
      excited:     'excited',
      correct:     'celebrating',
      incorrect:   'encouraging',
      encouraging: 'encouraging',
      sleeping:    'sleeping',
    };
    const mapped = isTyping ? 'thinking' : (stateMap[affectiveState] || 'idle');
    setCurrentState(mapped);
  }, [affectiveState, isTyping]);

  // Show random message periodically
  useEffect(() => {
    const config = MASCOT_STATES[currentState];
    const msgs = config.messages;
    setMessage(msgs[Math.floor(Math.random() * msgs.length)]);

    if (currentState === 'celebrating') {
      spawnParticles();
      setShowMessage(true);
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = setTimeout(() => setShowMessage(false), 3500);
    } else if (currentState === 'encouraging' || currentState === 'excited') {
      setShowMessage(true);
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = setTimeout(() => setShowMessage(false), 4000);
    } else {
      setShowMessage(false);
    }
    return () => clearTimeout(messageTimerRef.current);
  }, [currentState]);

  const spawnParticles = useCallback(() => {
    const newParticles = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      emoji: ['⭐','✨','🎉','💫','🌟'][Math.floor(Math.random() * 5)],
      tx: `${(Math.random() - 0.5) * 80}px`,
      ty: `${-(Math.random() * 60 + 20)}px`,
      delay: `${Math.random() * 0.3}s`,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1200);
  }, []);

  const handleClick = useCallback(() => {
    const config = MASCOT_STATES[currentState];
    const msgs = config.messages;
    setMessage(msgs[Math.floor(Math.random() * msgs.length)]);
    setShowMessage(true);
    clearTimeout(messageTimerRef.current);
    messageTimerRef.current = setTimeout(() => setShowMessage(false), 3000);
  }, [currentState]);

  const config = MASCOT_STATES[currentState];
  const size = compact ? 40 : 56;
  const fontSize = compact ? '1.5rem' : '2rem';

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
      }}
      onClick={handleClick}
      title={config.label}
    >
      {/* Particles */}
      {particles.map(p => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            fontSize: '0.9rem',
            pointerEvents: 'none',
            animation: `particle-fly 0.9s ${p.delay} ease-out both`,
            '--tx': p.tx,
            '--ty': p.ty,
            zIndex: 10,
          }}
        >
          {p.emoji}
        </span>
      ))}

      {/* Glow ring */}
      <div style={{
        width: size + 16,
        height: size + 16,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${config.colour}22, transparent 70%)`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        transition: 'background 0.5s ease',
        pointerEvents: 'none',
      }} />

      {/* Mascot emoji */}
      <div style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        animation: `mascot-${config.animation} ${
          config.animation === 'float' ? '3s' :
          config.animation === 'bounce' ? '0.6s' :
          config.animation === 'pulse' ? '1.2s' :
          config.animation === 'wobble' ? '0.7s' :
          config.animation === 'celebrate' ? '0.8s' :
          '4s'
        } ease-in-out infinite`,
        filter: `drop-shadow(0 0 8px ${config.colour}66)`,
        transition: 'filter 0.5s ease',
        position: 'relative',
        zIndex: 1,
        lineHeight: 1,
      }}>
        {config.emoji}
      </div>

      {/* Message bubble */}
      {showMessage && !compact && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-elevated)',
          border: `1px solid ${config.colour}44`,
          borderRadius: '12px 12px 12px 4px',
          padding: '8px 14px',
          fontSize: '0.8rem',
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-md)',
          animation: 'slideDown 0.2s ease both',
          zIndex: 20,
          maxWidth: '200px',
          whiteSpace: 'normal',
          textAlign: 'center',
          lineHeight: 1.4,
        }}>
          {message}
          <div style={{
            position: 'absolute',
            bottom: '-5px',
            left: '20px',
            width: '8px',
            height: '8px',
            background: 'var(--bg-elevated)',
            border: `0 solid transparent`,
            borderRight: `1px solid ${config.colour}44`,
            borderBottom: `1px solid ${config.colour}44`,
            transform: 'rotate(45deg)',
          }} />
        </div>
      )}

      {/* Expression label (non-compact) */}
      {!compact && (
        <span style={{
          fontSize: '0.65rem',
          color: config.colour,
          fontFamily: 'var(--font-mono)',
          opacity: 0.7,
          letterSpacing: '0.02em',
          transition: 'color 0.5s ease',
          userSelect: 'none',
        }}>
          {config.expression}
        </span>
      )}
    </div>
  );
}

export default Mascot;