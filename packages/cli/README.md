# @goreal-ai/echo-pdk-cli

**Echo PDK CLI** - Command-line interface for Echo, a Domain Specific Language for dynamic prompt templating.

## Installation

```bash
npm install -g @goreal-ai/echo-pdk-cli
# or
npx @goreal-ai/echo-pdk-cli <command>
```

## Commands

### Render a Template

```bash
echopdk render template.echo --context context.json
```

Renders an Echo template with the provided context and outputs the result.

**Options:**
- `--context, -c` - Path to JSON file with context variables
- `--output, -o` - Output file (defaults to stdout)

### Validate Syntax

```bash
echopdk validate template.echo
```

Validates the syntax of an Echo template without rendering it.

## Example

**template.echo:**
```
Hello {{name}}!

[#IF {{role}} #equals(admin)]
You have full access.
[ELSE]
Welcome to our platform.
[END IF]
```

**context.json:**
```json
{
  "name": "Alice",
  "role": "admin"
}
```

**Run:**
```bash
echopdk render template.echo -c context.json
```

**Output:**
```
Hello Alice!

You have full access.
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@goreal-ai/echo-pdk](https://www.npmjs.com/package/@goreal-ai/echo-pdk) | Core rendering engine |
| [@goreal-ai/echo-pdk-language](https://www.npmjs.com/package/@goreal-ai/echo-pdk-language) | Language definition and schema |

## Documentation

Full documentation available at [GitHub](https://github.com/GoReal-AI/echo-pdk)

## License

MIT
