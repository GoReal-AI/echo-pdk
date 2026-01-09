# /docs - Documentation Generator

Generate and update documentation for Echo PDK.

## Usage

```
/docs              # Generate all documentation
/docs api          # Generate API docs only
/docs readme       # Update README examples
/docs lang         # Generate language reference from YAML
```

## Implementation

### API Documentation

1. **Generate TypeDoc output**:
   ```bash
   npx typedoc --out docs/api packages/core/src/index.ts
   ```

2. **Key sections to document**:
   - `createEcho()` function
   - `Echo` interface methods
   - Type definitions
   - Operator definitions

### README Updates

1. **Read current README.md**
2. **Extract code examples** from test files
3. **Update example sections** with working code
4. **Verify examples compile**

### Language Reference

1. **Read `packages/language/echo.lang.yaml`**
2. **Generate markdown documentation**:
   - Syntax patterns
   - All operators with examples
   - Validation rules
3. **Output to `docs/language-reference.md`**

## Documentation Standards

### Code Examples
- All examples must be valid Echo syntax
- Include both template and context
- Show expected output

### API Documentation
- Every public function has JSDoc
- Include `@param`, `@returns`, `@example`
- Link related functions

### Formatting
- Use GitHub-flavored markdown
- Include table of contents for long docs
- Use syntax highlighting in code blocks

## Files to Update

| File | Content |
|------|---------|
| `README.md` | Quick start, installation, basic usage |
| `docs/api/` | Generated TypeDoc output |
| `docs/language-reference.md` | Full syntax reference |
| `docs/operators.md` | Detailed operator documentation |
| `docs/plugins.md` | Plugin development guide |

## Verification

After generation:
1. Verify all links work
2. Verify code examples are valid
3. Check for outdated information
4. Run spell check
