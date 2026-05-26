// tools/calculator/index.js
// Safe math evaluation tool for calculations and step-by-step solutions

const BaseTool = require('../base');

class CalculatorTool extends BaseTool {
  constructor() {
    super(
      'calculator',
      'Perform mathematical calculations with optional step-by-step working',
      '1.0.0'
    );
  }

  getParameters() {
    return [
      {
        name: 'expression',
        type: 'string',
        description: 'Mathematical expression to evaluate',
        required: true,
      },
      {
        name: 'steps',
        type: 'boolean',
        description: 'Show step-by-step working',
        required: false,
        default: false,
      },
      {
        name: 'variables',
        type: 'object',
        description: 'Variable values (e.g., { x: 5, y: 2 })',
        required: false,
      },
    ];
  }

  validateParams(params) {
    if (!params.expression) {
      throw new Error('Calculator tool requires an expression');
    }
    if (typeof params.expression !== 'string') {
      throw new Error('Expression must be a string');
    }
  }

  async execute(params, context) {
    const { expression, steps = false, variables = {} } = params;
    const { studentModel } = context;

    // Clean the expression
    const cleanExpr = this._cleanExpression(expression, variables);

    try {
      // Evaluate safely
      const result = this._safeEvaluate(cleanExpr);

      // Generate steps if requested
      const stepByStep = steps ? this._generateSteps(expression, variables, result) : null;

      // Format based on student's learning style
      const formatted = this._formatResult(result, stepByStep, studentModel);

      return {
        result,
        formatted,
        steps: stepByStep,
        expression: cleanExpr,
      };
    } catch (err) {
      throw new Error(`Invalid expression: ${err.message}`);
    }
  }

  /**
   * Clean expression by substituting variables and normalizing
   */
  _cleanExpression(expr, variables) {
    let cleaned = expr;

    // Substitute variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      cleaned = cleaned.replace(regex, value.toString());
    }

    // Convert ^ to ** for exponentiation
    cleaned = cleaned.replace(/\^/g, '**');

