# Echo PDK - Complete Usage Guide

This guide covers everything you need to use Echo PDK effectively, from basic templates to advanced AI-powered conditions.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Variables](#variables)
- [Conditionals](#conditionals)
- [Operators](#operators)
- [Sections & Includes](#sections--includes)
- [AI Judge](#ai-judge)
- [Custom Operators](#custom-operators)
- [Plugins](#plugins)
- [Error Handling](#error-handling)
- [Configuration](#configuration)
- [Real-World Examples](#real-world-examples)

---

## Installation

```bash
npm install @echopdk/core
# or
pnpm add @echopdk/core
# or
yarn add @echopdk/core
```

## Quick Start

```typescript
import { createEcho } from '@echopdk/core';

// Create an Echo instance
const echo = createEcho();

// Define a prompt template
const template = `
You are an AI assistant helping {{user.name}}.

[#IF {{user.expertise}} #equals(beginner)]
Use simple language and explain concepts thoroughly.
Avoid jargon and technical terms.
[ELSE IF {{user.expertise}} #equals(expert)]
Be concise and technical.
Assume familiarity with advanced concepts.
[END IF]

[#IF {{context.hasCodebase}} #exists]
The user is working on a {{context.language}} project.
[END IF]

User query: {{query}}
`;

// Render the prompt with context
const prompt = await echo.render(template, {
  user: { name: 'Alice', expertise: 'beginner' },
  context: { hasCodebase: true, language: 'TypeScript' },
  query: 'How do I handle errors?'
});

// Send to your LLM
const response = await llm.complete(prompt);
```

**Rendered prompt:**
```
You are an AI assistant helping Alice.

Use simple language and explain concepts thoroughly.
Avoid jargon and technical terms.

The user is working on a TypeScript project.

User query: How do I handle errors?
```

---

## Variables

Variables inject runtime context into your prompts.

### Basic Variables

```
You are a {{role}} assistant.
Help the user with their {{task}} request.
```

```typescript
await echo.render(template, {
  role: 'coding',
  task: 'debugging'
});
// Output: You are a coding assistant.
// Help the user with their debugging request.
```

### Nested Access

Access nested object properties using dot notation:

```
You are assisting {{user.name}} who works as a {{user.job.title}}.
Their expertise level is {{user.profile.level}}.
```

```typescript
await echo.render(template, {
  user: {
    name: 'Alice',
    job: { title: 'Software Engineer' },
    profile: { level: 'senior' }
  }
});
```

### Array Access

Access array elements using bracket notation:

```
Primary tool: {{tools[0]}}
User's first preference: {{user.preferences[0]}}

Recent conversation context:
- {{history[0].content}}
- {{history[1].content}}
```

```typescript
await echo.render(template, {
  tools: ['code_search', 'file_read', 'execute'],
  user: { preferences: ['concise', 'technical'] },
  history: [
    { role: 'user', content: 'How do I fix this bug?' },
    { role: 'assistant', content: 'Let me analyze the code...' }
  ]
});
```

### Default Values

Provide fallback values for optional context:

```
You are a {{persona ?? "helpful assistant"}}.
Respond in {{language ?? "English"}}.
Temperature setting: {{config.temperature ?? "0.7"}}
```

```typescript
await echo.render(template, {
  persona: 'senior developer'
  // language and config.temperature will use defaults
});
// Output: You are a senior developer.
// Respond in English.
// Temperature setting: 0.7
```

---

## Conditionals

Conditionals control which parts of your prompt are included based on runtime context. This is the core power of Echo - **only send relevant instructions to the LLM**.

### Basic IF

```
You are a helpful assistant.

[#IF {{tools}} #exists]
You have access to the following tools:
{{tools}}
[END IF]
```

### IF / ELSE

```
[#IF {{user.isPremium}} #exists]
You may provide detailed, comprehensive responses.
Use advanced analysis and multiple examples.
[ELSE]
Keep responses concise (under 200 words).
Suggest upgrading for more detailed help.
[END IF]
```

### IF / ELSE IF / ELSE

```
[#IF {{task}} #equals(code_review)]
Review the code for bugs, security issues, and best practices.
Be thorough and suggest specific improvements.
[ELSE IF {{task}} #equals(explain)]
Explain the code clearly for a junior developer.
Break down complex logic step by step.
[ELSE IF {{task}} #equals(optimize)]
Focus on performance improvements.
Identify bottlenecks and suggest optimizations.
[ELSE]
Help the user with their coding question.
[END IF]
```

### Nested Conditionals

```
[#IF {{codebase}} #exists]
You are working with the user's codebase.
  [#IF {{codebase.language}} #equals(typescript)]
  Use TypeScript best practices and proper typing.
    [#IF {{codebase.framework}} #equals(react)]
    Follow React patterns: hooks, functional components, proper state management.
    [END IF]
  [ELSE IF {{codebase.language}} #equals(python)]
  Follow PEP 8 style guidelines.
  Use type hints where appropriate.
  [END IF]
[END IF]
```

---

## Operators

Operators evaluate conditions in `[#IF]` blocks. Echo provides **readable names** for low-code users and **short aliases** for developers.

### Comparison Operators

| Operator | Alias | Description | Example |
|----------|-------|-------------|---------|
| `#equals(value)` | - | Exact match (case-insensitive) | `{{status}} #equals(active)` |
| `#contains(value)` | - | String/array contains value | `{{tags}} #contains(urgent)` |
| `#matches(regex)` | - | Regex pattern match | `{{email}} #matches(.*@company.com)` |
| `#one_of(a,b,c)` | `#in` | Value is in list | `{{status}} #one_of(pending,active)` |

### Numeric Operators

| Operator | Alias | Description | Example |
|----------|-------|-------------|---------|
| `#greater_than(n)` | `#gt` | Greater than | `{{age}} #greater_than(18)` |
| `#greater_than_or_equal(n)` | `#gte` | Greater than or equal | `{{score}} #greater_than_or_equal(70)` |
| `#less_than(n)` | `#lt` | Less than | `{{quantity}} #less_than(10)` |
| `#less_than_or_equal(n)` | `#lte` | Less than or equal | `{{price}} #less_than_or_equal(100)` |

### Unary Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `#exists` | Value is defined and not empty | `{{user.preferences}} #exists` |

### AI Operator

| Operator | Description | Example |
|----------|-------------|---------|
| `#ai_judge(question)` | LLM-evaluated boolean | `{{content}} #ai_judge(Is this safe?)` |

### Examples

```
[#IF {{context.tokenCount}} #greater_than(4000)]
Note: Large context provided. Focus on the most relevant parts.
Summarize when appropriate.
[END IF]

[#IF {{user.query}} #matches(.*password.*|.*secret.*|.*api.?key.*)]
SECURITY: Never reveal sensitive information like passwords or API keys.
[END IF]

[#IF {{model}} #one_of(gpt-4,gpt-4-turbo,claude-3-opus)]
You are running on an advanced model. Use sophisticated reasoning.
[ELSE]
Keep reasoning straightforward for optimal performance.
[END IF]

[#IF {{conversation.messages}} #contains(error)]
The user has mentioned errors. Prioritize debugging assistance.
[END IF]
```

**Note:** Both readable names and aliases work identically. Use `#greater_than(18)` or `#gt(18)` - they behave the same.

---

## Sections & Includes

Sections let you define reusable prompt blocks - perfect for system prompts, guardrails, and shared instructions.

### Defining Sections

```
[#SECTION name="persona"]
You are an expert software architect with 20 years of experience.
You specialize in distributed systems and cloud architecture.
You communicate clearly and back up recommendations with reasoning.
[END SECTION]

[#SECTION name="guardrails"]
IMPORTANT CONSTRAINTS:
- Never execute or suggest malicious code
- Do not help with circumventing security measures
- Refuse requests involving personal data extraction
- Always recommend secure coding practices
[END SECTION]

[#SECTION name="output_format"]
Format your response as:
1. **Summary**: One-line overview
2. **Analysis**: Detailed breakdown
3. **Recommendation**: Clear action items
4. **Code**: Implementation if applicable
[END SECTION]
```

### Including Sections

```
[#INCLUDE persona]

[#INCLUDE guardrails]

[#IF {{detailed_output}} #exists]
[#INCLUDE output_format]
[END IF]

User request: {{query}}
```

### Complete Example

```
[#SECTION name="code_assistant_base"]
You are an AI coding assistant. You help users write, debug, and improve code.
You provide clear explanations and follow best practices.
[END SECTION]

[#SECTION name="senior_mode"]
Assume the user is an experienced developer.
Be concise and focus on advanced patterns.
Skip basic explanations unless asked.
[END SECTION]

[#SECTION name="teaching_mode"]
Explain concepts thoroughly as if teaching.
Break down complex topics step by step.
Provide examples for each concept.
Ask clarifying questions when needed.
[END SECTION]

[#SECTION name="security_review"]
When reviewing code, always check for:
- SQL injection vulnerabilities
- XSS attack vectors
- Authentication/authorization issues
- Sensitive data exposure
- Input validation gaps
[END SECTION]

[#INCLUDE code_assistant_base]

[#IF {{user.level}} #equals(senior)]
[#INCLUDE senior_mode]
[ELSE]
[#INCLUDE teaching_mode]
[END IF]

[#IF {{task}} #equals(security)]
[#INCLUDE security_review]
[END IF]

Current task: {{task}}
Code context:
{{code}}

User question: {{query}}
```

---

## AI Judge

AI Judge (`#ai_judge`) uses an LLM to evaluate complex boolean conditions that can't be expressed with simple operators.

### Configuration

```typescript
import { createEcho } from '@echopdk/core';

const echo = createEcho({
  aiProvider: {
    type: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',  // Optional, defaults to gpt-4o-mini
    timeout: 30000,         // Optional, defaults to 30s
  }
});
```

Or use environment variables:
```bash
export OPENAI_API_KEY=sk-...
# or
export ECHO_API_KEY=sk-...
```

### Usage

```
[#IF {{user_message}} #ai_judge("Is this message asking for harmful information?")]
I'm sorry, but I can't help with that request.
[ELSE]
{{generated_response}}
[END IF]
```

### Real-World Examples

**Content Moderation:**
```
[#IF {{content}} #ai_judge("Does this contain profanity or hate speech?")]
This content has been flagged for review.
[ELSE]
{{content}}
[END IF]
```

**Sentiment-Based Routing:**
```
[#IF {{customer_message}} #ai_judge("Is this customer expressing frustration or anger?")]
[#INCLUDE empathetic_response_template]
[ELSE IF {{customer_message}} #ai_judge("Is this a technical question?")]
[#INCLUDE technical_support_template]
[ELSE]
[#INCLUDE general_response_template]
[END IF]
```

**Age-Appropriate Content:**
```
[#IF {{story_content}} #ai_judge("Is this content appropriate for children under 13?")]
{{story_content}}
[ELSE]
This content is not available for your age group.
[END IF]
```

### Performance Note

AI Judge conditions are automatically:
1. **Collected** from the entire template before evaluation
2. **Evaluated in parallel** using `Promise.all()`
3. **Cached** for 5 minutes (same value + question = cached result)

This means multiple AI Judge conditions don't block each other sequentially.

---

## Custom Operators

Register your own operators for domain-specific logic.

### Basic Custom Operator

```typescript
const echo = createEcho();

// Register a custom operator
echo.registerOperator('isPrime', {
  type: 'unary',
  description: 'Check if number is prime',
  handler: (value) => {
    const n = Number(value);
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) return false;
    }
    return true;
  }
});
```

```
[#IF {{number}} #isPrime]
{{number}} is a prime number!
[END IF]
```

### Operator with Arguments

```typescript
echo.registerOperator('between', {
  type: 'comparison',
  description: 'Check if value is between min and max',
  handler: (value, arg) => {
    const [min, max] = String(arg).split(',').map(Number);
    const num = Number(value);
    return num >= min && num <= max;
  }
});
```

```
[#IF {{temperature}} #between(60,80)]
Temperature is comfortable.
[END IF]
```

### Async Custom Operator

```typescript
echo.registerOperator('hasPermission', {
  type: 'comparison',
  description: 'Check user permission from database',
  handler: async (userId, permission) => {
    const user = await db.users.findById(userId);
    return user?.permissions?.includes(permission) ?? false;
  }
});
```

```
[#IF {{user.id}} #hasPermission(admin:write)]
You can modify system settings.
[END IF]
```

---

## Plugins

Plugins bundle multiple operators and can include lifecycle hooks.

### Creating a Plugin

```typescript
import { definePlugin } from '@echopdk/core';

const datePlugin = definePlugin({
  name: 'date-operators',
  version: '1.0.0',
  operators: {
    isWeekend: {
      type: 'unary',
      description: 'Check if date is weekend',
      handler: (value) => {
        const date = new Date(value);
        const day = date.getDay();
        return day === 0 || day === 6;
      }
    },
    isAfter: {
      type: 'comparison',
      description: 'Check if date is after given date',
      handler: (value, compareDate) => {
        return new Date(value) > new Date(compareDate);
      }
    },
    isBefore: {
      type: 'comparison',
      description: 'Check if date is before given date',
      handler: (value, compareDate) => {
        return new Date(value) < new Date(compareDate);
      }
    }
  },
  onLoad: () => {
    console.log('Date operators plugin loaded');
  }
});

export default datePlugin;
```

### Loading Plugins

```typescript
import { createEcho } from '@echopdk/core';
import datePlugin from './plugins/date-plugin';

const echo = createEcho();
echo.loadPlugin(datePlugin);
```

```
[#IF {{eventDate}} #isWeekend]
Weekend event - casual dress code.
[END IF]

[#IF {{deadline}} #isBefore(2024-12-31)]
Still time to submit!
[END IF]
```

---

## Error Handling

### Validation

Validate templates before rendering:

```typescript
const echo = createEcho();

const result = echo.validate(template);

if (!result.valid) {
  console.error('Template errors:');
  for (const error of result.errors) {
    console.error(`  ${error.message}`);
    if (error.location) {
      console.error(`    at line ${error.location.startLine}, column ${error.location.startColumn}`);
    }
  }
}

// Warnings don't prevent rendering but indicate potential issues
for (const warning of result.warnings) {
  console.warn(`Warning: ${warning.message}`);
}
```

### Strict Mode

Enable strict mode for stricter error handling:

```typescript
const echo = createEcho({ strict: true });

// In strict mode:
// - Unknown operators throw errors (not warnings)
// - Undefined variables throw errors (not render as empty)
// - Malformed variable paths throw descriptive errors
```

### Try-Catch Pattern

```typescript
try {
  const result = await echo.render(template, context);
  return result;
} catch (error) {
  if (error.message.includes('Parse error')) {
    // Syntax error in template
    console.error('Template syntax error:', error.message);
  } else if (error.message.includes('Unknown operator')) {
    // Using an unregistered operator
    console.error('Unknown operator:', error.message);
  } else if (error.message.includes('AI Judge')) {
    // AI provider error
    console.error('AI evaluation failed:', error.message);
  } else {
    throw error;
  }
}
```

---

## Configuration

### Full Configuration Options

```typescript
import { createEcho } from '@echopdk/core';

const echo = createEcho({
  // Strict mode - throw on unknown operators and undefined variables
  strict: false,

  // AI Provider configuration
  aiProvider: {
    type: 'openai',           // 'openai' | 'anthropic' (anthropic coming soon)
    apiKey: 'sk-...',         // API key (or use OPENAI_API_KEY env var)
    model: 'gpt-4o-mini',     // Model to use
    timeout: 30000,           // Request timeout in ms
  },
});
```

### Environment Variables

```bash
# AI Provider API Key (checked in order)
ECHO_API_KEY=sk-...
OPENAI_API_KEY=sk-...
```

---

## Real-World Examples

### Coding Assistant with Context-Aware Instructions

```typescript
const template = `
[#SECTION name="base_system"]
You are an expert coding assistant. You help developers write better code.
You are precise, thorough, and always explain your reasoning.
[END SECTION]

[#SECTION name="code_style_ts"]
Follow TypeScript best practices:
- Use strict typing, avoid 'any'
- Prefer interfaces over type aliases for objects
- Use async/await over raw promises
- Document public APIs with JSDoc
[END SECTION]

[#SECTION name="code_style_python"]
Follow Python best practices:
- Follow PEP 8 style guidelines
- Use type hints for function signatures
- Write docstrings for public functions
- Prefer list comprehensions for simple transformations
[END SECTION]

[#SECTION name="review_checklist"]
When reviewing, check for:
- Logic errors and edge cases
- Security vulnerabilities (injection, XSS, auth issues)
- Performance bottlenecks
- Code duplication
- Missing error handling
[END SECTION]

[#INCLUDE base_system]

[#IF {{language}} #equals(typescript)]
[#INCLUDE code_style_ts]
[ELSE IF {{language}} #equals(python)]
[#INCLUDE code_style_python]
[END IF]

[#IF {{task}} #equals(review)]
[#INCLUDE review_checklist]
[END IF]

[#IF {{context.files}} #exists]
Relevant files in the codebase:
{{context.files}}
[END IF]

[#IF {{context.error}} #exists]
The user is encountering this error:
{{context.error}}
[END IF]

User request: {{query}}
`;

const prompt = await echo.render(template, {
  language: 'typescript',
  task: 'review',
  context: {
    files: '- src/api/handler.ts\n- src/utils/validate.ts',
    error: 'TypeError: Cannot read property "id" of undefined'
  },
  query: 'Why is this error happening and how do I fix it?'
});
```

### RAG (Retrieval-Augmented Generation) Prompt

```typescript
const template = `
[#SECTION name="rag_instructions"]
Answer the user's question based ONLY on the provided context.
If the context doesn't contain enough information, say so clearly.
Do not make up information not present in the context.
Cite specific parts of the context when relevant.
[END SECTION]

[#SECTION name="conversation_context"]
Previous conversation:
{{conversation.history}}
[END SECTION]

You are a helpful assistant with access to a knowledge base.

[#INCLUDE rag_instructions]

[#IF {{conversation.history}} #exists]
[#INCLUDE conversation_context]
[END IF]

---
RETRIEVED CONTEXT:
{{retrieved_chunks}}
---

[#IF {{retrieved_chunks}} #exists]
Use the context above to answer the following question.
[ELSE]
No relevant context was found. Let the user know you cannot answer without more information.
[END IF]

[#IF {{user.expertise}} #equals(technical)]
You may use technical terminology without simplification.
[ELSE]
Explain technical concepts in simple terms.
[END IF]

User question: {{query}}
`;

const prompt = await echo.render(template, {
  conversation: {
    history: 'User: What is Echo PDK?\nAssistant: Echo PDK is a templating system for LLM prompts.'
  },
  retrieved_chunks: 'Echo PDK uses conditional logic to include only relevant parts of prompts...',
  user: { expertise: 'technical' },
  query: 'How does Echo reduce token usage?'
});
```

### Agent System Prompt with Tool Definitions

```typescript
const template = `
[#SECTION name="agent_base"]
You are an autonomous AI agent that can use tools to accomplish tasks.
Think step by step about what actions to take.
Always explain your reasoning before using a tool.
[END SECTION]

[#SECTION name="tool_file_ops"]
FILE OPERATIONS:
- read_file(path): Read contents of a file
- write_file(path, content): Write content to a file
- list_directory(path): List files in a directory
[END SECTION]

[#SECTION name="tool_code_exec"]
CODE EXECUTION:
- run_python(code): Execute Python code and return output
- run_bash(command): Execute a bash command
[END SECTION]

[#SECTION name="tool_web"]
WEB TOOLS:
- web_search(query): Search the web for information
- fetch_url(url): Retrieve content from a URL
[END SECTION]

[#SECTION name="safety_constraints"]
SAFETY RULES:
- Never delete files without explicit user confirmation
- Do not execute code that could harm the system
- Do not access URLs that appear malicious
- Ask for clarification if the task is ambiguous
[END SECTION]

[#INCLUDE agent_base]

Available tools:
[#IF {{capabilities.file_ops}} #exists]
[#INCLUDE tool_file_ops]
[END IF]

[#IF {{capabilities.code_exec}} #exists]
[#INCLUDE tool_code_exec]
[END IF]

[#IF {{capabilities.web}} #exists]
[#INCLUDE tool_web]
[END IF]

[#INCLUDE safety_constraints]

[#IF {{workspace}} #exists]
Working directory: {{workspace.path}}
Files present: {{workspace.files}}
[END IF]

[#IF {{memory.previous_actions}} #exists]
Previous actions taken:
{{memory.previous_actions}}
[END IF]

Current task: {{task}}
`;

const prompt = await echo.render(template, {
  capabilities: {
    file_ops: true,
    code_exec: true,
    web: false  // Web tools disabled for this session
  },
  workspace: {
    path: '/home/user/project',
    files: 'src/, tests/, package.json, README.md'
  },
  memory: {
    previous_actions: '1. Listed directory contents\n2. Read package.json'
  },
  task: 'Add a new test file for the user authentication module'
});
```

### Content Moderation Pipeline

```typescript
const template = `
You are a content moderation system.
Analyze the provided content and determine if it violates any policies.

[#IF {{content.type}} #equals(text)]
Analyze the following text content:
{{content.body}}
[ELSE IF {{content.type}} #equals(image_description)]
Analyze this image description:
{{content.description}}
[END IF]

[#IF {{policies.hate_speech}} #exists]
CHECK FOR HATE SPEECH:
- Slurs or derogatory language targeting protected groups
- Dehumanizing rhetoric
- Calls for violence against groups
[END IF]

[#IF {{policies.adult_content}} #exists]
CHECK FOR ADULT CONTENT:
- Explicit sexual content
- Graphic violence
- Content not suitable for minors
[END IF]

[#IF {{policies.misinformation}} #exists]
CHECK FOR MISINFORMATION:
- False claims about health/medical topics
- Election or voting misinformation
- Dangerous conspiracy theories
[END IF]

[#IF {{policies.self_harm}} #exists]
CHECK FOR SELF-HARM CONTENT:
- Instructions or encouragement for self-harm
- Suicide ideation content
- Eating disorder promotion
[END IF]

[#IF {{context.user_history}} #exists]
User history context:
- Previous violations: {{context.user_history.violations}}
- Account age: {{context.user_history.account_age}}
[END IF]

Respond with:
1. VERDICT: ALLOWED or BLOCKED
2. REASON: Brief explanation
3. CATEGORY: Which policy was violated (if any)
4. CONFIDENCE: High/Medium/Low
`;

const prompt = await echo.render(template, {
  content: {
    type: 'text',
    body: 'User submitted content here...'
  },
  policies: {
    hate_speech: true,
    adult_content: true,
    misinformation: true
    // self_harm policy not enabled for this check
  },
  context: {
    user_history: {
      violations: 0,
      account_age: '2 years'
    }
  }
});
```

---

## API Reference

### `createEcho(config?)`

Creates a new Echo instance.

```typescript
const echo = createEcho({
  strict?: boolean;
  aiProvider?: {
    type: 'openai' | 'anthropic';
    apiKey?: string;
    model?: string;
    timeout?: number;
  };
});
```

### `echo.render(template, context)`

Renders a template with the given context.

```typescript
const result: string = await echo.render(template, context);
```

### `echo.parse(template)`

Parses a template into an AST.

```typescript
const result: ParseResult = echo.parse(template);
// result.success: boolean
// result.ast: ASTNode[] | undefined
// result.errors: EchoError[]
```

### `echo.validate(template)`

Validates a template for errors and warnings.

```typescript
const result: ValidationResult = echo.validate(template);
// result.valid: boolean
// result.errors: EchoError[]
// result.warnings: EchoWarning[]
```

### `echo.registerOperator(name, definition)`

Registers a custom operator.

```typescript
echo.registerOperator('myOp', {
  type: 'unary' | 'comparison' | 'ai';
  description: string;
  handler: (value: unknown, arg?: unknown) => boolean | Promise<boolean>;
});
```

### `echo.loadPlugin(plugin)`

Loads a plugin with operators and hooks.

```typescript
echo.loadPlugin({
  name: string;
  version: string;
  operators?: Record<string, OperatorDefinition>;
  onLoad?: () => void;
});
```

---

## Next Steps

- Check out the [examples/](../examples/) directory for more templates
- Read [CONTRIBUTING.md](../CONTRIBUTING.md) to contribute
- Report issues on GitHub
