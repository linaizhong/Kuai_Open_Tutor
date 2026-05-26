// tools/affective-detector/index.js
// Detects student's emotional and engagement state from interactions

const BaseTool = require('../base');

class AffectiveDetectorTool extends BaseTool {
  constructor() {
    super(
      'affective-detector',
      'Detect student emotional and engagement state from interactions',
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
    const { memory } = context;

    // Analyze interaction for affective signals
    const signals = this._analyzeAffectiveSignals(interaction);

    // Get current affective state from memory
    let currentState = null;
    if (memory?.getCurrentAffectiveState) {
      currentState = memory.getCurrentAffectiveState(studentId);
    }

    // Determine new affective state
    const newState = this._determineState(signals, currentState);

    // Store in memory if available
    if (memory?.updateAffectiveState) {
      memory.updateAffectiveState(studentId, {
        engagement: newState.engagement,
        sessionAttempts: interaction.sessionAttempts || 0,
        recentSuccessRate: interaction.recentSuccessRate,
        notes: signals.notes,
      });
    }

    // Generate response adjustments based on state
    const adjustments = this._generateAdjustments(newState);

    return {
      affectiveState: newState,
      signals,
      adjustments,
      requiresIntervention: newState.engagement === 'frustrated' || newState.engagement === 'disengaged',
    };
  }

  _analyzeAffectiveSignals(interaction) {
    const text = interaction.userInput?.toLowerCase() || '';
    const signals = {
      frustration: 0,
      confidence: 0,
      fatigue: 0,
      engagement: 0,
      notes: [],
    };

    // Frustration indicators
    const frustrationPhrases = [
      'don\'t understand', 'confusing', 'too hard', 'stuck',
      'what does that mean', 'i give up', 'this is difficult',
      'not making sense', 'help me', 'i\'m lost',
    ];
    for (const phrase of frustrationPhrases) {
      if (text.includes(phrase)) {
        signals.frustration += 2;
        signals.notes.push(`frustration: ${phrase}`);
      }
    }

    // Confidence indicators
    const confidencePhrases = [
      'i understand', 'got it', 'makes sense', 'i see',
      'that helps', 'thank you', 'i can do this',
    ];
    for (const phrase of confidencePhrases) {
      if (text.includes(phrase)) {
        signals.confidence += 2;
        signals.notes.push(`confidence: ${phrase}`);
      }
    }

    // Fatigue indicators (short responses, repetition)
    if (text.length < 20 && interaction.sessionAttempts > 5) {
      signals.fatigue += 1;
      signals.notes.push('fatigue: very short response after many attempts');
    }

    // Check for repeated questions (stuck in loop)
    if (interaction.repeatedQuestion) {
      signals.frustration += 3;
      signals.notes.push('frustration: repeated same question');
    }

    // Check success rate
    if (interaction.recentSuccessRate !== undefined) {
      if (interaction.recentSuccessRate < 0.3) {
        signals.frustration += 2;
        signals.notes.push('frustration: low success rate');
      } else if (interaction.recentSuccessRate > 0.8) {
        signals.confidence += 2;
        signals.notes.push('confidence: high success rate');
      }
    }

    // Engagement based on response time and length
    if (interaction.responseTimeMs > 30000) {
      signals.fatigue += 1;
      signals.notes.push('fatigue: slow response time');
    }

    return signals;
  }

  _determineState(signals, currentState) {
    const state = {
      engagement: 'focused', // focused, frustrated, confident, fatigued, disengaged
      frustrationDepth: 'none', // none, mild, moderate, severe
      confidence: 'neutral', // low, neutral, high
      timestamp: new Date().toISOString(),
    };

    // Determine engagement
    if (signals.frustration > signals.confidence * 2) {
      if (signals.frustration >= 5) {
        state.engagement = 'frustrated';
        state.frustrationDepth = 'severe';
      } else if (signals.frustration >= 3) {
        state.engagement = 'frustrated';
        state.frustrationDepth = 'moderate';
      } else if (signals.frustration >= 1) {
        state.engagement = 'frustrated';
        state.frustrationDepth = 'mild';
      }
    } else if (signals.confidence > signals.frustration * 2) {
      state.engagement = 'confident';
    } else if (signals.fatigue >= 2) {
      state.engagement = 'fatigued';
    } else if (signals.frustration === 0 && signals.confidence === 0 && signals.fatigue === 0) {
      state.engagement = 'focused';
    }

    // Determine confidence level
    if (signals.confidence >= 4) {
      state.confidence = 'high';
    } else if (signals.confidence >= 2) {
      state.confidence = 'neutral';
    } else {
      state.confidence = 'low';
    }

    // Blend with current state for continuity
    if (currentState) {
      state.engagement = this._blendEngagement(currentState.currentEngagement, state.engagement);
    }

    return state;
  }

  _blendEngagement(previous, current) {
    // Maintain state for at least a few interactions to avoid flickering
    const stableStates = ['frustrated', 'confident'];
    if (stableStates.includes(previous) && previous !== current) {
      // Only change if signals are very strong
      return previous;
    }
    return current;
  }

  _generateAdjustments(state) {
    const adjustments = {
      tone: 'neutral',
      scaffolding: 'normal',
      urgency: 'none',
      encouragement: 'normal',
    };

    switch (state.engagement) {
      case 'frustrated':
        adjustments.tone = 'warm';
        adjustments.scaffolding = 'heavy';
        adjustments.encouragement = 'high';
        adjustments.urgency = 'none';
        break;

      case 'confident':
        adjustments.tone = 'direct';
        adjustments.scaffolding = 'light';
        adjustments.encouragement = 'normal';
        adjustments.urgency = 'challenge';
        break;

      case 'fatigued':
        adjustments.tone = 'warm';
        adjustments.scaffolding = 'medium';
        adjustments.encouragement = 'high';
        adjustments.urgency = 'none';
        break;

      case 'disengaged':
        adjustments.tone = 'encouraging';
        adjustments.scaffolding = 'light';
        adjustments.encouragement = 'very high';
        adjustments.urgency = 'none';
        break;

      default: // focused
        adjustments.tone = 'neutral';
        adjustments.scaffolding = 'normal';
        adjustments.encouragement = 'normal';
        adjustments.urgency = 'none';
    }

    return adjustments;
  }
}

module.exports = AffectiveDetectorTool;