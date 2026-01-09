# /lint - Lint and Type Check

Run linting and type checking for Echo PDK.

## Usage

```
/lint              # Run ESLint and type check
/lint --fix        # Auto-fix ESLint issues
/lint core         # Lint specific package
```

## Implementation

1. **Run ESLint**:
   ```bash
   pnpm lint
   ```

2. **Run type checking**:
   ```bash
   pnpm typecheck
   ```

3. **Auto-fix**:
   ```bash
   pnpm lint:fix
   ```

4. **For specific package**:
   ```bash
   pnpm --filter @echo-pdk/core lint
   pnpm --filter @echo-pdk/core typecheck
   ```

## Checks Performed

### ESLint Rules
- TypeScript strict mode compliance
- No unused variables
- Consistent type imports
- Explicit return types on public APIs
- No `any` types

### Type Checking
- Full TypeScript strict mode
- Cross-package type compatibility
- Declaration file generation

## Reporting

- Report total errors and warnings
- Group by file
- For each issue, show:
  - Rule name
  - Message
  - Line number
  - Fix suggestion if available

## Auto-Fixable Issues

These issues will be automatically fixed with `--fix`:
- Import ordering
- Trailing commas
- Semicolons
- Quote style
- Some type import conversions

## Common Issues

### Unused Variables
If a parameter is intentionally unused, prefix with underscore:
```typescript
function handler(_unused: string, used: string) {}
```

### Any Types
Replace `any` with proper types or use `unknown`:
```typescript
// Bad
const data: any = getData();

// Good
const data: unknown = getData();
```

### Missing Return Types
Add explicit return types to public functions:
```typescript
// Bad
export function foo() { return 'bar'; }

// Good
export function foo(): string { return 'bar'; }
```
