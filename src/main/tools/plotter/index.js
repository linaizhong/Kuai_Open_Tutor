// tools/plotter/index.js
// Function plotting tool with data generation for frontend visualization

const BaseTool = require('../base');

class PlotterTool extends BaseTool {
  constructor() {
    super(
      'plotter',
      'Generate plot data for mathematical functions',
      '1.0.0'
    );
  }

  getParameters() {
    return [
      {
        name: 'function',
        type: 'string',
        description: 'Function to plot (e.g., "x^2", "sin(x)", "2*x + 1")',
        required: true,
      },
      {
        name: 'xMin',
        type: 'number',
        description: 'Minimum x value',
        required: false,
        default: -10,
      },
      {
        name: 'xMax',
        type: 'number',
        description: 'Maximum x value',
        required: false,
        default: 10,
      },
      {
        name: 'points',
        type: 'number',
        description: 'Number of points to generate',
        required: false,
        default: 200,
      },
      {
        name: 'title',
        type: 'string',
        description: 'Plot title',
        required: false,
      },
    ];
  }

  validateParams(params) {
    if (!params.function) {
      throw new Error('Plotter tool requires a function');
    }
  }

  async execute(params, context) {
    const {
      function: funcStr,
      xMin = -10,
      xMax = 10,
      points = 200,
      title
    } = params;
    const { studentModel, knowledgeBase } = context;

    // Clean and prepare the function
    const cleanFunc = this._prepareFunction(funcStr);

    // Generate plot data
    const data = this._generatePlotData(cleanFunc, xMin, xMax, points);

    // Analyze function type and key features
    const analysis = this._analyzeFunction(funcStr, cleanFunc, data);

    // Format based on student's learning style
    const formatted = this._formatAnalysis(analysis, studentModel);

    return {
      visualization: {
        type: 'function-plot',
        data: data.points,
        config: {
          title: title || `Plot of ${funcStr}`,
          xLabel: 'x',
          yLabel: 'f(x)',
          xMin: data.xMin,
          xMax: data.xMax,
          yMin: data.yMin,
          yMax: data.yMax,
          keyPoints: analysis.keyPoints,
        },
      },
      analysis: {
        type: analysis.type,
        domain: analysis.domain,
        range: analysis.range,
        intercepts: analysis.intercepts,
        asymptotes: analysis.asymptotes,
        turningPoints: analysis.turningPoints,
        period: analysis.period,
        amplitude: analysis.amplitude,
      },
      formatted,
    };
  }

  /**
   * Prepare function string for evaluation
   */
  _prepareFunction(funcStr) {
    let prepared = funcStr
      .replace(/\^/g, '**')
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
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\be\b/g, 'Math.E');

