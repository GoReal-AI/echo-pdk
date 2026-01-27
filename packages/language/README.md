# @goreal-ai/echo-pdk-language

**Echo PDK Language** - Language definition and schema for Echo, a Domain Specific Language for dynamic prompt templating.

This package provides:
- Language definition (YAML) for IDE integration
- JSON Schema for configuration validation
- TypeScript types for language constructs

## Installation

```bash
npm install @goreal-ai/echo-pdk-language
# or
pnpm add @goreal-ai/echo-pdk-language
```

## Usage

### Language Definition

The language definition file can be used for syntax highlighting and IDE support:

```typescript
import langDefinition from '@goreal-ai/echo-pdk-language/echo.lang.yaml';
```

### Configuration Schema

Validate Echo configuration files using the JSON Schema:

```typescript
import configSchema from '@goreal-ai/echo-pdk-language/echo.config.schema.json';
```

### TypeScript Types

```typescript
import {
  EchoLanguageDefinition,
  EchoConfigSchema
} from '@goreal-ai/echo-pdk-language';
```

## Files Included

| File | Description |
|------|-------------|
| `echo.lang.yaml` | Language definition for IDE integration |
| `echo.config.schema.json` | JSON Schema for config validation |

## Related Packages

| Package | Description |
|---------|-------------|
| [@goreal-ai/echo-pdk](https://www.npmjs.com/package/@goreal-ai/echo-pdk) | Core rendering engine |
| [@goreal-ai/echo-pdk-cli](https://www.npmjs.com/package/@goreal-ai/echo-pdk-cli) | Command-line interface |

## Documentation

Full documentation available at [GitHub](https://github.com/GoReal-AI/echo-pdk)

## License

MIT
