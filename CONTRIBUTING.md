# Contributing to Echo PDK

Thank you for your interest in contributing to Echo PDK! This document outlines how you can participate in the project.

## Ways to Contribute

### 1. Create a Plugin/Extension

The easiest way to extend Echo is by creating a plugin:

```typescript
// my-plugin/index.ts
import { definePlugin } from '@echo-pdk/core';

export default definePlugin({
  name: 'my-custom-operators',
  version: '1.0.0',

  operators: {
    // Add a custom #isEmpty operator
    isEmpty: {
      type: 'unary',
      handler: (value) => value === '' || value === null || value === undefined,
      description: 'Check if value is empty',
      example: '{{field}} #isEmpty'
    },

    // Add a custom #startsWith operator
    startsWith: {
      type: 'comparison',
      handler: (value, prefix) => String(value).startsWith(prefix),
      description: 'Check if string starts with prefix',
      example: '{{name}} #startsWith(Dr.)'
    }
  }
});
```

### 2. Publish Your Plugin

```bash
# Create your plugin package
mkdir my-echo-plugin && cd my-echo-plugin
npm init

# Install Echo as peer dependency
npm install @echo-pdk/core --save-peer

# Develop and test
npm test

# Publish to npm
npm publish --access public
```

### 3. Plugin Types

| Type | Description | Example |
|------|-------------|---------|
| **Operator Plugin** | Add new `#operator` conditions | `#isEmpty`, `#isValidEmail` |
| **Validator Plugin** | Custom validation rules | Domain-specific validators |
| **Transform Plugin** | Post-render transformations | Minification, formatting |
| **Provider Plugin** | AI provider adapters | Custom LLM integration |

## Core Development

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Setting Up

```bash
# Clone the repository
git clone https://github.com/echo-pdk/echo-pdk
cd echo-pdk

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Project Structure

```
echo-pdk/
├── packages/
│   ├── core/           # Main rendering engine
│   │   ├── src/
│   │   │   ├── parser/     # Lexer and parser (Chevrotain)
│   │   │   ├── evaluator/  # Condition evaluation
│   │   │   ├── renderer/   # Output generation
│   │   │   ├── ai-judge/   # AI-based conditions
│   │   │   └── plugins/    # Plugin system
│   │   └── tests/
│   │
│   ├── cli/            # Command-line interface
│   │   └── src/
│   │       └── commands/   # CLI commands
│   │
│   └── language/       # Language definition
│       ├── echo.lang.yaml  # Core language spec
│       └── src/
│           └── schema/     # JSON Schema
│
├── docs/               # Documentation
└── examples/           # Example templates
```

### Development Commands

```bash
pnpm build        # Build all packages
pnpm dev          # Development mode with watch
pnpm test         # Run all tests
pnpm test:watch   # Run tests in watch mode
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix auto-fixable lint issues
pnpm typecheck    # Run TypeScript type checking
pnpm clean        # Clean build artifacts
```

### Code Conventions

1. **TypeScript Strict Mode**: All code must pass strict type checking
2. **Functional Patterns**: Prefer functions over classes where appropriate
3. **JSDoc Comments**: All public APIs must have JSDoc documentation
4. **Error Messages**: Must be actionable and include source locations
5. **Testing**: Co-locate tests with source files (`foo.ts` → `foo.test.ts`)

### Design Patterns Used

- **Visitor Pattern**: For AST traversal
- **Strategy Pattern**: For operators (pluggable condition handlers)
- **Factory Pattern**: For AST node creation

### Submitting Changes

1. **Fork** the repository
2. **Create a branch** for your feature (`git checkout -b feature/my-feature`)
3. **Write tests** for your changes
4. **Ensure all tests pass** (`pnpm test`)
5. **Ensure code passes lint** (`pnpm lint`)
6. **Commit** with a clear message
7. **Submit a PR** with a description of your changes

### Commit Message Format

```
type(scope): description

[optional body]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(parser): add support for nested variable access`
- `fix(evaluator): handle undefined variables in strict mode`
- `docs(readme): add CLI usage examples`

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include reproduction steps for bugs
- Provide context about your use case for features

## Questions?

- Open a GitHub Discussion for questions
- Tag maintainers for blocking issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