    return prepared;
  }

  /**
   * Generate plot data points
   */
  _generatePlotData(funcStr, xMin, xMax, numPoints) {
    const step = (xMax - xMin) / (numPoints - 1);
    const points = [];
    let yMin = Infinity;
    let yMax = -Infinity;

    for (let i = 0; i < numPoints; i++) {
      const x = xMin + i * step;
      try {
        const y = this._evaluateFunction(funcStr, x);
        if (isFinite(y)) {
          points.push({ x, y });
          yMin = Math.min(yMin, y);
          yMax = Math.max(yMax, y);
        } else {
          points.push({ x, y: null }); // Gap for asymptotes
        }
      } catch {
        points.push({ x, y: null });
      }
    }

    // Add padding to y range
    const yPadding = (yMax - yMin) * 0.1;
    yMin -= yPadding;
    yMax += yPadding;

    return { points, xMin, xMax, yMin, yMax };
  }

  /**
   * Evaluate function at given x
   */
  _evaluateFunction(funcStr, x) {
    const func = new Function('x', 'Math', `"use strict"; return (${funcStr})`);
    return func(x, Math);
  }

  /**
   * Analyze function to identify key features
   */
  _analyzeFunction(originalFunc, cleanFunc, plotData) {
    const analysis = {
      type: this._detectFunctionType(originalFunc),
      domain: this._findDomain(cleanFunc),
      range: this._findRange(plotData),
      intercepts: this._findIntercepts(cleanFunc, plotData),
      asymptotes: this._findAsymptotes(cleanFunc, plotData),
      turningPoints: this._findTurningPoints(plotData),
      period: this._findPeriod(originalFunc),
      amplitude: this._findAmplitude(originalFunc, plotData),
      keyPoints: [],
    };

    // Collect key points for visualization
    analysis.keyPoints = [
      ...analysis.intercepts.x.map(x => ({ x, y: 0, label: 'x-intercept' })),
      ...analysis.intercepts.y.map(y => ({ x: 0, y, label: 'y-intercept' })),
      ...analysis.turningPoints.map(p => ({ ...p, label: 'turning point' })),
    ];

    return analysis;
  }

  /**
   * Detect function type from original string
   */
  _detectFunctionType(funcStr) {
    const f = funcStr.toLowerCase();
    if (f.includes('sin') || f.includes('cos') || f.includes('tan')) return 'trigonometric';
    if (f.includes('log') || f.includes('ln')) return 'logarithmic';
    if (f.includes('exp') || f.includes('e^')) return 'exponential';
    if (f.includes('sqrt')) return 'square root';
    if (f.includes('abs')) return 'absolute value';
    if (f.includes('^2') || f.includes('**2')) return 'quadratic';
    if (f.includes('^3') || f.includes('**3')) return 'cubic';
    if (f.includes('/x') || f.includes('1/x')) return 'rational';
    return 'general';
  }

  /**
   * Find domain of function
   */
  _findDomain(cleanFunc) {
    // Simple heuristic - check for division by zero and sqrt of negative
    const domain = { type: 'continuous', restrictions: [] };

    if (cleanFunc.includes('/') && !cleanFunc.includes('Math')) {
      domain.restrictions.push('x ≠ 0');
    }
    if (cleanFunc.includes('sqrt') || cleanFunc.includes('Math.sqrt')) {
      domain.restrictions.push('x ≥ 0');
    }
    if (cleanFunc.includes('log') || cleanFunc.includes('Math.log')) {
      domain.restrictions.push('x > 0');
    }

    return domain;
  }

  /**
   * Find range from plot data
   */
  _findRange(plotData) {
    const validY = plotData.points.filter(p => p.y !== null).map(p => p.y);
    if (validY.length === 0) return { min: null, max: null };

    return {
      min: Math.min(...validY),
      max: Math.max(...validY),
    };
  }

  /**
   * Find x and y intercepts
   */
  _findIntercepts(cleanFunc, plotData) {
    const intercepts = { x: [], y: [] };

    // Y-intercept at x = 0
    try {
      const yIntercept = this._evaluateFunction(cleanFunc, 0);
      if (isFinite(yIntercept)) {
        intercepts.y.push(yIntercept);
      }
    } catch {}

    // X-intercepts where y crosses zero
    for (let i = 1; i < plotData.points.length; i++) {
      const p1 = plotData.points[i-1];
      const p2 = plotData.points[i];

      if (p1.y !== null && p2.y !== null) {
        if (p1.y * p2.y < 0) {
          // Linear interpolation to find root
          const xRoot = p1.x - p1.y * (p2.x - p1.x) / (p2.y - p1.y);
          intercepts.x.push(parseFloat(xRoot.toFixed(4)));
        } else if (Math.abs(p1.y) < 0.01) {
          intercepts.x.push(parseFloat(p1.x.toFixed(4)));
        }
      }
    }

    // Remove duplicates
    intercepts.x = [...new Set(intercepts.x.map(x => parseFloat(x.toFixed(4))))];

    return intercepts;
  }

  /**
   * Find asymptotes (simplified detection)
   */
  _findAsymptotes(cleanFunc, plotData) {
    const asymptotes = { vertical: [], horizontal: [] };

    // Detect vertical asymptotes (large jumps in y)
    for (let i = 1; i < plotData.points.length; i++) {
      const p1 = plotData.points[i-1];
      const p2 = plotData.points[i];

      if ((p1.y === null && p2.y !== null) || (p1.y !== null && p2.y === null)) {
        asymptotes.vertical.push(parseFloat(((p1.x + p2.x) / 2).toFixed(4)));
      }
    }

    // Detect horizontal asymptotes (limit as x → ±∞)
    const lastPoints = plotData.points.slice(-10).filter(p => p.y !== null);
    if (lastPoints.length > 5) {
      const avgY = lastPoints.reduce((sum, p) => sum + p.y, 0) / lastPoints.length;
      asymptotes.horizontal.push(parseFloat(avgY.toFixed(4)));
    }

    return asymptotes;
  }

  /**
   * Find turning points (simplified)
   */
  _findTurningPoints(plotData) {
    const points = [];

    for (let i = 2; i < plotData.points.length - 2; i++) {
      const p = plotData.points[i];
      if (p.y === null) continue;

      const prev = plotData.points[i-1];
      const next = plotData.points[i+1];

      if (prev.y !== null && next.y !== null) {
        // Local maximum
        if (p.y > prev.y && p.y > next.y) {
          points.push({ x: parseFloat(p.x.toFixed(4)), y: parseFloat(p.y.toFixed(4)), type: 'maximum' });
        }
        // Local minimum
        if (p.y < prev.y && p.y < next.y) {
          points.push({ x: parseFloat(p.x.toFixed(4)), y: parseFloat(p.y.toFixed(4)), type: 'minimum' });
        }
      }
    }

    return points;
  }

  /**
   * Find period for trigonometric functions
   */
  _findPeriod(funcStr) {
    const f = funcStr.toLowerCase();
    if (f.includes('sin') || f.includes('cos')) {
      // Extract coefficient of x to determine period
      const match = f.match(/(\d*\.?\d+)\s*\*\s*x/);
      if (match) {
        const k = parseFloat(match[1]);
        return parseFloat((2 * Math.PI / Math.abs(k)).toFixed(4));
      }
      return 2 * Math.PI;
    }
    if (f.includes('tan')) {
      const match = f.match(/(\d*\.?\d+)\s*\*\s*x/);
      if (match) {
        const k = parseFloat(match[1]);
        return parseFloat((Math.PI / Math.abs(k)).toFixed(4));
      }
      return Math.PI;
    }
    return null;
  }

  /**
   * Find amplitude for trigonometric functions
   */
  _findAmplitude(funcStr, plotData) {
    if (!funcStr.toLowerCase().includes('sin') && !funcStr.toLowerCase().includes('cos')) {
      return null;
    }

    const validY = plotData.points.filter(p => p.y !== null).map(p => p.y);
    if (validY.length === 0) return null;

    const maxY = Math.max(...validY);
    const minY = Math.min(...validY);
    return parseFloat(((maxY - minY) / 2).toFixed(4));
  }

  /**
   * Format analysis based on learning style
   */
  _formatAnalysis(analysis, studentModel) {
    const style = studentModel?.learningStyle?.preferredRepresentation || 'balanced';

    if (style === 'visual') {
      return `Key features to mark on your sketch:
- Type: ${analysis.type}
- Domain: ${analysis.domain.restrictions.join(', ') || 'all real numbers'}
- Range: ${analysis.range.min?.toFixed(2)} to ${analysis.range.max?.toFixed(2)}
- x-intercepts: ${analysis.intercepts.x.join(', ') || 'none'}
- y-intercept: ${analysis.intercepts.y[0]?.toFixed(2) || 'none'}
- Asymptotes: ${analysis.asymptotes.vertical.map(x => `x = ${x.toFixed(2)}`).join(', ') || 'none'}
${analysis.period ? `- Period: ${analysis.period.toFixed(2)}` : ''}
${analysis.amplitude ? `- Amplitude: ${analysis.amplitude.toFixed(2)}` : ''}`;
    }

    return analysis;
  }
}

module.exports = PlotterTool;