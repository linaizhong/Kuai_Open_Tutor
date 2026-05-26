/**
 * Math Toolbar Component
 * Multi-tab toolbar with organized math symbols and templates
 *
 * @module components/equation/MathToolbar
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

// ===== TAB CATEGORIES =====
const TAB_CATEGORIES = [
  {
    id: 'basic',
    label: 'Basic',
    icon: '🔢',
    description: 'Basic operations and formatting',
    buttons: [
      // Row 1: Powers and roots
      [
        { label: 'x²', latex: '^{2}', tooltip: 'Square' },
        { label: 'x³', latex: '^{3}', tooltip: 'Cube' },
        { label: 'xⁿ', latex: '^{}', tooltip: 'Power (cursor in {})' },
        { label: 'xₙ', latex: '_{}', tooltip: 'Subscript' },
        { label: '√', latex: '\\sqrt{}', tooltip: 'Square root' },
        { label: '∛', latex: '\\sqrt[3]{}', tooltip: 'Cube root' },
        { label: '∜', latex: '\\sqrt[4]{}', tooltip: 'Fourth root' },
      ],
      // Row 2: Fractions and operators
      [
        { label: '½', latex: '\\frac{1}{2}', tooltip: 'One half' },
        { label: '⅓', latex: '\\frac{1}{3}', tooltip: 'One third' },
        { label: '¼', latex: '\\frac{1}{4}', tooltip: 'One quarter' },
        { label: '⁄', latex: '\\frac{}{}', tooltip: 'Fraction' },
        { label: '÷', latex: '\\div', tooltip: 'Division' },
        { label: '×', latex: '\\times', tooltip: 'Multiplication' },
        { label: '±', latex: '\\pm', tooltip: 'Plus minus' },
        { label: '∓', latex: '\\mp', tooltip: 'Minus plus' },
      ],
      // Row 3: Basic functions
      [
        { label: 'sin', latex: '\\sin', tooltip: 'Sine' },
        { label: 'cos', latex: '\\cos', tooltip: 'Cosine' },
        { label: 'tan', latex: '\\tan', tooltip: 'Tangent' },
        { label: 'log', latex: '\\log', tooltip: 'Logarithm' },
        { label: 'ln', latex: '\\ln', tooltip: 'Natural log' },
        { label: 'exp', latex: '\\exp', tooltip: 'Exponential' },
        { label: 'mod', latex: '\\bmod', tooltip: 'Modulo' },
      ],
    ],
  },
  {
    id: 'calculus',
    label: 'Calculus',
    icon: '∫',
    description: 'Calculus and analysis symbols',
    buttons: [
      // Row 1: Integrals
      [
        { label: '∫', latex: '\\int', tooltip: 'Integral' },
        { label: '∮', latex: '\\oint', tooltip: 'Contour integral' },
        { label: '∬', latex: '\\iint', tooltip: 'Double integral' },
        { label: '∭', latex: '\\iiint', tooltip: 'Triple integral' },
        { label: '∫_a^b', latex: '\\int_{a}^{b}', tooltip: 'Definite integral' },
        { label: '∫∫', latex: '\\int\\int', tooltip: 'Double integral (separate)' },
      ],
      // Row 2: Derivatives
      [
        { label: 'd/dx', latex: '\\frac{d}{dx}', tooltip: 'Derivative' },
        { label: '∂', latex: '\\partial', tooltip: 'Partial derivative' },
        { label: '∇', latex: '\\nabla', tooltip: 'Gradient' },
        { label: "f'", latex: "f'", tooltip: 'First derivative' },
        { label: "f''", latex: "f''", tooltip: 'Second derivative' },
        { label: "f^{(n)}", latex: "f^{(n)}", tooltip: 'nth derivative' },
      ],
      // Row 3: Limits and sums
      [
        { label: 'lim', latex: '\\lim', tooltip: 'Limit' },
        { label: 'lim→', latex: '\\lim_{x \\to \\infty}', tooltip: 'Limit to infinity' },
        { label: '∑', latex: '\\sum', tooltip: 'Summation' },
        { label: '∑_{i=1}^n', latex: '\\sum_{i=1}^{n}', tooltip: 'Sum with limits' },
        { label: '∏', latex: '\\prod', tooltip: 'Product' },
        { label: '∏_{i=1}^n', latex: '\\prod_{i=1}^{n}', tooltip: 'Product with limits' },
      ],
      // Row 4: Calculus extras
      [
        { label: '∞', latex: '\\infty', tooltip: 'Infinity' },
        { label: '→', latex: '\\to', tooltip: 'To' },
        { label: '↦', latex: '\\mapsto', tooltip: 'Maps to' },
        { label: 'Δ', latex: '\\Delta', tooltip: 'Delta (change)' },
        { label: 'δ', latex: '\\delta', tooltip: 'Delta (small)' },
        { label: 'ε', latex: '\\epsilon', tooltip: 'Epsilon' },
      ],
    ],
  },
  {
    id: 'greek',
    label: 'Greek',
    icon: 'α',
    description: 'Greek letters (lowercase and uppercase)',
    buttons: [
      // Row 1: Lowercase α-λ
      [
        { label: 'α', latex: '\\alpha', tooltip: 'Alpha' },
        { label: 'β', latex: '\\beta', tooltip: 'Beta' },
        { label: 'γ', latex: '\\gamma', tooltip: 'Gamma' },
        { label: 'δ', latex: '\\delta', tooltip: 'Delta' },
        { label: 'ε', latex: '\\epsilon', tooltip: 'Epsilon' },
        { label: 'ζ', latex: '\\zeta', tooltip: 'Zeta' },
        { label: 'η', latex: '\\eta', tooltip: 'Eta' },
        { label: 'θ', latex: '\\theta', tooltip: 'Theta' },
      ],
      // Row 2: Lowercase ι-π
      [
        { label: 'ι', latex: '\\iota', tooltip: 'Iota' },
        { label: 'κ', latex: '\\kappa', tooltip: 'Kappa' },
        { label: 'λ', latex: '\\lambda', tooltip: 'Lambda' },
        { label: 'μ', latex: '\\mu', tooltip: 'Mu' },
        { label: 'ν', latex: '\\nu', tooltip: 'Nu' },
        { label: 'ξ', latex: '\\xi', tooltip: 'Xi' },
        { label: 'π', latex: '\\pi', tooltip: 'Pi' },
      ],
      // Row 3: Lowercase ρ-ω
      [
        { label: 'ρ', latex: '\\rho', tooltip: 'Rho' },
        { label: 'σ', latex: '\\sigma', tooltip: 'Sigma' },
        { label: 'τ', latex: '\\tau', tooltip: 'Tau' },
        { label: 'υ', latex: '\\upsilon', tooltip: 'Upsilon' },
        { label: 'φ', latex: '\\phi', tooltip: 'Phi' },
        { label: 'χ', latex: '\\chi', tooltip: 'Chi' },
        { label: 'ψ', latex: '\\psi', tooltip: 'Psi' },
        { label: 'ω', latex: '\\omega', tooltip: 'Omega' },
      ],
      // Row 4: Uppercase Greek
      [
        { label: 'Γ', latex: '\\Gamma', tooltip: 'Gamma (uppercase)' },
        { label: 'Δ', latex: '\\Delta', tooltip: 'Delta (uppercase)' },
        { label: 'Θ', latex: '\\Theta', tooltip: 'Theta (uppercase)' },
        { label: 'Λ', latex: '\\Lambda', tooltip: 'Lambda (uppercase)' },
        { label: 'Ξ', latex: '\\Xi', tooltip: 'Xi (uppercase)' },
        { label: 'Π', latex: '\\Pi', tooltip: 'Pi (uppercase)' },
        { label: 'Σ', latex: '\\Sigma', tooltip: 'Sigma (uppercase)' },
        { label: 'Φ', latex: '\\Phi', tooltip: 'Phi (uppercase)' },
        { label: 'Ψ', latex: '\\Psi', tooltip: 'Psi (uppercase)' },
        { label: 'Ω', latex: '\\Omega', tooltip: 'Omega (uppercase)' },
      ],
    ],
  },
  {
    id: 'relations',
    label: 'Relations',
    icon: '=',
    description: 'Equality and inequality symbols',
    buttons: [
      // Row 1: Basic relations
      [
        { label: '=', latex: '=', tooltip: 'Equals' },
        { label: '≠', latex: '\\neq', tooltip: 'Not equal' },
        { label: '≈', latex: '\\approx', tooltip: 'Approximately' },
        { label: '≅', latex: '\\cong', tooltip: 'Congruent' },
        { label: '≡', latex: '\\equiv', tooltip: 'Equivalent' },
        { label: '∼', latex: '\\sim', tooltip: 'Similar' },
        { label: '∝', latex: '\\propto', tooltip: 'Proportional to' },
      ],
      // Row 2: Inequalities
      [
        { label: '<', latex: '<', tooltip: 'Less than' },
        { label: '>', latex: '>', tooltip: 'Greater than' },
        { label: '≤', latex: '\\le', tooltip: 'Less than or equal' },
        { label: '≥', latex: '\\ge', tooltip: 'Greater than or equal' },
        { label: '≪', latex: '\\ll', tooltip: 'Much less than' },
        { label: '≫', latex: '\\gg', tooltip: 'Much greater than' },
        { label: '≶', latex: '\\lessgtr', tooltip: 'Less than or greater than' },
      ],
      // Row 3: Comparison
      [
        { label: '≃', latex: '\\simeq', tooltip: 'Similar or equal' },
        { label: '≍', latex: '\\asymp', tooltip: 'Asymptotic' },
        { label: '≏', latex: '\\bumpeq', tooltip: 'Bump equals' },
        { label: '≐', latex: '\\doteq', tooltip: 'Doteq' },
        { label: '⊥', latex: '\\perp', tooltip: 'Perpendicular' },
        { label: '∥', latex: '\\parallel', tooltip: 'Parallel' },
        { label: '∠', latex: '\\angle', tooltip: 'Angle' },
      ],
    ],
  },
  {
    id: 'sets',
    label: 'Sets',
    icon: '∈',
    description: 'Set theory symbols',
    buttons: [
      // Row 1: Element relations
      [
        { label: '∈', latex: '\\in', tooltip: 'Element of' },
        { label: '∉', latex: '\\notin', tooltip: 'Not element of' },
        { label: '∋', latex: '\\ni', tooltip: 'Contains' },
        { label: '∌', latex: '\\notni', tooltip: 'Does not contain' },
        { label: '⊂', latex: '\\subset', tooltip: 'Subset' },
        { label: '⊃', latex: '\\supset', tooltip: 'Superset' },
      ],
      // Row 2: Subset relations
      [
        { label: '⊆', latex: '\\subseteq', tooltip: 'Subset or equal' },
        { label: '⊇', latex: '\\supseteq', tooltip: 'Superset or equal' },
        { label: '⊄', latex: '\\not\\subset', tooltip: 'Not subset' },
        { label: '⊅', latex: '\\not\\supset', tooltip: 'Not superset' },
        { label: '⊈', latex: '\\nsubseteq', tooltip: 'Not subset or equal' },
        { label: '⊉', latex: '\\nsupseteq', tooltip: 'Not superset or equal' },
      ],
      // Row 3: Set operations
      [
        { label: '∪', latex: '\\cup', tooltip: 'Union' },
        { label: '∩', latex: '\\cap', tooltip: 'Intersection' },
        { label: '∅', latex: '\\emptyset', tooltip: 'Empty set' },
        { label: '∁', latex: '\\complement', tooltip: 'Complement' },
        { label: '∖', latex: '\\setminus', tooltip: 'Set difference' },
        { label: '×', latex: '\\times', tooltip: 'Cartesian product' },
      ],
      // Row 4: Quantifiers
      [
        { label: '∀', latex: '\\forall', tooltip: 'For all' },
        { label: '∃', latex: '\\exists', tooltip: 'There exists' },
        { label: '∄', latex: '\\nexists', tooltip: 'There does not exist' },
        { label: '∴', latex: '\\therefore', tooltip: 'Therefore' },
        { label: '∵', latex: '\\because', tooltip: 'Because' },
        { label: '□', latex: '\\square', tooltip: 'Square (QED)' },
      ],
    ],
  },
  {
    id: 'arrows',
    label: 'Arrows',
    icon: '→',
    description: 'Arrow symbols',
    buttons: [
      // Row 1: Basic arrows
      [
        { label: '→', latex: '\\to', tooltip: 'To' },
        { label: '←', latex: '\\leftarrow', tooltip: 'Left arrow' },
        { label: '↑', latex: '\\uparrow', tooltip: 'Up arrow' },
        { label: '↓', latex: '\\downarrow', tooltip: 'Down arrow' },
        { label: '↔', latex: '\\leftrightarrow', tooltip: 'Left right arrow' },
        { label: '↕', latex: '\\updownarrow', tooltip: 'Up down arrow' },
      ],
      // Row 2: Double arrows
      [
        { label: '⇒', latex: '\\Rightarrow', tooltip: 'Implies' },
        { label: '⇐', latex: '\\Leftarrow', tooltip: 'Left double arrow' },
        { label: '⇑', latex: '\\Uparrow', tooltip: 'Up double arrow' },
        { label: '⇓', latex: '\\Downarrow', tooltip: 'Down double arrow' },
        { label: '⇔', latex: '\\Leftrightarrow', tooltip: 'If and only if' },
        { label: '⇕', latex: '\\Updownarrow', tooltip: 'Up down double arrow' },
      ],
      // Row 3: Special arrows
      [
        { label: '↦', latex: '\\mapsto', tooltip: 'Maps to' },
        { label: '↩', latex: '\\hookleftarrow', tooltip: 'Hook left arrow' },
        { label: '↪', latex: '\\hookrightarrow', tooltip: 'Hook right arrow' },
        { label: '↼', latex: '\\leftharpoonup', tooltip: 'Left harpoon up' },
        { label: '⇀', latex: '\\rightharpoonup', tooltip: 'Right harpoon up' },
        { label: '↽', latex: '\\leftharpoondown', tooltip: 'Left harpoon down' },
        { label: '⇁', latex: '\\rightharpoondown', tooltip: 'Right harpoon down' },
      ],
      // Row 4: Longer arrows
      [
        { label: '⟶', latex: '\\longrightarrow', tooltip: 'Long right arrow' },
        { label: '⟵', latex: '\\longleftarrow', tooltip: 'Long left arrow' },
        { label: '⟹', latex: '\\Longrightarrow', tooltip: 'Long implies' },
        { label: '⟺', latex: '\\Longleftrightarrow', tooltip: 'Long iff' },
        { label: '⟼', latex: '\\longmapsto', tooltip: 'Long maps to' },
        { label: '⇢', latex: '\\dashrightarrow', tooltip: 'Dashed right arrow' },
      ],
    ],
  },
  {
    id: 'brackets',
    label: 'Brackets',
    icon: '{}',
    description: 'Brackets and delimiters',
    buttons: [
      // Row 1: Parentheses and brackets
      [
        { label: '( )', latex: '()', tooltip: 'Parentheses' },
        { label: '[ ]', latex: '[]', tooltip: 'Brackets' },
        { label: '{ }', latex: '\\{ \\}', tooltip: 'Curly braces' },
        { label: '⟨ ⟩', latex: '\\langle \\rangle', tooltip: 'Angle brackets' },
        { label: '⌊ ⌋', latex: '\\lfloor \\rfloor', tooltip: 'Floor' },
        { label: '⌈ ⌉', latex: '\\lceil \\rceil', tooltip: 'Ceiling' },
      ],
      // Row 2: Single delimiters
      [
        { label: '|', latex: '|', tooltip: 'Vertical bar' },
        { label: '‖', latex: '\\|', tooltip: 'Double vertical bar' },
        { label: '/', latex: '/', tooltip: 'Forward slash' },
        { label: '\\', latex: '\\backslash', tooltip: 'Backslash' },
        { label: '⌊', latex: '\\lfloor', tooltip: 'Left floor' },
        { label: '⌋', latex: '\\rfloor', tooltip: 'Right floor' },
      ],
      // Row 3: Brackets with size
      [
        { label: '\\left( \\right)', latex: '\\left( \\right)', tooltip: 'Auto-sized parentheses' },
        { label: '\\left[ \\right]', latex: '\\left[ \\right]', tooltip: 'Auto-sized brackets' },
        { label: '\\left\\{ \\right\\}', latex: '\\left\\{ \\right\\}', tooltip: 'Auto-sized braces' },
        { label: '\\left| \\right|', latex: '\\left| \\right|', tooltip: 'Auto-sized absolute' },
        { label: '\\langle \\rangle', latex: '\\langle \\rangle', tooltip: 'Angle brackets' },
      ],
      // Row 4: Matrix brackets
      [
        { label: '⎛ ⎞', latex: '\\begin{pmatrix} \\end{pmatrix}', tooltip: 'Matrix parentheses' },
        { label: '⎡ ⎤', latex: '\\begin{bmatrix} \\end{bmatrix}', tooltip: 'Matrix brackets' },
        { label: '⎧ ⎫', latex: '\\begin{Bmatrix} \\end{Bmatrix}', tooltip: 'Matrix braces' },
        { label: '| |', latex: '\\begin{vmatrix} \\end{vmatrix}', tooltip: 'Matrix determinant' },
        { label: '‖ ‖', latex: '\\begin{Vmatrix} \\end{Vmatrix}', tooltip: 'Matrix norm' },
      ],
    ],
  },
  {
    id: 'matrices',
    label: 'Matrices',
    icon: '⎛⎞',
    description: 'Matrix and vector templates',
    buttons: [
      // Row 1: Basic matrix templates
      [
        { label: '2×2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', tooltip: '2x2 matrix' },
        { label: '3×3', latex: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}', tooltip: '3x3 matrix' },
        { label: '2×3', latex: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\end{pmatrix}', tooltip: '2x3 matrix' },
        { label: '3×2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\\\ e & f \\end{pmatrix}', tooltip: '3x2 matrix' },
      ],
      // Row 2: Different bracket types
      [
        { label: 'pmatrix', latex: '\\begin{pmatrix}  \\end{pmatrix}', tooltip: 'Matrix with parentheses' },
        { label: 'bmatrix', latex: '\\begin{bmatrix}  \\end{bmatrix}', tooltip: 'Matrix with brackets' },
        { label: 'Bmatrix', latex: '\\begin{Bmatrix}  \\end{Bmatrix}', tooltip: 'Matrix with braces' },
        { label: 'vmatrix', latex: '\\begin{vmatrix}  \\end{vmatrix}', tooltip: 'Determinant' },
        { label: 'Vmatrix', latex: '\\begin{Vmatrix}  \\end{Vmatrix}', tooltip: 'Norm matrix' },
      ],
      // Row 3: Special matrices
      [
        { label: 'identity', latex: '\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}', tooltip: '2x2 identity' },
        { label: 'zero', latex: '\\begin{pmatrix} 0 & 0 \\\\ 0 & 0 \\end{pmatrix}', tooltip: '2x2 zero matrix' },
        { label: 'diag', latex: '\\operatorname{diag}', tooltip: 'Diagonal' },
        { label: 'det', latex: '\\det', tooltip: 'Determinant' },
        { label: 'tr', latex: '\\operatorname{tr}', tooltip: 'Trace' },
      ],
      // Row 4: Vector templates
      [
        { label: '\\vec{v}', latex: '\\vec{v}', tooltip: 'Vector' },
        { label: '\\hat{v}', latex: '\\hat{v}', tooltip: 'Unit vector' },
        { label: '\\dot{v}', latex: '\\dot{v}', tooltip: 'Time derivative' },
        { label: '\\ddot{v}', latex: '\\ddot{v}', tooltip: 'Second derivative' },
        { label: '\\bar{v}', latex: '\\bar{v}', tooltip: 'Average' },
        { label: '\\tilde{v}', latex: '\\tilde{v}', tooltip: 'Tilde' },
      ],
    ],
  },
  {
    id: 'functions',
    label: 'Functions',
    icon: 'f(x)',
    description: 'Trigonometric and special functions',
    buttons: [
      // Row 1: Trig functions
      [
        { label: 'sin', latex: '\\sin', tooltip: 'Sine' },
        { label: 'cos', latex: '\\cos', tooltip: 'Cosine' },
        { label: 'tan', latex: '\\tan', tooltip: 'Tangent' },
        { label: 'csc', latex: '\\csc', tooltip: 'Cosecant' },
        { label: 'sec', latex: '\\sec', tooltip: 'Secant' },
        { label: 'cot', latex: '\\cot', tooltip: 'Cotangent' },
      ],
      // Row 2: Inverse trig
      [
        { label: 'arcsin', latex: '\\arcsin', tooltip: 'Arcsine' },
        { label: 'arccos', latex: '\\arccos', tooltip: 'Arccosine' },
        { label: 'arctan', latex: '\\arctan', tooltip: 'Arctangent' },
        { label: 'arccsc', latex: '\\operatorname{arccsc}', tooltip: 'Arccosecant' },
        { label: 'arcsec', latex: '\\operatorname{arcsec}', tooltip: 'Arcsecant' },
        { label: 'arccot', latex: '\\operatorname{arccot}', tooltip: 'Arccotangent' },
      ],
      // Row 3: Hyperbolic
      [
        { label: 'sinh', latex: '\\sinh', tooltip: 'Hyperbolic sine' },
        { label: 'cosh', latex: '\\cosh', tooltip: 'Hyperbolic cosine' },
        { label: 'tanh', latex: '\\tanh', tooltip: 'Hyperbolic tangent' },
        { label: 'csch', latex: '\\operatorname{csch}', tooltip: 'Hyperbolic cosecant' },
        { label: 'sech', latex: '\\operatorname{sech}', tooltip: 'Hyperbolic secant' },
        { label: 'coth', latex: '\\coth', tooltip: 'Hyperbolic cotangent' },
      ],
      // Row 4: Special functions
      [
        { label: 'log', latex: '\\log', tooltip: 'Logarithm' },
        { label: 'ln', latex: '\\ln', tooltip: 'Natural log' },
        { label: 'exp', latex: '\\exp', tooltip: 'Exponential' },
        { label: 'max', latex: '\\max', tooltip: 'Maximum' },
        { label: 'min', latex: '\\min', tooltip: 'Minimum' },
        { label: 'arg', latex: '\\arg', tooltip: 'Argument' },
        { label: 'deg', latex: '^\\circ', tooltip: 'Degrees' },
      ],
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols',
    icon: '★',
    description: 'Miscellaneous mathematical symbols',
    buttons: [
      // Row 1: Geometric
      [
        { label: '∠', latex: '\\angle', tooltip: 'Angle' },
        { label: '∡', latex: '\\measuredangle', tooltip: 'Measured angle' },
        { label: '∢', latex: '\\sphericalangle', tooltip: 'Spherical angle' },
        { label: '⊥', latex: '\\perp', tooltip: 'Perpendicular' },
        { label: '∥', latex: '\\parallel', tooltip: 'Parallel' },
        { label: '∦', latex: '\\nparallel', tooltip: 'Not parallel' },
      ],
      // Row 2: Calculus extras
      [
        { label: '∇', latex: '\\nabla', tooltip: 'Nabla (gradient)' },
        { label: '∂', latex: '\\partial', tooltip: 'Partial derivative' },
        { label: '∆', latex: '\\triangle', tooltip: 'Triangle' },
        { label: '∎', latex: '\\blacksquare', tooltip: 'End of proof' },
        { label: '□', latex: '\\square', tooltip: 'Square' },
        { label: '•', latex: '\\bullet', tooltip: 'Bullet' },
      ],
      // Row 3: Number sets
      [
        { label: 'ℕ', latex: '\\mathbb{N}', tooltip: 'Natural numbers' },
        { label: 'ℤ', latex: '\\mathbb{Z}', tooltip: 'Integers' },
        { label: 'ℚ', latex: '\\mathbb{Q}', tooltip: 'Rational numbers' },
        { label: 'ℝ', latex: '\\mathbb{R}', tooltip: 'Real numbers' },
        { label: 'ℂ', latex: '\\mathbb{C}', tooltip: 'Complex numbers' },
        { label: 'ℙ', latex: '\\mathbb{P}', tooltip: 'Prime numbers' },
      ],
      // Row 4: Logic
      [
        { label: '∧', latex: '\\land', tooltip: 'And' },
        { label: '∨', latex: '\\lor', tooltip: 'Or' },
        { label: '¬', latex: '\\neg', tooltip: 'Not' },
        { label: '⊕', latex: '\\oplus', tooltip: 'XOR' },
        { label: '⊗', latex: '\\otimes', tooltip: 'Tensor product' },
        { label: '⊙', latex: '\\odot', tooltip: 'Dot in circle' },
      ],
    ],
  },
];

/**
 * Math Toolbar Component with multi-tab interface
 * @param {Object} props
 * @param {Function} props.onInsert - Function to call with LaTeX when button clicked
 * @param {string} props.activeTabId - Initially active tab (optional)
 * @param {Function} props.onTabChange - Callback when tab changes (optional)
 */
