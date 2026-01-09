# /validate - Template Validator

Validate Echo templates for syntax and semantic errors.

## Usage

```
/validate template.echo           # Validate a template
/validate examples/*.echo         # Validate multiple templates
/validate --strict template.echo  # Treat warnings as errors
```

## Implementation

1. **Build the CLI** (if not already built):
   ```bash
   pnpm build
   ```

2. **Run validation**:
   ```bash
   npx echo-pdk validate {template}
   ```

3. **For multiple files**, iterate through glob matches.

## Checks Performed

### Syntax Errors
- Unclosed `[#IF]` blocks
- Unclosed `{{` variables
- Invalid operator syntax
- Malformed section definitions

### Semantic Errors
- Unknown operators
- Invalid operator arguments
- Circular imports
- Duplicate section names

### Warnings
- Unused sections
- Empty conditionals
- Potentially problematic patterns

## Output Format

```
Validating: template.echo

✗ [E001] Unclosed conditional block
  Line 5: [#IF {{x}} #equals(y)]
          ^
  Missing: [END IF]

⚠ [W001] Section 'header' is defined but never included
  Line 12: [#SECTION name="header"]

Result: 1 error, 1 warning
```

## Error Codes

| Code | Type | Description |
|------|------|-------------|
| E001 | Error | Unclosed block |
| E002 | Error | Unknown operator |
| E003 | Error | Invalid syntax |
| E004 | Error | Circular import |
| W001 | Warning | Unused section |
| W002 | Warning | Empty conditional |

## Fixing Common Errors

### E001: Unclosed Block
Add the matching closing tag:
```
[#IF {{x}}]...
[END IF]      <- Add this
```

### E002: Unknown Operator
Check for typos or use a valid operator:
```
#equalls  <- Typo
#equals   <- Correct
```

### E004: Circular Import
Review import chain and break the cycle:
```
a.echo imports b.echo
b.echo imports a.echo  <- Remove one
```
