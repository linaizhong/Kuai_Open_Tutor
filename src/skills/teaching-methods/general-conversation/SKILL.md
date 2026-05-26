# Skill: general-conversation

## Meta
- **Name**: general-conversation
- **Type**: active
- **Category**: general
- **Phase**: General conversation and greetings
- **Version**: 1.3.0

## Description
Handles general conversation, greetings, and non-academic queries. Acts as a friendly tutor assistant and dynamically lists all available subjects.

## Triggers
```json
{
"keywords": [
"hello", "hi", "hey", "thanks", "thank you", "how are you",
"good morning", "good afternoon", "good evening", "help",
"what can you do", "who are you", "your name", "nice to meet you",
"how's it going", "what's up", "good to see you", "welcome",
"goodbye", "bye", "see you later", "have a good day",
"what subjects", "which subjects", "available subjects"
],
"intent": "general conversation or greeting"
}
```

## Workflow
1. Detect the intent of the user's message (greeting, farewell, capabilities, help, thanks, or other)
2. If greeting or farewell, select an appropriate friendly response template
3. If capabilities request, query the system for all available subjects
4. If help request, provide guidance on how to use the tutor
5. Personalize the response with the student's name if available
6. Return the final response

## Tools Used
- `affective-detector` - Detect user's mood from the message
- `learning-style-detector` - Adapt response style based on user preferences
- `knowledge-query` - Query available subjects (with type "subjects")

## Inputs
- `userInput`: user's message

## Outputs
- `result`: friendly response
- `intent`: detected intent
- `personalized`: whether name was used

## Response Templates

### For Greetings
Hello! I'm Tute, your personal AI tutor. How can I help you today?

Hi there! Ready to learn something new? I'm here to help!

Hey! Great to see you. What subject shall we study today?

### For Farewell
Goodbye! Great work today. Come back anytime!

See you later! Keep up the good studying!

Take care! Remember, practice makes perfect.

### For Capabilities
I can help you with these subjects:

{{SUBJECTS}}

Just select one from the dropdown and ask me anything!

### For Help
Here's how to use me:

1. **Choose a subject** from the dropdown at the top
2. **Ask questions** like:
    - 'Give me a practice question'
    - 'Explain [concept]'
    - 'Show me a worked example'
    - 'Check my answer'
3. **I'll adapt** to your level and learning style

What would you like to try first?

### For Thanks
You're welcome! Happy to help.

My pleasure! Let me know if you need anything else.

Anytime! That's what I'm here for.

### Default
I'm here to help with your studies! You can ask me for practice questions, explanations, or feedback on your work.

Not sure what to ask? Try 'Give me a practice question' or 'Explain something'.

I'm your study companion! Whatever subject you're studying, I've got you covered.

## Examples
```json
{
"userInput": "Hello, how are you today?"
}
```
```json
{
"userInput": "What subjects can you help me with?"
}
```
```json
{
"userInput": "I'm not sure where to start."
}
```
```json
{
"userInput": "Goodbye, thanks for your help!"
}
```
