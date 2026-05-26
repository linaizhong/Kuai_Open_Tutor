# Skill: english-advanced

## Meta
- **Name**: english-advanced
- **Type**: active
- **Category**: english
- **Phase**: HSC English Advanced tutoring
- **Version**: 1.1.0

## Description
Provides comprehensive support for HSC English Advanced, including essay writing, textual analysis, module-specific guidance, and model responses for prescribed texts.

## Triggers
```json
{
  "keywords": [
    "prescribed text", "my prescribed text", "my text", "the tempest", "nineteen eighty-four",
    "1984", "the crucible", "the merchant of venice", "the great gatsby", "the tragedy of king lear",
    "king lear", "the curious incident of the dog in the night-time", "the curious incident",
    "the turning", "the woman in black", "the stranger", "the handmaid's tale", "the secret river",
    "the boy behind the curtain", "the simple gift", "the story of tom brennan", "the willow pattern",
    "module a", "module b", "module c", "common module", "texts and human experiences",
    "essay question", "essay topic", "practice essay", "model essay", "sample essay",
    "essay structure", "how to write an essay", "essay paragraph", "thesis statement",
    "introduction paragraph", "body paragraph", "conclusion paragraph", "textual analysis",
    "analyse this quote", "analyse this text", "literary techniques", "language techniques",
    "technique analysis", "quote analysis", "character analysis", "theme analysis",
    "discursive writing", "imaginative writing", "persuasive writing", "creative writing piece",
    "reflection statement", "paper 1", "paper 2", "hsc english", "english advanced"
  ],
  "intent": "get help with HSC English Advanced essay writing, textual analysis, or prescribed text study"
}
```

## Workflow

1. Detect if the query mentions a prescribed text (check against list of HSC texts)
2. Identify the specific English task type:
    - Essay writing / model response
    - Textual analysis / quote analysis
    - Module-specific guidance
    - Creative writing
    - Exam preparation
3. Retrieve relevant textual analysis guidance from knowledge base
4. Generate appropriate response based on task type
5. Provide feedback on student's writing if submitted
6. Track progress in English skills

## Tools Used

- `knowledge-query` - Access English syllabus and textual analysis guides
- `syllabus-matcher` - Identify module and text requirements
- `error-analyzer` - Analyze writing for common English errors
- `marking-guideline` - Score responses against HSC English rubrics
- `learning-style-detector` - Adapt feedback based on learning preferences
- `affective-detector` - Detect frustration with complex texts

## Inputs

- `userInput`: student's question or writing sample
- `taskType`: 'essay' | 'analysis' | 'creative' | 'module-study' | 'model-response' | 'exam-prep'
- `module`: 'common-module' | 'module-a' | 'module-b' | 'module-c'
- `prescribedText`: name of the text being studied
- `studentWriting`: optional essay or paragraph for feedback

## Outputs

- `result`: helpful English guidance or model response
- `module`: identified module code
- `text`: identified prescribed text
- `memoryUpdates`: tracks English practice attempts

## Examples

```json
{
  "userInput": "Give me a practice question on my prescribed text.",
  "taskType": "exam-prep",
  "prescribedText": "The Tempest"
}
```

```json
{
  "userInput": "Show me a model essay introduction for a Module A question on 1984.",
  "taskType": "model-response",
  "module": "module-a",
  "prescribedText": "Nineteen Eighty-Four"
}
```

```json
{
  "userInput": "Analyse this quote from The Crucible: 'I have given you my soul; leave me my name!'",
  "taskType": "analysis",
  "prescribedText": "The Crucible"
}
```

```json
{
  "userInput": "What techniques does George Orwell use in 1984 to convey the theme of surveillance?",
  "taskType": "analysis",
  "prescribedText": "Nineteen Eighty-Four"
}
```

## Response Templates

### For Practice Questions
```
Here's a practice question for ${prescribedText} that would be suitable for HSC English Advanced:

${question}

This question would typically be worth 20 marks in Paper 2. When answering, remember to:
- Address the module rubric
- Use detailed textual evidence
- Analyse techniques and their effects
- Link back to the question throughout
```

### For Model Responses
```
Here's a model ${essayType} for ${prescribedText}:

${modelResponse}

Key features of this response:
${features}
```

## Notes

- HSC English Advanced has four modules: Common Module, Module A, Module B, Module C
- Paper 1 (40 marks) focuses on the Common Module (Texts and Human Experiences)
- Paper 2 (60 marks) covers Modules A, B, and C
- Common prescribed texts list should be maintained in knowledge base
- Model responses should follow HSC marking criteria (1500-1800 words for full essays)
- Textual analysis should include techniques, quotes, and effect on reader
- Practice questions should mirror NESA exam style
