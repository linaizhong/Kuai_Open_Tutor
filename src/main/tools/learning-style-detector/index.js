// tools/learning-style-detector/index.js
// Detects and tracks student learning style preferences

const BaseTool = require('../base');

class LearningStyleDetectorTool extends BaseTool {
  constructor() {
    super(
      'learning-style-detector',
      'Detect and track student learning style preferences from interactions',
      '1.0.0'
    );
  }

  getParameters() {
    return [
      {
        name: 'interaction',
        type: 'object',
        description: 'Student interaction data',
        required: true,
      },
      {
        name: 'studentId',
        type: 'string',
        description: 'Student ID for persistent tracking',
        required: true,
      },
    ];
  }

  async execute(params, context) {
    const { interaction, studentId } = params;
    const { memory, studentModel } = context;

    // Analyze interaction for style signals
    const signals = this._analyzeInteraction(interaction);

    // Get current style from memory
    let currentStyle = null;
    if (memory?.getLearningStyle) {
      currentStyle = memory.getLearningStyle(studentId);
    } else {
      currentStyle = studentModel?.learningStyle || {
        preferredRepresentation: null,
        respondsWellTo: [],
        strugglesWith: [],
        observationCount: 0,
      };
    }

    // Update style with new signals
    const updatedStyle = this._updateStyle(currentStyle, signals);

    // Store in memory if available
    if (memory?.updateLearningStyle) {
      memory.updateLearningStyle(studentId, {
        preferredRepresentation: updatedStyle.preferredRepresentation,
        respondsWellTo: updatedStyle.respondsWellTo,
        strugglesWith: updatedStyle.strugglesWith,
      });
    }

    // Generate recommendations
    const recommendations = this._generateRecommendations(updatedStyle);

    return {
      learningStyle: updatedStyle,
      recommendations,
      confidence: this._calculateConfidence(updatedStyle),
      signalsDetected: signals,
    };
  }

  _analyzeInteraction(interaction) {
    const signals = {
      prefersVisual: false,
      prefersAlgebraic: false,
      prefersNumerical: false,
      respondsToExamples: false,
      respondsToAnalogies: false,
      strugglesWithAbstract: false,
      strugglesWithNotation: false,
    };

    const text = interaction.userInput?.toLowerCase() || '';
    const response = interaction.response?.toLowerCase() || '';

    // Detect preferences from user requests
    if (text.includes('draw') || text.includes('sketch') || text.includes('graph') || text.includes('diagram')) {
      signals.prefersVisual = true;
    }
    if (text.includes('formula') || text.includes('equation') || text.includes('algebra')) {
      signals.prefersAlgebraic = true;
    }
    if (text.includes('number') || text.includes('example with numbers') || text.includes('calculate')) {
      signals.prefersNumerical = true;
    }
    if (text.includes('example') || text.includes('instance') || text.includes('show me how')) {
      signals.respondsToExamples = true;
    }
    if (text.includes('like') || text.includes('similar to') || text.includes('compare')) {
      signals.respondsToAnalogies = true;
    }

    // Detect struggles from user frustration
    if (text.includes('confusing') || text.includes('don\'t understand') || text.includes('too abstract')) {
      signals.strugglesWithAbstract = true;
    }
    if (text.includes('notation') || text.includes('symbols') || text.includes('what does this mean')) {
      signals.strugglesWithNotation = true;
    }

    // Analyze response effectiveness
    if (response.includes('thank') || response.includes('helpful') || response.includes('got it')) {
      // Positive response to whatever was just used
      // This would need context of what was just taught
    }

    return signals;
  }

  _updateStyle(currentStyle, signals) {
    const updated = { ...currentStyle };
    const weights = {};

    // Count signals
    if (signals.prefersVisual) weights.visual = (weights.visual || 0) + 2;
    if (signals.prefersAlgebraic) weights.algebraic = (weights.algebraic || 0) + 2;
    if (signals.prefersNumerical) weights.numerical = (weights.numerical || 0) + 2;
    if (signals.respondsToExamples) weights.examples = (weights.examples || 0) + 1;
    if (signals.respondsToAnalogies) weights.analogies = (weights.analogies || 0) + 1;

    // Determine preferred representation
    const representations = ['visual', 'algebraic', 'numerical'];
    let bestRep = updated.preferredRepresentation;
    let bestScore = 0;

    for (const rep of representations) {
      const score = weights[rep] || 0;
      if (score > bestScore) {
        bestScore = score;
        bestRep = rep;
      }
    }

    if (bestScore > 0) {
      updated.preferredRepresentation = bestRep;
    }

    // Update respondsWellTo
    updated.respondsWellTo = updated.respondsWellTo || [];
    if (signals.respondsToExamples && !updated.respondsWellTo.includes('examples')) {
      updated.respondsWellTo.push('examples');
    }
    if (signals.respondsToAnalogies && !updated.respondsWellTo.includes('analogies')) {
      updated.respondsWellTo.push('analogies');
    }

    // Update strugglesWith
    updated.strugglesWith = updated.strugglesWith || [];
    if (signals.strugglesWithAbstract && !updated.strugglesWith.includes('abstract concepts')) {
      updated.strugglesWith.push('abstract concepts');
    }
    if (signals.strugglesWithNotation && !updated.strugglesWith.includes('mathematical notation')) {
      updated.strugglesWith.push('mathematical notation');
    }

    updated.observationCount = (updated.observationCount || 0) + 1;
    updated.lastUpdated = new Date().toISOString();

    return updated;
  }

  _generateRecommendations(style) {
    const recommendations = [];

    switch (style.preferredRepresentation) {
      case 'visual':
        recommendations.push('Use diagrams, graphs, and visual aids');
        recommendations.push('Sketch problems before solving');
        break;
      case 'algebraic':
        recommendations.push('Write out formulas and equations');
        recommendations.push('Focus on symbolic manipulation');
        break;
      case 'numerical':
        recommendations.push('Try concrete numbers first');
        recommendations.push('Work through examples with actual values');
        break;
    }

    if (style.respondsWellTo?.includes('examples')) {
      recommendations.push('Request worked examples for new concepts');
    }
    if (style.respondsWellTo?.includes('analogies')) {
      recommendations.push('Ask for analogies to understand abstract ideas');
    }
    if (style.strugglesWith?.includes('abstract concepts')) {
      recommendations.push('Start with concrete examples before generalizing');
    }
    if (style.strugglesWith?.includes('mathematical notation')) {
      recommendations.push('Practice translating symbols into words');
    }

    return recommendations;
  }

  _calculateConfidence(style) {
    if (style.observationCount < 5) return 'low';
    if (style.observationCount < 15) return 'medium';
    return 'high';
  }
}

module.exports = LearningStyleDetectorTool;