    // Handle common math functions
    cleaned = cleaned
      .replace(/\bsin\b/g, 'Math.sin')
      .replace(/\bcos\b/g, 'Math.cos')
      .replace(/\btan\b/g, 'Math.tan')
      .replace(/\basin\b/g, 'Math.asin')
      .replace(/\bacos\b/g, 'Math.acos')
      .replace(/\batan\b/g, 'Math.atan')
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\babs\b/g, 'Math.abs')
      .replace(/\bln\b/g, 'Math.log')
      .replace(/\blog\b/g, 'Math.log10')
      .replace(/\bexp\b/g, 'Math.exp')
      .replace(/\bfloor\b/g, 'Math.floor')
      .replace(/\bceil\b/g, 'Math.ceil')
      .replace(/\bround\b/g, 'Math.round')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\be\b/g, 'Math.E');

    return cleaned;
  }

  /**
   * Safe evaluation using Function constructor with strict validation
   */
  _safeEvaluate(expr) {
    // Security check: only allow safe characters and patterns
    if (!this._isSafeExpression(expr)) {
      throw new Error('Expression contains unsafe patterns');
    }

    try {
      // Use Function constructor for evaluation (safer than eval)
      const func = new Function('Math', `"use strict"; return (${expr})`);
      const result = func(Math);

      // Handle precision issues
      if (typeof result === 'number') {
        return Math.round(result * 1e12) / 1e12;
      }
      return result;
    } catch (err) {
      throw new Error(`Evaluation error: ${err.message}`);
    }
  }

  /**
   * Check if expression contains only safe patterns
   */
  _isSafeExpression(expr) {
    // Block any attempts to access objects or execute code
    const unsafePatterns = [
      /[\[\]{};]/,           // No brackets, braces, semicolons
      /function/,            // No function definitions
      /return/,              // No return statements
      /new\s+/,              // No constructors
      /Math\.[a-zA-Z]+\s*\([^)]*\)\s*\(/, // No chained calls
      /\.\s*call\b/,         // No .call
      /\.\s*apply\b/,        // No .apply
      /__proto__/,           // No prototype access
      /constructor/,         // No constructor access
    ];

    for (const pattern of unsafePatterns) {
      if (pattern.test(expr)) {
        return false;
      }
    }

    // Allow only numbers, operators, Math functions, and whitespace
    const safePattern = /^[0-9+\-*/().,\s]|Math\.(?:sin|cos|tan|asin|acos|atan|sqrt|abs|log|log10|exp|floor|ceil|round|PI|E)\b/g;
    const cleaned = expr.replace(safePattern, '');

    return cleaned.length === 0;
  }

  /**
   * Generate step-by-step working
   */
  _generateSteps(originalExpr, variables, finalResult) {
    const steps = [];

    // Step 1: Original expression
    steps.push(`Original expression: ${originalExpr}`);

    // Step 2: Substitute variables if any
    if (Object.keys(variables).length > 0) {
      const subbed = this._cleanExpression(originalExpr, variables);
      steps.push(`Substitute values: ${subbed}`);
    }

    // Step 3: Break down complex expressions (simplified approach)
    const expr = this._cleanExpression(originalExpr, variables);

    // Handle parentheses
    if (expr.includes('(')) {
      const innerMatch = expr.match(/\(([^()]+)\)/);
      if (innerMatch) {
        const inner = innerMatch[1];
        const innerResult = this._safeEvaluate(inner);
        steps.push(`Evaluate inside parentheses: ${inner} = ${innerResult}`);

        const afterInner = expr.replace(/\([^()]+\)/, innerResult.toString());
        steps.push(`Expression becomes: ${afterInner}`);
      }
    }

    // Handle multiplication/division left to right
    const mulDivMatch = expr.match(/(\d+\.?\d*)\s*([*/])\s*(\d+\.?\d*)/);
    if (mulDivMatch && !steps.some(s => s.includes('multiplication') || s.includes('division'))) {
      const [_, left, op, right] = mulDivMatch;
      const partial = op === '*' ? parseFloat(left) * parseFloat(right) : parseFloat(left) / parseFloat(right);
      steps.push(`Perform ${op === '*' ? 'multiplication' : 'division'}: ${left} ${op} ${right} = ${partial}`);
    }

    // Handle addition/subtraction
    const addSubMatch = expr.match(/(\d+\.?\d*)\s*([+-])\s*(\d+\.?\d*)/);
    if (addSubMatch && !steps.some(s => s.includes('addition') || s.includes('subtraction'))) {
      const [_, left, op, right] = addSubMatch;
      const partial = op === '+' ? parseFloat(left) + parseFloat(right) : parseFloat(left) - parseFloat(right);
      steps.push(`Perform ${op === '+' ? 'addition' : 'subtraction'}: ${left} ${op} ${right} = ${partial}`);
    }

    // Final result
    steps.push(`Final result = ${finalResult}`);

    return steps;
  }

  /**
   * Format result based on student's learning style
   */
  _formatResult(result, steps, studentModel) {
    const style = studentModel?.learningStyle?.preferredRepresentation || 'balanced';

    if (style === 'visual' && steps) {
      return steps.join('\n');
    } else if (style === 'numerical' && typeof result === 'number') {
      return `Result: ${result}\n\nAs a fraction: ${this._toFraction(result)}`;
    }

    return steps ? steps.join('\n') : result.toString();
  }

  /**
   * Convert decimal to approximate fraction
   */
  _toFraction(decimal) {
    const tolerance = 1.0e-6;
    let numerator = 1;
    let denominator = 1;
    let bestNum = 1;
    let bestDen = 1;
    let bestErr = Math.abs(decimal - numerator/denominator);

    for (denominator = 1; denominator <= 1000; denominator++) {
      numerator = Math.round(decimal * denominator);
      const err = Math.abs(decimal - numerator/denominator);
      if (err < bestErr) {
        bestErr = err;
        bestNum = numerator;
        bestDen = denominator;
        if (err < tolerance) break;
      }
    }

    return `${bestNum}/${bestDen}`;
  }
}

module.exports = CalculatorTool;