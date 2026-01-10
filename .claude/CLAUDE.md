# Echo PDK - Claude Code Instructions

## Project Overview

Echo PDK (Prompt Development Kit) is a Domain Specific Language for dynamic prompt templating. It enables developers and low-coders to write logic directly in prompt templates, rendering only relevant context at runtime.

**Key Value Propositions:**
- Massive token reduction (up to 75% cost savings)
- Reduced LLM cognitive load = higher accuracy
- Maintainable, modular prompts
- Deterministic logic in code, not AI interpretation

## Architecture

This is a **pnpm monorepo** using **Turborepo** for build orchestration.

### Packages

| Package | Path | Description |
|---------|------|-------------|
| `@echo-pdk/core` | `packages/core` | Parser, evaluator, renderer engine |
| `@echo-pdk/cli` | `packages/cli` | Command-line interface |
| `@echo-pdk/language` | `packages/language` | Language definition (YAML) and schema |

### Core Architecture

```
Template (.echo) → Lexer → Parser → AST → Evaluator → Renderer → Output (string)
                                         ↑
                                   AI Judge (parallel)
```

**Key Innovation:** AI Judge conditions (`#ai_judge`) are collected and evaluated in parallel before AST evaluation, preventing sequential blocking.

## Development Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm dev              # Development mode with watch
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix auto-fixable lint issues
pnpm typecheck        # Run TypeScript type checking
pnpm clean            # Clean build artifacts
```

## Code Conventions

### TypeScript
- **Strict mode** required - all code must pass strict type checking
- **ESM only** - use `.js` extensions in imports
- **Functional patterns** preferred - avoid classes where possible
- **Explicit return types** for all public functions

### File Organization
- **Co-located tests**: `foo.ts` → `foo.test.ts`
- **Index files**: Each module folder has `index.ts` for exports
- **Barrel exports**: Re-export from package root `index.ts`

### Naming Conventions
- **Files**: `kebab-case.ts`
- **Functions**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`

### Documentation
- **JSDoc** required for all public APIs
- **Implementation notes** in source files guide future work
- **Examples** in JSDoc for complex functions

## Key Files

### Core Package
| File | Purpose |
|------|---------|
| `packages/core/src/index.ts` | Main entry, `createEcho()` |
| `packages/core/src/types.ts` | All TypeScript type definitions |
| `packages/core/src/parser/lexer.ts` | Chevrotain lexer (tokenization) |
| `packages/core/src/parser/parser.ts` | Chevrotain parser (AST generation) |
| `packages/core/src/parser/ast.ts` | AST utilities and visitor pattern |
| `packages/core/src/evaluator/operators.ts` | Built-in operators (#equals, etc.) |
| `packages/core/src/evaluator/evaluator.ts` | Condition evaluation engine |
| `packages/core/src/renderer/renderer.ts` | AST to text output |
| `packages/core/src/ai-judge/index.ts` | AI-based condition evaluation |
| `packages/core/src/plugins/index.ts` | Plugin system |

### Language Package
| File | Purpose |
|------|---------|
| `packages/language/echo.lang.yaml` | Language definition (IDE consumes this) |
| `packages/language/echo.config.schema.json` | JSON Schema for config validation |

## Echo DSL Syntax Reference

### Variables
```
{{variable}}              # Basic
{{user.name}}            # Nested
{{items[0]}}             # Array access
{{value ?? "default"}}   # Default value
```

### Conditionals
```
[#IF {{var}} #operator(arg)]
  content
[ELSE IF {{other}} #exists]
  alternative
[ELSE]
  fallback
[END IF]
```

### Built-in Operators

Operators have readable names for low-coders and short aliases for developers.

| Operator | Alias | Type | Description |
|----------|-------|------|-------------|
| `#equals(v)` | - | comparison | Exact match (case-insensitive) |
| `#contains(v)` | - | comparison | String/array contains |
| `#exists` | - | unary | Is defined and not empty |
| `#matches(regex)` | - | comparison | Regex pattern match |
| `#greater_than(n)` | `#gt` | comparison | Greater than |
| `#greater_than_or_equal(n)` | `#gte` | comparison | Greater than or equal |
| `#less_than(n)` | `#lt` | comparison | Less than |
| `#less_than_or_equal(n)` | `#lte` | comparison | Less than or equal |
| `#one_of(a,b,c)` | `#in` | comparison | Value in list |
| `#ai_judge(q)` | - | ai | LLM-evaluated boolean |

### Composition
```
[#IMPORT ./sections/header.echo]
[#INCLUDE section_name]
[#SECTION name="rules"]...[END SECTION]
```

## Design Patterns

### Visitor Pattern (AST Traversal)
Used for walking the AST. See `packages/core/src/parser/ast.ts`:
```typescript
const visitor: ASTVisitor = {
  visitConditional(node) { /* ... */ },
  visitVariable(node) { /* ... */ },
};
visitNodes(ast, visitor);
```

### Strategy Pattern (Operators)
Operators are pluggable functions. See `packages/core/src/evaluator/operators.ts`:
```typescript
const operator: OperatorDefinition = {
  type: 'comparison',
  handler: (value, arg) => /* ... */,
  description: '...',
};
```

### Factory Pattern (Node Creation)
Use factory functions for AST nodes. See `packages/core/src/parser/ast.ts`:
```typescript
const node = createConditionalNode(condition, consequent, location);
```

## Testing Requirements

- **Unit tests** for all operators
- **Integration tests** for full render pipeline
- **Snapshot tests** for AST output
- **Error case coverage** required

Test file naming: `*.test.ts` co-located with source.

## Error Handling

### Error Messages Must Be:
1. **Actionable** - Tell the user what to do
2. **Located** - Include line/column numbers
3. **Contextual** - Show the relevant source code

Example:
```
Error at line 5, column 10: Unknown operator #foo
  5 | [#IF {{x}} #foo(y)]
             ^^^^^
Did you mean: #equals, #contains, #exists?
```

## Implementation Status

### MVP (Phase 1) - In Progress
- [ ] Lexer implementation
- [ ] Parser implementation
- [ ] Basic evaluator (#equals, #contains, #exists)
- [ ] Simple renderer
- [ ] Basic CLI (render, validate)

### Phase 2 - Planned
- [ ] AI Judge with parallel optimization
- [ ] Import/Include support
- [ ] Section definitions
- [ ] Caching layer

### Phase 3 - Future
- [ ] Full plugin system
- [ ] IDE extension
- [ ] Performance benchmarks

## Common Tasks

### Adding a New Operator
1. Add definition in `packages/core/src/evaluator/operators.ts`
2. Register in `builtinOperators` object
3. Add to `packages/language/echo.lang.yaml`
4. Write tests in `operators.test.ts`

### Adding a New AST Node Type
1. Define type in `packages/core/src/types.ts`
2. Add factory function in `packages/core/src/parser/ast.ts`
3. Add visitor method in `ASTVisitor` interface
4. Handle in parser and evaluator

### Running the Example
```bash
cd examples
pnpm build
echopdk render movie-recommender.echo --context '{"companions":"Shimon","genre":"SciFi"}'
```

## Git Workflow

- **Branch naming**: `feat/description`, `fix/description`, `docs/description`
- **Commit format**: `type(scope): message`
- **PR required** for all changes to main

## Need Help?

- Check `CONTRIBUTING.md` for contribution guidelines
- Look for `TODO:` and `IMPLEMENTATION NOTES:` comments in source files
- Each source file has detailed implementation guides at the bottom
