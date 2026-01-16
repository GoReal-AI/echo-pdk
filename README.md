# Echo PDK

**Echo Prompt Development Kit** - A Domain Specific Language for dynamic prompt templating.

Echo enables developers and low-coders to write logic directly in prompt templates, rendering only relevant context at runtime. This reduces tokens, cost, and LLM cognitive load.

## Why Echo?

Traditional LLM development sends "monolithic prompts" containing every possible rule and edge case. Echo solves this by:

- **Massive Token Reduction**: Only send relevant context (up to 75% cost savings)
- **Reduced Cognitive Load**: Sharper LLM focus = higher accuracy
- **Maintainable Code**: Modular, readable prompts instead of "spaghetti prompts"
- **Deterministic Control**: Logic lives in code, not AI interpretation

## Quick Example

**Before (Static Prompt):**
```
You are a Movie Curator.

### RULES:
1. IF watching with "Girlfriend":
   - Avoid Adam Sandler and Tom Cruise
   - Prefer psychological thrillers
2. IF watching with "Family":
   - Must be G or PG rated
   - No violence or swearing
3. IF watching with "Shimon":
   - We love 80s/90s classics
   - Nothing after 2015 unless IMDB > 8.5
...all rules sent every time...
```

**After (Echo Template):**
```
You are a Movie Curator.

[#IF {{companions}} #contains(Girlfriend)]
  * Avoid Adam Sandler and Tom Cruise
  * Prefer psychological thrillers
[END IF]
[#IF {{companions}} #contains(Shimon)]
  * We love 80s/90s classics
  * Nothing after 2015 unless IMDB > 8.5
[END IF]

Recommend one movie based on these preferences.
```

**Rendered Output** (when companions = "Shimon"):
```
You are a Movie Curator.

* We love 80s/90s classics
* Nothing after 2015 unless IMDB > 8.5

Recommend one movie based on these preferences.
```

## Installation

```bash
npm install @goreal-ai/echo-pdk
# or
pnpm add @goreal-ai/echo-pdk
```

## Usage

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

Echo provides readable names for low-coders and short aliases for developers.

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

## CLI

```bash
# Install CLI
npm install -g @goreal-ai/echo-pdk-cli

# Render a template
echopdk render template.echo --context context.json

# Validate syntax
echopdk validate template.echo
```

## Packages

| Package | Description |
|---------|-------------|
| `@goreal-ai/echo-pdk` | Main rendering engine, parser, evaluator |
| `@goreal-ai/echo-pdk-cli` | Command-line interface |
| `@goreal-ai/echo-pdk-language` | Language definition and schema |

## Documentation

- **[Complete Usage Guide](./docs/USAGE.md)** - Full tutorial with examples
- **[Examples](./examples/)** - Ready-to-use template examples
- **[Contributing](./CONTRIBUTING.md)** - Development guidelines

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on:
- Creating plugins and extensions
- Contributing to core
- Setting up the development environment

## License

MIT
