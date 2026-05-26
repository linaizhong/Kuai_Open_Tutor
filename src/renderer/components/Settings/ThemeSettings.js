// ThemeSettings.js
// Dynamic theme configuration panel.
// Applies CSS variable overrides to :root in real-time and persists
// the chosen theme to user-config.json via config:save.

import React, { useState, useEffect, useCallback } from 'react';
import ipc from '../../ipc';

// ── Theme presets ─────────────────────────────────────────────
// Each preset defines the full set of overridable CSS variables.
const PRESETS = [

  // ── COLOURED BACKGROUND THEMES ───────────────────────────────
  // Rich, professional backgrounds that are neither dark nor white

  {
    id: 'monday-blue',
    label: 'Monday Blue',
    emoji: '💙',
    description: 'Deep navy blue inspired by Monday.com — professional and focused',
    vars: {
      '--bg-deep':        '#0f1729',   // Very deep navy
      '--bg-base':        '#151e33',   // Main canvas — rich navy
      '--bg-surface':     '#1c2840',   // Cards and panels
      '--bg-elevated':    '#243050',   // Elevated elements
      '--bg-hover':       '#2c3a60',   // Hover state
      '--accent':         '#00c875',   // Monday.com signature green
      '--accent-dim':     '#00a65e',
      '--accent-soft':    '#00c87520',
      '--accent-glow':    '#00c87540',
      '--text-primary':   '#ffffff',   // Pure white on deep navy
      '--text-secondary': '#b8c8e8',   // Soft blue-white
      '--text-muted':     '#7090b8',   // Muted blue-grey
      '--text-accent':    '#00c875',
      '--border':         '#2a3d5e',   // Subtle navy border
      '--border-bright':  '#3a5080',
      '--btn-text':       '#ffffff',
    },
  },

  {
    id: 'teal-studio',
    label: 'Teal Studio',
    emoji: '🦚',
    description: 'Deep teal canvas — rich, sophisticated, and calming for long sessions',
    vars: {
      '--bg-deep':        '#0a1f1e',   // Very deep teal
      '--bg-base':        '#0f2928',   // Main canvas
      '--bg-surface':     '#163635',   // Cards
      '--bg-elevated':    '#1d4544',   // Panels
      '--bg-hover':       '#255554',
      '--accent':         '#2dd4bf',   // Bright teal accent
      '--accent-dim':     '#14b8a6',
      '--accent-soft':    '#2dd4bf20',
      '--accent-glow':    '#2dd4bf40',
      '--text-primary':   '#f0fffe',   // Warm white
      '--text-secondary': '#a8ddd8',   // Light aqua
      '--text-muted':     '#5fa8a0',   // Muted teal
      '--text-accent':    '#2dd4bf',
      '--border':         '#1e4a48',
      '--border-bright':  '#2d6460',
      '--btn-text':       '#0a1f1e',
    },
  },

  {
    id: 'terracotta',
    label: 'Terracotta',
    emoji: '🏺',
    description: 'Warm terracotta clay — earthy, grounded, and beautifully unique',
    vars: {
      '--bg-deep':        '#1e0f08',   // Dark clay
      '--bg-base':        '#2a1610',   // Main canvas — rich terracotta
      '--bg-surface':     '#351c14',
      '--bg-elevated':    '#42231a',
      '--bg-hover':       '#502c20',
      '--accent':         '#fb923c',   // Warm orange accent
      '--accent-dim':     '#f97316',
      '--accent-soft':    '#fb923c20',
      '--accent-glow':    '#fb923c40',
      '--text-primary':   '#fff7f0',   // Warm white
      '--text-secondary': '#f0c8a0',   // Warm cream
      '--text-muted':     '#b07850',   // Warm muted brown
      '--text-accent':    '#fb923c',
      '--border':         '#5a3020',
      '--border-bright':  '#784030',
      '--btn-text':       '#1e0f08',
    },
  },

  {
    id: 'slate-blue',
    label: 'Slate Blue',
    emoji: '🔵',
    description: 'Medium slate blue — the perfect balance between dark and bright, professional and calm',
    vars: {
      '--bg-deep':        '#1e2a3a',   // Deep slate blue
      '--bg-base':        '#263548',   // Main canvas
      '--bg-surface':     '#304258',   // Cards
      '--bg-elevated':    '#3b5068',   // Panels
      '--bg-hover':       '#476078',
      '--accent':         '#60a5fa',   // Sky blue accent
      '--accent-dim':     '#3b82f6',
      '--accent-soft':    '#60a5fa20',
      '--accent-glow':    '#60a5fa40',
      '--text-primary':   '#f0f8ff',   // Alice blue white
      '--text-secondary': '#b0c8e0',   // Slate blue-white
      '--text-muted':     '#7090b0',   // Muted slate
      '--text-accent':    '#60a5fa',
      '--border':         '#3a5068',
      '--border-bright':  '#4e6880',
      '--btn-text':       '#1e2a3a',
    },
  },

  {
    id: 'mauve',
    label: 'Mauve',
    emoji: '💜',
    description: 'Dusty mauve purple — sophisticated, warm, and distinctly elegant',
    vars: {
      '--bg-deep':        '#1a1020',   // Deep dusty purple
      '--bg-base':        '#221530',   // Main canvas
      '--bg-surface':     '#2c1c3e',   // Cards
      '--bg-elevated':    '#37244c',   // Panels
      '--bg-hover':       '#432d5c',
      '--accent':         '#c084fc',   // Soft purple accent
      '--accent-dim':     '#a855f7',
      '--accent-soft':    '#c084fc20',
      '--accent-glow':    '#c084fc40',
      '--text-primary':   '#fdf4ff',   // Warm white-purple
      '--text-secondary': '#ddb8f8',   // Light lavender
      '--text-muted':     '#9868c0',   // Muted purple
      '--text-accent':    '#c084fc',
      '--border':         '#3c2858',
      '--border-bright':  '#553878',
      '--btn-text':       '#1a1020',
    },
  },

  {
    id: 'burgundy',
    label: 'Burgundy',
    emoji: '🍷',
    description: 'Deep wine burgundy — rich, classic, and supremely professional',
    vars: {
      '--bg-deep':        '#180810',   // Very deep wine
      '--bg-base':        '#220e18',   // Main canvas
      '--bg-surface':     '#2c1222',   // Cards
      '--bg-elevated':    '#38182c',   // Panels
      '--bg-hover':       '#451f37',
      '--accent':         '#f472b6',   // Hot pink accent — pops against burgundy
      '--accent-dim':     '#ec4899',
      '--accent-soft':    '#f472b620',
      '--accent-glow':    '#f472b640',
      '--text-primary':   '#fff0f8',   // Warm white-pink
      '--text-secondary': '#f0b8d8',   // Light pink-white
      '--text-muted':     '#a86888',   // Muted rose
      '--text-accent':    '#f472b6',
      '--border':         '#481828',
      '--border-bright':  '#642438',
      '--btn-text':       '#180810',
    },
  },

  {
    id: 'olive',
    label: 'Olive',
    emoji: '🫒',
    description: 'Rich warm olive — earthy Mediterranean tone, sophisticated and grounding',
    vars: {
      '--bg-deep':        '#141800',   // Deep olive
      '--bg-base':        '#1c2204',   // Main canvas
      '--bg-surface':     '#252d08',   // Cards
      '--bg-elevated':    '#2f380e',   // Panels
      '--bg-hover':       '#3a4516',
      '--accent':         '#a3e635',   // Lime green accent
      '--accent-dim':     '#84cc16',
      '--accent-soft':    '#a3e63520',
      '--accent-glow':    '#a3e63540',
      '--text-primary':   '#f8ffe0',   // Warm yellow-white
      '--text-secondary': '#d8e8a0',   // Pale lime
      '--text-muted':     '#8a9c40',   // Muted olive
      '--text-accent':    '#a3e635',
      '--border':         '#3a4818',
      '--border-bright':  '#506028',
      '--btn-text':       '#141800',
    },
  },

  {
    id: 'dusk',
    label: 'Dusk',
    emoji: '🌇',
    description: 'Warm indigo dusk — a rich coloured background that feels like golden hour',
    vars: {
      '--bg-deep':        '#0e0c28',   // Deep indigo
      '--bg-base':        '#161440',   // Main canvas — rich indigo
      '--bg-surface':     '#1e1c52',   // Cards
      '--bg-elevated':    '#272464',   // Panels
      '--bg-hover':       '#322e78',
      '--accent':         '#fbbf24',   // Golden amber accent
      '--accent-dim':     '#f59e0b',
      '--accent-soft':    '#fbbf2420',
      '--accent-glow':    '#fbbf2440',
      '--text-primary':   '#fffbf0',   // Warm white-gold
      '--text-secondary': '#f0e0b0',   // Pale gold
      '--text-muted':     '#a090c0',   // Muted indigo
      '--text-accent':    '#fbbf24',
      '--border':         '#302870',
      '--border-bright':  '#443c90',
      '--btn-text':       '#0e0c28',
    },
  },

  {
    id: 'copper',
    label: 'Copper',
    emoji: '🟤',
    description: 'Dark steel with warm copper highlights — industrial elegance',
    vars: {
      '--bg-deep':        '#0e0e10',   // Near-black steel
      '--bg-base':        '#161618',   // Dark steel canvas
      '--bg-surface':     '#1e1e22',
      '--bg-elevated':    '#28282e',
      '--bg-hover':       '#333338',
      '--accent':         '#f0883e',   // Copper orange
      '--accent-dim':     '#d46c28',
      '--accent-soft':    '#f0883e20',
      '--accent-glow':    '#f0883e40',
      '--text-primary':   '#faf5f0',   // Warm off-white
      '--text-secondary': '#e0c8b0',   // Warm cream
      '--text-muted':     '#907060',   // Warm muted
      '--text-accent':    '#f0883e',
      '--border':         '#343030',
      '--border-bright':  '#504840',
      '--btn-text':       '#0e0e10',
    },
  },

  {
    id: 'sapphire',
    label: 'Sapphire',
    emoji: '💎',
    description: 'Deep royal blue — gem-like richness, ultra-professional and striking',
    vars: {
      '--bg-deep':        '#030d24',   // Gem-deep navy
      '--bg-base':        '#061530',   // Rich sapphire canvas
      '--bg-surface':     '#0c2040',   // Cards
      '--bg-elevated':    '#132c52',   // Panels
      '--bg-hover':       '#1c3868',
      '--accent':         '#38bdf8',   // Sky blue accent
      '--accent-dim':     '#0ea5e9',
      '--accent-soft':    '#38bdf820',
      '--accent-glow':    '#38bdf840',
      '--text-primary':   '#f0f8ff',   // Alice blue white
      '--text-secondary': '#a8d4f8',   // Light sapphire
      '--text-muted':     '#5888b8',   // Muted blue
      '--text-accent':    '#38bdf8',
      '--border':         '#0f2848',
      '--border-bright':  '#1a3c60',
      '--btn-text':       '#030d24',
    },
  },

  // ── REFINED DARK THEMES ───────────────────────────────────────

  {
    id: 'midnight',
    label: 'Midnight',
    emoji: '🌑',
    description: 'Deep navy with warm amber — the original refined dark',
    vars: {
      '--bg-deep':        '#0d1117',
      '--bg-base':        '#131920',
      '--bg-surface':     '#1a2332',
      '--bg-elevated':    '#1f2d3d',
      '--bg-hover':       '#243347',
      '--accent':         '#f5a623',
      '--accent-dim':     '#c4821a',
      '--accent-soft':    '#f5a62322',
      '--accent-glow':    '#f5a62344',
      '--text-primary':   '#f0f4f8',
      '--text-secondary': '#b8ccdf',
      '--text-muted':     '#7a9ab5',
      '--text-accent':    '#f5a623',
      '--border':         '#2d4060',
      '--border-bright':  '#3d5478',
      '--btn-text':       '#0d1117',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    emoji: '🌲',
    description: 'Deep forest green — calm, natural, and focused',
    vars: {
      '--bg-deep':        '#0d1a12',
      '--bg-base':        '#121f17',
      '--bg-surface':     '#182b1f',
      '--bg-elevated':    '#1e3326',
      '--bg-hover':       '#243d2c',
      '--accent':         '#4ade80',
      '--accent-dim':     '#22c55e',
      '--accent-soft':    '#4ade8022',
      '--accent-glow':    '#4ade8044',
      '--text-primary':   '#edfaf2',
      '--text-secondary': '#a8d8b8',
      '--text-muted':     '#6aaa80',
      '--text-accent':    '#4ade80',
      '--border':         '#2d5239',
      '--border-bright':  '#3d6b4c',
      '--btn-text':       '#0d1117',
    },
  },
  {
    id: 'rose',
    label: 'Rose',
    emoji: '🌸',
    description: 'Warm dark rose — romantic and focused',
    vars: {
      '--bg-deep':        '#1a0d12',
      '--bg-base':        '#201218',
      '--bg-surface':     '#2d1820',
      '--bg-elevated':    '#371e28',
      '--bg-hover':       '#422430',
      '--accent':         '#fb7185',
      '--accent-dim':     '#f43f5e',
      '--accent-soft':    '#fb718522',
      '--accent-glow':    '#fb718544',
      '--text-primary':   '#fdf0f2',
      '--text-secondary': '#e8a8b4',
      '--text-muted':     '#c07888',
      '--text-accent':    '#fb7185',
      '--border':         '#522d3c',
      '--border-bright':  '#6e3d50',
      '--btn-text':       '#0d1117',
    },
  },
  {
    id: 'nord',
    label: 'Nord',
    emoji: '❄️',
    description: 'Arctic cool grey-blue — the classic dark theme',
    vars: {
      '--bg-deep':        '#1f2430',
      '--bg-base':        '#242936',
      '--bg-surface':     '#2e3440',
      '--bg-elevated':    '#3b4252',
      '--bg-hover':       '#434c5e',
      '--accent':         '#88c0d0',
      '--accent-dim':     '#5e81ac',
      '--accent-soft':    '#88c0d022',
      '--accent-glow':    '#88c0d044',
      '--text-primary':   '#f0f4f8',
      '--text-secondary': '#c8d4e0',
      '--text-muted':     '#8fa0b4',
      '--text-accent':    '#88c0d0',
      '--border':         '#4c566a',
      '--border-bright':  '#606c80',
      '--btn-text':       '#0d1117',
    },
  },
  {
    id: 'aurora',
    label: 'Aurora',
    emoji: '🌌',
    description: 'Deep cosmic purple — northern lights atmosphere',
    vars: {
      '--bg-deep':        '#0a0714',
      '--bg-base':        '#0f0c1d',
      '--bg-surface':     '#161128',
      '--bg-elevated':    '#1e1838',
      '--bg-hover':       '#271f48',
      '--accent':         '#7c3aed',
      '--accent-dim':     '#6d28d9',
      '--accent-soft':    '#7c3aed22',
      '--accent-glow':    '#7c3aed44',
      '--text-primary':   '#f0ebff',
      '--text-secondary': '#c4b5fd',
      '--text-muted':     '#8b76c8',
      '--text-accent':    '#7c3aed',
      '--border':         '#2d2060',
      '--border-bright':  '#4a3a8a',
      '--btn-text':       '#ffffff',
    },
  },
  {
    id: 'obsidian',
    label: 'Obsidian',
    emoji: '🖤',
    description: 'True black OLED with electric cyan — ultra-high contrast',
    vars: {
      '--bg-deep':        '#000000',
      '--bg-base':        '#080808',
      '--bg-surface':     '#101010',
      '--bg-elevated':    '#181818',
      '--bg-hover':       '#222222',
      '--accent':         '#00d4ff',
      '--accent-dim':     '#00a8cc',
      '--accent-soft':    '#00d4ff22',
      '--accent-glow':    '#00d4ff44',
      '--text-primary':   '#f8f8f8',
      '--text-secondary': '#c0c0c0',
      '--text-muted':     '#787878',
      '--text-accent':    '#00d4ff',
      '--border':         '#282828',
      '--border-bright':  '#383838',
      '--btn-text':       '#000000',
    },
  },
  {
    id: 'ember',
    label: 'Ember',
    emoji: '🔥',
    description: 'Dark charcoal with smouldering amber — warm, intense',
    vars: {
      '--bg-deep':        '#0f0a00',
      '--bg-base':        '#161005',
      '--bg-surface':     '#1f170a',
      '--bg-elevated':    '#281e10',
      '--bg-hover':       '#342716',
      '--accent':         '#f97316',
      '--accent-dim':     '#ea6c0a',
      '--accent-soft':    '#f9731622',
      '--accent-glow':    '#f9731644',
      '--text-primary':   '#fdf4e7',
      '--text-secondary': '#f0d4a8',
      '--text-muted':     '#b88c50',
      '--text-accent':    '#f97316',
      '--border':         '#3d2c10',
      '--border-bright':  '#5a4020',
      '--btn-text':       '#0f0a00',
    },
  },
  {
    id: 'espresso',
    label: 'Espresso',
    emoji: '☕',
    description: 'Rich warm brown with cream — cosy coffeehouse aesthetic',
    vars: {
      '--bg-deep':        '#120b04',
      '--bg-base':        '#1a1008',
      '--bg-surface':     '#231610',
      '--bg-elevated':    '#2e1e14',
      '--bg-hover':       '#3a261a',
      '--accent':         '#d97706',
      '--accent-dim':     '#b45309',
      '--accent-soft':    '#d9770622',
      '--accent-glow':    '#d9770644',
      '--text-primary':   '#fef3e2',
      '--text-secondary': '#f0d8b0',
      '--text-muted':     '#c09060',
      '--text-accent':    '#d97706',
      '--border':         '#3e2a18',
      '--border-bright':  '#5a3e28',
      '--btn-text':       '#120b04',
    },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    emoji: '🩶',
    description: 'Pure neutral grey with gold — minimalist and professional',
    vars: {
      '--bg-deep':        '#111111',
      '--bg-base':        '#191919',
      '--bg-surface':     '#212121',
      '--bg-elevated':    '#2a2a2a',
      '--bg-hover':       '#333333',
      '--accent':         '#e4b429',
      '--accent-dim':     '#c49a1a',
      '--accent-soft':    '#e4b42922',
      '--accent-glow':    '#e4b42944',
      '--text-primary':   '#f5f5f5',
      '--text-secondary': '#c8c8c8',
      '--text-muted':     '#888888',
      '--text-accent':    '#e4b429',
      '--border':         '#333333',
      '--border-bright':  '#484848',
      '--btn-text':       '#111111',
    },
  },
  {
    id: 'twilight',
    label: 'Twilight',
    emoji: '🌅',
    description: 'Warm dusk purples and peach gold — atmospheric evening study',
    vars: {
      '--bg-deep':        '#12091f',
      '--bg-base':        '#180d28',
      '--bg-surface':     '#211438',
      '--bg-elevated':    '#2b1c48',
      '--bg-hover':       '#36245a',
      '--accent':         '#fb923c',
      '--accent-dim':     '#f97316',
      '--accent-soft':    '#fb923c22',
      '--accent-glow':    '#fb923c44',
      '--text-primary':   '#fef0e8',
      '--text-secondary': '#f4c8a0',
      '--text-muted':     '#b87a50',
      '--text-accent':    '#fb923c',
      '--border':         '#3a2255',
      '--border-bright':  '#5a3878',
      '--btn-text':       '#12091f',
    },
  },
  {
    id: 'neon-noir',
    label: 'Neon Noir',
    emoji: '🌃',
    description: 'Deep black with vivid magenta — cyberpunk and high-energy',
    vars: {
      '--bg-deep':        '#06000e',
      '--bg-base':        '#0a0015',
      '--bg-surface':     '#10001e',
      '--bg-elevated':    '#18002e',
      '--bg-hover':       '#220040',
      '--accent':         '#e879f9',
      '--accent-dim':     '#d946ef',
      '--accent-soft':    '#e879f922',
      '--accent-glow':    '#e879f944',
      '--text-primary':   '#fdf4ff',
      '--text-secondary': '#f0abfc',
      '--text-muted':     '#b060d0',
      '--text-accent':    '#e879f9',
      '--border':         '#2e0050',
      '--border-bright':  '#4a0078',
      '--btn-text':       '#06000e',
    },
  },

  // ── LIGHT / WARM BACKGROUND THEMES ───────────────────────────

  {
    id: 'daylight',
    label: 'Daylight',
    emoji: '☀️',
    description: 'Crisp white with royal blue — professional for long study sessions',
    vars: {
      '--bg-deep':        '#ffffff',
      '--bg-base':        '#f8f9fb',
      '--bg-surface':     '#ffffff',
      '--bg-elevated':    '#f0f2f6',
      '--bg-hover':       '#e4e8f0',
      '--accent':         '#1d4ed8',
      '--accent-dim':     '#1539a8',
      '--accent-soft':    '#1d4ed814',
      '--accent-glow':    '#1d4ed830',
      '--text-primary':   '#09090b',
      '--text-secondary': '#18181b',
      '--text-muted':     '#3f3f46',
      '--text-accent':    '#1d4ed8',
      '--border':         '#d4d8e2',
      '--border-bright':  '#b0b8cc',
      '--btn-text':       '#ffffff',
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    emoji: '🪨',
    description: 'Clean off-white with amber — easy on the eyes',
    vars: {
      '--bg-deep':        '#ffffff',
      '--bg-base':        '#f7f8fa',
      '--bg-surface':     '#eef0f4',
      '--bg-elevated':    '#e4e7ed',
      '--bg-hover':       '#d9dde6',
      '--accent':         '#c47a0a',
      '--accent-dim':     '#9c5f06',
      '--accent-soft':    '#c47a0a22',
      '--accent-glow':    '#c47a0a44',
      '--text-primary':   '#0d1117',
      '--text-secondary': '#2c3a4a',
      '--text-muted':     '#505a6a',
      '--text-accent':    '#9c5f06',
      '--border':         '#c8cdd8',
      '--border-bright':  '#a8b0be',
      '--btn-text':       '#ffffff',
    },
  },
  {
    id: 'parchment',
    label: 'Parchment',
    emoji: '📜',
    description: 'Warm cream paper with burnt orange — classic and comfortable',
    vars: {
      '--bg-deep':        '#f5f0e8',
      '--bg-base':        '#ede8df',
      '--bg-surface':     '#e4ddd2',
      '--bg-elevated':    '#dbd4c8',
      '--bg-hover':       '#d0c9bc',
      '--accent':         '#8f3d08',
      '--accent-dim':     '#6b2d05',
      '--accent-soft':    '#8f3d0822',
      '--accent-glow':    '#8f3d0844',
      '--text-primary':   '#1a1008',
      '--text-secondary': '#3d2810',
      '--text-muted':     '#5a3e24',
      '--text-accent':    '#8f3d08',
      '--border':         '#b8af9e',
      '--border-bright':  '#a09080',
      '--btn-text':       '#ffffff',
    },
  },
  {
    id: 'linen',
    label: 'Linen',
    emoji: '📋',
    description: 'Warm off-white with indigo — focused reading comfort',
    vars: {
      '--bg-deep':        '#faf9f7',
      '--bg-base':        '#f5f3ef',
      '--bg-surface':     '#faf9f7',
      '--bg-elevated':    '#ede9e3',
      '--bg-hover':       '#e2ddd5',
      '--accent':         '#4338ca',
      '--accent-dim':     '#3128a0',
      '--accent-soft':    '#4338ca14',
      '--accent-glow':    '#4338ca30',
      '--text-primary':   '#0f0e0c',
      '--text-secondary': '#1c1a17',
      '--text-muted':     '#44403c',
      '--text-accent':    '#4338ca',
      '--border':         '#d6d0c8',
      '--border-bright':  '#b8b0a4',
      '--btn-text':       '#ffffff',
    },
  },
  {
    id: 'sakura',
    label: 'Sakura',
    emoji: '🌺',
    description: 'Soft cherry blossom pink — light, elegant, and restful',
    vars: {
      '--bg-deep':        '#fff8f9',
      '--bg-base':        '#fef2f4',
      '--bg-surface':     '#fff8f9',
      '--bg-elevated':    '#fce7eb',
      '--bg-hover':       '#f9d5dc',
      '--accent':         '#be185d',
      '--accent-dim':     '#9d174d',
      '--accent-soft':    '#be185d14',
      '--accent-glow':    '#be185d30',
      '--text-primary':   '#0f0608',
      '--text-secondary': '#1e0a10',
      '--text-muted':     '#6b2d45',
      '--text-accent':    '#be185d',
      '--border':         '#f0c0cc',
      '--border-bright':  '#e090a8',
      '--btn-text':       '#ffffff',
    },
  },
  {
    id: 'arctic',
    label: 'Arctic',
    emoji: '🧊',
    description: 'Crisp icy white with glacial blue — refreshing and ultra-clean',
    vars: {
      '--bg-deep':        '#f7fbff',
      '--bg-base':        '#eef6ff',
      '--bg-surface':     '#f7fbff',
      '--bg-elevated':    '#dceeff',
      '--bg-hover':       '#c8e2ff',
      '--accent':         '#0284c7',
      '--accent-dim':     '#0369a1',
      '--accent-soft':    '#0284c714',
      '--accent-glow':    '#0284c730',
      '--text-primary':   '#020b14',
      '--text-secondary': '#0c2540',
      '--text-muted':     '#2a5a80',
      '--text-accent':    '#0284c7',
      '--border':         '#b0d4f0',
      '--border-bright':  '#80b8e0',
      '--btn-text':       '#ffffff',
    },
  },
  {
    id: 'sage',
    label: 'Sage',
    emoji: '🌿',
    description: 'Warm cream with dusty sage green — natural and calming',
    vars: {
      '--bg-deep':        '#f6f7f2',
      '--bg-base':        '#eff1ea',
      '--bg-surface':     '#f6f7f2',
      '--bg-elevated':    '#e4e8dd',
      '--bg-hover':       '#d4dac9',
      '--accent':         '#3d6b44',
      '--accent-dim':     '#2d5234',
      '--accent-soft':    '#3d6b4414',
      '--accent-glow':    '#3d6b4430',
      '--text-primary':   '#0d120e',
      '--text-secondary': '#1a2e1c',
      '--text-muted':     '#3a5a3e',
      '--text-accent':    '#3d6b44',
      '--border':         '#c0c9b4',
      '--border-bright':  '#9aaa8c',
      '--btn-text':       '#ffffff',
    },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    emoji: '🌊',
    description: 'Crisp white with cool ocean blue — clean and focused',
    vars: {
      '--bg-deep':        '#ffffff',
      '--bg-base':        '#f4f8fc',
      '--bg-surface':     '#e8f2fa',
      '--bg-elevated':    '#d8eaf6',
      '--bg-hover':       '#c6dff0',
      '--accent':         '#0369a1',
      '--accent-dim':     '#024f7a',
      '--accent-soft':    '#0369a122',
      '--accent-glow':    '#0369a144',
      '--text-primary':   '#040f1e',
      '--text-secondary': '#1a3a56',
      '--text-muted':     '#3a6080',
      '--text-accent':    '#024f7a',
      '--border':         '#a8cce4',
      '--border-bright':  '#88b4d4',
      '--btn-text':       '#ffffff',
    },
  },

  {
    id: 'custom',
    label: 'Custom',
    emoji: '🎨',
    description: 'Your own colours',
    vars: null,
  },
];

// Variables exposed for custom editing (label → CSS var)
const CUSTOM_FIELDS = [
  { label: 'Background (deep)',    key: '--bg-deep'        },
  { label: 'Background (surface)', key: '--bg-surface'     },
  { label: 'Background (raised)',  key: '--bg-elevated'    },
  { label: 'Accent colour',        key: '--accent'         },
  { label: 'Accent (dim)',         key: '--accent-dim'     },
  { label: 'Text (primary)',       key: '--text-primary'   },
  { label: 'Text (secondary)',     key: '--text-secondary' },
  { label: 'Text (muted)',         key: '--text-muted'     },
  { label: 'Border',               key: '--border'         },
];

// ── Helpers ───────────────────────────────────────────────────
function applyVars(vars) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  // Forward --btn-text so components using var(--btn-text) pick it up
  if (vars['--btn-text']) {
    root.style.setProperty('--btn-text', vars['--btn-text']);
  }
  // Derive shadow-accent from accent
  const accent = vars['--accent'];
  if (accent) {
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

function getInitialCustomVars() {
  // Seed custom vars from current computed style
  const root = document.documentElement;
  const computed = getComputedStyle(root);
  const result = {};
  CUSTOM_FIELDS.forEach(({ key }) => {
    result[key] = (computed.getPropertyValue(key) || '').trim() || '#000000';
  });
  return result;
}

// ── Component ─────────────────────────────────────────────────
export default function ThemeSettings() {
  const [activePreset, setActivePreset]   = useState('midnight');
  const [customVars, setCustomVars]       = useState(getInitialCustomVars);
  const [saved, setSaved]                 = useState(false);
  const [loading, setLoading]             = useState(true);

  // Load persisted theme on mount
  useEffect(() => {
    ipc.invoke('config:get').then(res => {
      if (res?.success && res.config?.theme) {
        const { presetId, vars } = res.config.theme;
        if (presetId) setActivePreset(presetId);
        if (vars) {
          applyVars(vars);
          if (presetId === 'custom') setCustomVars(vars);
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const selectPreset = useCallback((preset) => {
    setActivePreset(preset.id);
    if (preset.id === 'custom') {
      applyVars(customVars);
    } else if (preset.vars) {
      applyVars(preset.vars);
    }
  }, [customVars]);

  const updateCustomVar = useCallback((key, value) => {
    const next = { ...customVars, [key]: value };
    setCustomVars(next);
    if (activePreset === 'custom') applyVars(next);
  }, [customVars, activePreset]);

  const saveTheme = useCallback(async () => {
    const preset = PRESETS.find(p => p.id === activePreset);
    const vars = activePreset === 'custom' ? customVars : preset.vars;
    try {
      await ipc.invoke('config:save', { config: { theme: { presetId: activePreset, vars } } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('[ThemeSettings] save failed:', e);
    }
  }, [activePreset, customVars]);

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)' }}>Loading…</div>;

  const currentPreset = PRESETS.find(p => p.id === activePreset);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 680, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Theme
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Changes apply instantly. Save to persist across sessions.
        </p>
      </div>

      {/* Preset grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 10,
        marginBottom: 28,
      }}>
        {PRESETS.map(preset => {
          const isActive = activePreset === preset.id;
          const swatch = preset.vars?.['--bg-surface'] || customVars['--bg-surface'] || '#2a2b30';
          const accent  = preset.vars?.['--accent']    || customVars['--accent']     || '#f5a623';
          return (
            <button
              key={preset.id}
              onClick={() => selectPreset(preset)}
              style={{
                background:   isActive ? `${accent}18` : 'var(--bg-elevated)',
                border:       isActive ? `2px solid ${accent}` : '2px solid var(--border)',
                borderRadius: 12,
                padding:      '12px 10px',
                cursor:       'pointer',
                textAlign:    'center',
                transition:   'all 0.15s ease',
                outline:      'none',
              }}
            >
              {/* Mini colour swatch */}
              <div style={{
                width: 36, height: 36,
                borderRadius: 8,
                background: swatch,
                margin: '0 auto 8px',
                border: `3px solid ${accent}`,
                boxShadow: isActive ? `0 0 10px ${accent}55` : 'none',
                transition: 'box-shadow 0.15s ease',
              }} />
              <div style={{
                fontSize:   '1rem',
                lineHeight: 1,
                marginBottom: 4,
              }}>{preset.emoji}</div>
              <div style={{
                fontSize:   '0.75rem',
                fontWeight: isActive ? 700 : 400,
                color:      isActive ? accent : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
              }}>{preset.label}</div>
            </button>
          );
        })}
      </div>

      {/* Description */}
      <p style={{
        margin: '0 0 24px',
        fontSize: '0.82rem',
        color: 'var(--text-muted)',
        fontStyle: 'italic',
      }}>
        {currentPreset?.description}
      </p>

      {/* Custom colour editor */}
      {activePreset === 'custom' && (
        <div style={{
          background:   'var(--bg-elevated)',
          border:       '1px solid var(--border)',
          borderRadius: 12,
          padding:      '18px 20px',
          marginBottom: 24,
        }}>
          <h3 style={{
            margin: '0 0 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Custom Colours
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
            {CUSTOM_FIELDS.map(({ label, key }) => (
              <label key={key} style={{
                display:    'flex',
                alignItems: 'center',
                gap:        10,
                cursor:     'pointer',
              }}>
                <input
                  type="color"
                  value={customVars[key] || '#000000'}
                  onChange={e => updateCustomVar(key, e.target.value)}
                  style={{
                    width:        36,
                    height:       28,
                    borderRadius: 6,
                    border:       '1px solid var(--border)',
                    background:   'none',
                    cursor:       'pointer',
                    padding:      2,
                    flexShrink:   0,
                  }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Live preview strip */}
      <div style={{
        background:   'var(--bg-surface)',
        border:       '1px solid var(--border)',
        borderRadius: 12,
        padding:      '14px 18px',
        marginBottom: 24,
        display:      'flex',
        alignItems:   'center',
        gap:          14,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 8px var(--accent)',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flex: 1 }}>
          Live preview — this is how your chat bubbles and panels will look.
        </span>
        <span style={{
          fontSize:     '0.75rem',
          fontWeight:   600,
          color:        'var(--accent)',
          background:   'var(--accent-soft)',
          borderRadius: 20,
          padding:      '3px 10px',
        }}>
          {currentPreset?.label}
        </span>
      </div>

      {/* Save button */}
      <button
        onClick={saveTheme}
        style={{
          background:   saved ? 'var(--bg-elevated)' : 'var(--accent)',
          color:        saved ? 'var(--text-secondary)' : 'var(--btn-text)',
          border:       'none',
          borderRadius: 10,
          padding:      '10px 28px',
          fontSize:     '0.88rem',
          fontWeight:   700,
          cursor:       'pointer',
          transition:   'all 0.2s ease',
          boxShadow:    saved ? 'none' : 'var(--shadow-accent)',
        }}
      >
        {saved ? '✓ Saved' : 'Save Theme'}
      </button>
    </div>
  );
}