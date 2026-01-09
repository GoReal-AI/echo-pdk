# /test - Run Tests

Run the test suite for Echo PDK packages.

## Usage

```
/test              # Run all tests
/test core         # Run tests for @echo-pdk/core only
/test --watch      # Run tests in watch mode
/test --coverage   # Run tests with coverage report
```

## Implementation

1. **Run tests** using pnpm and vitest:
   ```bash
   pnpm test
   ```

2. **For specific package**:
   ```bash
   pnpm --filter @echo-pdk/core test
   ```

3. **Watch mode**:
   ```bash
   pnpm test:watch
   ```

4. **With coverage**:
   ```bash
   pnpm test -- --coverage
   ```

## Reporting

- Report the number of tests passed/failed
- For failures, show:
  - Test name
  - Expected vs actual
  - File and line number
- Suggest fixes for common failures

## Common Issues

### Type Errors in Tests
If tests fail with type errors, run `pnpm typecheck` first to identify the issue.

### Missing Dependencies
If imports fail, run `pnpm install` and `pnpm build` first.

### Snapshot Mismatches
For snapshot failures, review the diff and update if the change is intentional:
```bash
pnpm test -- -u
```