const MathToolbar = ({ onInsert, activeTabId = 'basic', onTabChange }) => {
  const [activeTab, setActiveTab] = useState(activeTabId);
  const [hoveredButton, setHoveredButton] = useState(null);
  const tabBarRef = useRef(null);

  // Update active tab when prop changes
  useEffect(() => {
    setActiveTab(activeTabId);
  }, [activeTabId]);

  // Handle tab change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  // Get current tab data
  const currentTab = TAB_CATEGORIES.find(tab => tab.id === activeTab) || TAB_CATEGORIES[0];

  // Scroll active tab into view
  useEffect(() => {
    if (tabBarRef.current) {
      const activeTabElement = tabBarRef.current.querySelector(`[data-tab-id="${activeTab}"]`);
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeTab]);

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Tab Bar - Scrollable */}
      <div
        ref={tabBarRef}
        style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 12px',
          overflowX: 'auto',
          scrollbarWidth: 'thin',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        {TAB_CATEGORIES.map((tab) => (
          <button
            key={tab.id}
            data-tab-id={tab.id}
            onClick={() => handleTabChange(tab.id)}
            title={tab.description}
            style={{
              padding: '6px 14px',
              background: activeTab === tab.id ? 'var(--accent-soft)' : 'transparent',
              border: activeTab === tab.id ? '1px solid var(--accent)' : '1px solid transparent',
              borderRadius: 'var(--radius-full)',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Current Tab Description */}
      <div
        style={{
          padding: '4px 12px',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
        }}
      >
        {currentTab.description}
      </div>

      {/* Button Grid */}
      <div
        style={{
          padding: '16px',
          maxHeight: '240px',
          overflowY: 'auto',
        }}
      >
        {currentTab.buttons.map((row, rowIndex) => (
          <div
            key={rowIndex}
            style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              marginBottom: rowIndex < currentTab.buttons.length - 1 ? '10px' : 0,
              paddingBottom: rowIndex < currentTab.buttons.length - 1 ? '10px' : 0,
              borderBottom: rowIndex < currentTab.buttons.length - 1
                ? '1px dashed var(--border)'
                : 'none',
            }}
          >
            {row.map((button, buttonIndex) => (
              <button
                key={`${rowIndex}-${buttonIndex}`}
                onClick={() => onInsert(button.latex)}
                title={button.tooltip}
                onMouseEnter={() => setHoveredButton(button)}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  padding: '8px 12px',
                  minWidth: '48px',
                  background: hoveredButton === button
                    ? 'var(--accent-soft)'
                    : 'var(--bg-surface)',
                  border: hoveredButton === button
                    ? '1px solid var(--accent)'
                    : '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: hoveredButton === button
                    ? 'var(--accent)'
                    : 'var(--text-primary)',
                  fontSize: button.label.length > 2 ? '0.85rem' : '1rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '0 0 auto',
                  boxShadow: hoveredButton === button
                    ? 'var(--shadow-accent)'
                    : 'none',
                }}
              >
                {button.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Quick tip */}
      <div
        style={{
          padding: '8px 16px',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Click any button to insert LaTeX</span>
        {hoveredButton && (
          <span style={{ color: 'var(--accent)' }}>
            {hoveredButton.tooltip}
          </span>
        )}
      </div>
    </div>
  );
};

MathToolbar.propTypes = {
  onInsert: PropTypes.func.isRequired,
  activeTabId: PropTypes.string,
  onTabChange: PropTypes.func,
};

export default MathToolbar;