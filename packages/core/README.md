# @goreal-ai/echo-pdk

**Echo PDK Core** - A Domain Specific Language for dynamic prompt templating.

Echo enables developers to write logic directly in prompt templates, rendering only relevant context at runtime. This reduces tokens, cost, and LLM cognitive load.

## Why Echo?

Traditional LLM development sends "monolithic prompts" containing every possible rule and edge case. Echo solves this by:

- **Massive Token Reduction**: Only send relevant context (up to 75% cost savings)
- **Reduced Cognitive Load**: Sharper LLM focus = higher accuracy
- **Maintainable Code**: Modular, readable prompts instead of "spaghetti prompts"
- **Deterministic Control**: Logic lives in code, not AI interpretation

## Installation

```bash
npm install @goreal-ai/echo-pdk
# or
pnpm add @goreal-ai/echo-pdk
```

## Quick Start

```typescript
import { createEcho } from '@goreal-ai/echo-pdk';

const echo = createEcho();

const template = `
Hello {{name}}!

[#IF {{role}} #equals(admin)]
You have full access to all features.
[ELSE]
Welcome to our platform.
[END IF]
`;

const result = await echo.render(template, {
  name: 'Alice',
  role: 'admin'
});

console.log(result);
// Hello Alice!
// You have full access to all features.
```

## Syntax Reference

### Variables
```
{{variable}}              # Basic variable
{{user.name}}            # Nested access
{{value ?? "default"}}   # Default value
```

### Conditionals
```
[#IF {{var}} #operator(value)]
  content
[ELSE IF {{other}} #exists]
  alternative
[ELSE]
  fallback
[END IF]
```

### Built-in Operators

| Operator | Alias | Description |
|----------|-------|-------------|
| `#equals(value)` | - | Exact match |
| `#contains(value)` | - | String/array contains |
| `#exists` | - | Variable is defined |
| `#matches(regex)` | - | Regex pattern match |
| `#greater_than(n)` | `#gt` | Greater than |
| `#less_than(n)` | `#lt` | Less than |
| `#one_of(a,b,c)` | `#in` | Value in list |
| `#ai_judge(question)` | - | LLM-evaluated condition |

### Composition
```
[#IMPORT ./sections/header.echo]
[#INCLUDE system_prompt]
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@goreal-ai/echo-pdk-cli](https://www.npmjs.com/package/@goreal-ai/echo-pdk-cli) | Command-line interface |
| [@goreal-ai/echo-pdk-language](https://www.npmjs.com/package/@goreal-ai/echo-pdk-language) | Language definition and schema |

## Documentation

Full documentation available at [GitHub](https://github.com/GoReal-AI/echo-pdk)

## License

MIT
