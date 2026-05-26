// skills/request-tool/SKILL.md
# Skill: request-tool

## Meta
- **Name**: request-tool
- **Type**: active
- **Category**: core

## Triggers
```json
{
  "keywords": ["can you", "i wish you could", "it would be helpful if", 
               "create a tool", "new feature", "can we"],
  "intent": "request a new capability or tool"
}
```

## Workflow

1. Analyze student's request for a new teaching tool
2. Check if existing tools can handle it
3. If not, design a new tool specification
4. Generate the tool implementation
5. Test the tool with a sample interaction
6. Explain to student what was created