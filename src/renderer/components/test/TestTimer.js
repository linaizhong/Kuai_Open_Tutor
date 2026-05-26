// renderer/components/test/TestTimer.js
// Countdown timer for timed tests with visual warnings

import React, { useState, useEffect } from 'react';

function TestTimer({
  initialSeconds,
  onTimeUp,
  warningThreshold = 60, // Warn when 60 seconds remaining
  criticalThreshold = 30, // Critical when 30 seconds remaining
  autoStart = true,
  className = ''
}) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [hasWarned, setHasWarned] = useState(false);
  const [hasCriticallyWarned, setHasCriticallyWarned] = useState(false);

  useEffect(() => {
    let interval = null;

    if (isRunning && seconds > 0) {
      interval = setInterval(() => {
        setSeconds(prev => {
          const newSeconds = prev - 1;

          // Check warnings
          if (newSeconds <= warningThreshold && !hasWarned) {
            setHasWarned(true);
            // Optional: play sound or show notification
          }
          if (newSeconds <= criticalThreshold && !hasCriticallyWarned) {
            setHasCriticallyWarned(true);
          }

          return newSeconds;
        });
      }, 1000);
    } else if (seconds === 0 && isRunning) {
      setIsRunning(false);
      if (onTimeUp) onTimeUp();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, seconds, hasWarned, hasCriticallyWarned, warningThreshold, criticalThreshold, onTimeUp]);

  // Format time as MM:SS
  const formatTime = () => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine color based on time remaining
  const getColor = () => {
    if (seconds <= criticalThreshold) return 'var(--error)';
    if (seconds <= warningThreshold) return 'var(--warning)';
    return 'var(--text-secondary)';
  };

  // Calculate progress percentage
  const progress = (seconds / initialSeconds) * 100;

  return (
    <div className={`test-timer ${className}`} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 16px',
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-full)',
      border: `1px solid ${getColor()}44`,
    }}>
      {/* Timer icon */}
      <span style={{
        fontSize: '1rem',
        color: getColor(),
        animation: seconds <= criticalThreshold ? 'pulse 1s infinite' : 'none'
      }}>
        ⏱️
      </span>

      {/* Time display */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '1rem',
        fontWeight: 600,
        color: getColor(),
        minWidth: '60px',
        textAlign: 'center'
      }}>
        {formatTime()}
      </span>

      {/* Progress bar */}
      <div style={{
        width: '80px',
        height: '6px',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-full)',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: getColor(),
          transition: 'width 1s linear'
        }} />
      </div>

      {/* Control buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {isRunning ? (
          <button
            onClick={() => setIsRunning(false)}
            style={timerButtonStyle}
            title="Pause timer"
          >
            ⏸️
          </button>
        ) : (
          <button
            onClick={() => setIsRunning(true)}
            style={timerButtonStyle}
            title="Resume timer"
            disabled={seconds === 0}
          >
            ▶️
          </button>
        )}
        <button
          onClick={() => {
            setSeconds(initialSeconds);
            setIsRunning(false);
            setHasWarned(false);
            setHasCriticallyWarned(false);
          }}
          style={timerButtonStyle}
          title="Reset timer"
        >
          🔄
        </button>
      </div>
    </div>
  );
}

const timerButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: 'var(--radius-sm)',
  transition: 'all 0.2s ease',
};

export default TestTimer;