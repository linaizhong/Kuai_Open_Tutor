// services/prompt-templates.js
// Centralized storage for all LLM prompt templates
// Each template returns a structured array of messages

'use strict';

class PromptTemplates {
  /**
   * Template for generating explanations
   */
  static explanation(params) {
    const {
      topicName,
      topicDescription,
      subject,
      studentLevel,
      learningStyle,
      difficulty
    } = params;

    let formatInstruction = 'Use a mix of explanation and examples.';
    if (learningStyle === 'visual') {
      formatInstruction = 'Emphasise visual/spatial descriptions and diagrams.';
    } else if (learningStyle === 'numerical') {
      formatInstruction = 'Use concrete numerical examples throughout.';
    }

    return [
      {
        role: 'system',
        content: `You are an expert HSC ${subject} tutor. Generate a clear explanation for:
        Topic: ${topicName}
        Description: ${topicDescription}

        Student level: ${studentLevel}
        Difficulty: ${difficulty}
        ${formatInstruction}

        Return a JSON object with:
        {
          "explanation": "Main explanation text (structured with clear sections)",
          "examples": [{"problem": "...", "solution": "...", "explanation": "..."}],
          "keyPoints": ["point1", "point2", ...],
          "commonMisconceptions": [{"description": "...", "suggestion": "..."}]
        }`
      },
      {
        role: 'user',
        content: `Generate an explanation for ${topicName}.`
      }
    ];
  }

  /**
   * Template for generating questions
   */
  static questions(params) {
    const {
      topicName,
      topicDescription,
      subject,
      count,
      difficulty,
      studentLevel
    } = params;

    return [
      {
        role: 'system',
        content: `You are an expert HSC ${subject} tutor. Generate ${count} ${difficulty} difficulty questions for:
        Topic: ${topicName}
        Description: ${topicDescription}

        Student level: ${studentLevel}

        Return a JSON array of question objects with:
        [
          {
            "question": "question text",
            "type": "multiple-choice" or "open",
            "options": ["option1", "option2", "option3", "option4"] (if multiple-choice),
            "correctAnswer": "correct answer",
            "explanation": "why this is correct",
            "difficulty": "${difficulty}"
          }
        ]`
      },
      {
        role: 'user',
        content: `Generate ${count} questions about ${topicName}.`
      }
    ];
  }

  /**
   * Template for generating examples
   */
  static examples(params) {
    const {
      topicName,
      topicDescription,
      subject,
      count,
      difficulty
    } = params;

    return [
      {
        role: 'system',
        content: `You are an expert HSC ${subject} tutor. Generate ${count} ${difficulty} difficulty worked examples for:
        Topic: ${topicName}
        Description: ${topicDescription}

        Return a JSON array of example objects with:
        [
          {
            "problem": "the question",
            "solution": "step-by-step solution",
            "explanation": "explanation of the method",
            "keyTakeaways": ["point1", "point2"]
          }
        ]`
      },
      {
        role: 'user',
        content: `Generate ${count} examples for ${topicName}.`
      }
    ];
  }

  /**
   * Template for generating misconceptions
   */
  static misconceptions(params) {
    const {
      topicName,
      topicDescription,
      subject
    } = params;

    return [
      {
        role: 'system',
        content: `You are an expert HSC ${subject} tutor. Identify common misconceptions students have about:
        Topic: ${topicName}
        Description: ${topicDescription}

        Return a JSON array of misconception objects with:
        [
          {
            "description": "what students mistakenly think",
            "suggestion": "how to correct this misconception",
            "example": "example of the mistake (optional)"
          }
        ]`
      },
      {
        role: 'user',
        content: `What are common misconceptions about ${topicName}?`
      }
    ];
  }

  /**
   * Template for generating exam tips
   */
  static examTips(params) {
    const {
      topicName,
      topicDescription,
      subject
    } = params;

    return [
      {
        role: 'system',
        content: `You are an expert HSC ${subject} tutor. Provide exam tips for:
        Topic: ${topicName}
        Description: ${topicDescription}

        Return a JSON array of tip strings, each being a concise, actionable piece of advice.`
      },
      {
        role: 'user',
        content: `What are the key exam tips for ${topicName}?`
      }
    ];
  }

  /**
   * Template for generating a complete lesson plan
   */
  static lessonPlan(params) {
    const {
      topicName,
      topicDescription,
      subject,
      studentLevel,
      duration = 45
    } = params;

    return [
      {
        role: 'system',
        content: `You are an expert HSC ${subject} tutor. Create a ${duration}-minute lesson plan for:
        Topic: ${topicName}
        Description: ${topicDescription}

        Student level: ${studentLevel}

        Return a JSON object with:
        {
          "objectives": ["objective1", "objective2", ...],
          "sections": [
            {
              "name": "section name",
              "duration": minutes,
              "content": "what to cover",
              "activities": ["activity1", "activity2"]
            }
          ],
          "homework": ["task1", "task2"],
          "assessment": "how to assess understanding"
        }`
      },
      {
        role: 'user',
        content: `Create a lesson plan for ${topicName}.`
      }
    ];
  }

  /**
   * Template for generating feedback on student answers
   */
  static feedback(params) {
    const {
      question,
      studentAnswer,
      correctAnswer,
      topicName,
      studentLevel
    } = params;

    return [
      {
        role: 'system',
        content: `You are an expert HSC tutor providing feedback to a ${studentLevel} level student.

        Question: ${question}
        Correct answer/guideline: ${correctAnswer || 'See marking criteria'}

        Provide constructive feedback that:
        1. Starts with what they did well
        2. Identifies specific areas for improvement
        3. Gives actionable suggestions
        4. Maintains encouraging tone

        Return a JSON object with:
        {
          "strengths": ["strength1", "strength2"],
          "improvements": ["improvement1", "improvement2"],
          "feedback": "detailed feedback text",
          "score": 0.0-1.0 (optional)
        }`
      },
      {
        role: 'user',
        content: `Student answer: ${studentAnswer}`
      }
    ];
  }

  /**
   * Template for adapting content to student level
   */
  static adaptContent(params) {
    const {
      content,
      fromLevel,
      toLevel,
      topicName
    } = params;

    return [
      {
        role: 'system',
        content: `Adapt the following ${topicName} content from ${fromLevel} to ${toLevel} level.

        For ${toLevel} level:
        - Beginner: simpler language, more examples, avoid jargon
        - Intermediate: balanced explanation, introduce terminology
        - Advanced: concise, include nuance, connect to exam contexts

        Return the adapted content preserving all key information.`
      },
      {
        role: 'user',
        content: content
      }
    ];
  }
}

module.exports = PromptTemplates;