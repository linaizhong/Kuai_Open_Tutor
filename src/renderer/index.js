// renderer/index.js
// Renderer process entry point.
// Bootstraps React, imports the global theme, and mounts the App.

import React from 'react';
import { createRoot } from 'react-dom/client';

import './styles/cute-theme.css';
import App from './App';

// ── Mount ─────────────────────────────────────────────────────
const container = document.getElementById('root');

if (!container) {
  console.error(
    '[OpenTutor] Could not find #root element. ' +
    'Make sure index.html contains <div id="root"></div>.'
  );
} else {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}