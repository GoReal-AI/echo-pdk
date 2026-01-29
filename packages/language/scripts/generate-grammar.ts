#!/usr/bin/env npx ts-node
/**
 * Generate TextMate Grammar from echo.lang.yaml
 *
 * This script reads the Echo language definition and generates:
 * - echo.tmLanguage.json (TextMate grammar for Monaco, VSCode, Zed)
 * - src/generated/grammar-data.ts (TypeScript exports for autocomplete)
 *
 * Run with: npx ts-node scripts/generate-grammar.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = join(__dirname, '..');

// =============================================================================
// TYPES
// =============================================================================

interface LangDefinition {
  name: string;
  version: string;
  description: string;
  fileExtensions: string[];
  syntax: Record<string, SyntaxDef>;
  operators: Record<string, OperatorDef>;
  validation: Record<string, ValidationDef>;
}

interface SyntaxDef {
  pattern?: string;
  open?: string;
  close?: string;
  elseIf?: string;
  else?: string;
  captures?: Record<number, string>;
  description: string;
  examples?: string[];
  autocomplete?: {
    trigger: string;
    snippet: string;
  };
  notes?: string;
}

interface OperatorDef {
  type: 'comparison' | 'unary' | 'ai';
  signature: string;
  description: string;
  example: string;
  autocomplete?: {
    trigger: string;
    snippet: string;
  };
}

interface ValidationDef {
  level: 'error' | 'warning';
  description: string;
  message: string;
}

// =============================================================================
// TEXTMATE GRAMMAR GENERATOR
// =============================================================================

interface TMGrammar {
  $schema: string;
  name: string;
  scopeName: string;
  fileTypes: string[];
  patterns: TMPattern[];
  repository: Record<string, { patterns: TMPattern[] }>;
}

interface TMPattern {
  name?: string;
  match?: string;
  begin?: string;
  end?: string;
  captures?: Record<string, { name: string }>;
  beginCaptures?: Record<string, { name: string }>;
  endCaptures?: Record<string, { name: string }>;
  patterns?: TMPattern[];
  include?: string;
}

function generateTextMateGrammar(lang: LangDefinition): TMGrammar {
  // Build operator names for regex
  const operatorNames = Object.keys(lang.operators);
  const operatorPattern = operatorNames.join('|');

  // Build directive names (syntax items with standalone patterns like #context)
  const directiveNames: string[] = [];
  for (const [name, def] of Object.entries(lang.syntax)) {
    if (def.pattern && def.pattern.startsWith('#')) {
      directiveNames.push(name);
    }
  }

  const grammar: TMGrammar = {
    $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
    name: 'Echo',
    scopeName: 'source.echo',
    fileTypes: lang.fileExtensions.map(ext => ext.replace(/^\./, '')),
    patterns: [
      { include: '#comments' },
      { include: '#directives' },
      { include: '#control-blocks' },
      { include: '#variables' },
    ],
    repository: {
      // Comments: [#-- comment --]
      comments: {
        patterns: [
          {
            name: 'comment.block.echo',
            begin: '\\[#--',
            end: '--\\]',
          },
        ],
      },

      // Standalone directives like #context(...)
      directives: {
        patterns: [
          // #context(path)
          {
            name: 'meta.directive.context.echo',
            match: '(#context)(\\()([^)]*)(\\))',
            captures: {
              '1': { name: 'keyword.directive.context.echo' },
              '2': { name: 'punctuation.paren.open.echo' },
              '3': { name: 'string.unquoted.path.echo' },
              '4': { name: 'punctuation.paren.close.echo' },
            },
          },
        ],
      },

      // Control blocks: [#IF ...], [END IF], etc.
      'control-blocks': {
        patterns: [
          // [#IF condition]
          {
            name: 'meta.control.if.echo',
            begin: '(\\[)(#IF|#ELSE IF|ELSE IF)\\b',
            end: '(\\])',
            beginCaptures: {
              '1': { name: 'punctuation.bracket.open.echo' },
              '2': { name: 'keyword.control.conditional.echo' },
            },
            endCaptures: {
              '1': { name: 'punctuation.bracket.close.echo' },
            },
            patterns: [
              { include: '#variables' },
              { include: '#operators' },
              { include: '#strings' },
              { include: '#numbers' },
            ],
          },
          // [ELSE]
          {
            name: 'keyword.control.else.echo',
            match: '\\[ELSE\\]',
          },
          // [END IF]
          {
            name: 'keyword.control.end.echo',
            match: '\\[END\\s+(IF|FOR|SECTION)\\]',
          },
          // [#FOR item IN collection]
          {
            name: 'meta.control.for.echo',
            begin: '(\\[)(#FOR)\\b',
            end: '(\\])',
            beginCaptures: {
              '1': { name: 'punctuation.bracket.open.echo' },
              '2': { name: 'keyword.control.loop.echo' },
            },
            endCaptures: {
              '1': { name: 'punctuation.bracket.close.echo' },
            },
            patterns: [
              {
                name: 'keyword.control.in.echo',
                match: '\\bIN\\b',
              },
              { include: '#variables' },
            ],
          },
          // [#SECTION name="..."]
          {
            name: 'meta.control.section.echo',
            begin: '(\\[)(#SECTION)\\b',
            end: '(\\])',
            beginCaptures: {
              '1': { name: 'punctuation.bracket.open.echo' },
              '2': { name: 'keyword.control.section.echo' },
            },
            endCaptures: {
              '1': { name: 'punctuation.bracket.close.echo' },
            },
            patterns: [
              { include: '#strings' },
              {
                name: 'variable.parameter.echo',
                match: '\\b(name)\\b',
              },
            ],
          },
          // [#IMPORT path]
          {
            name: 'meta.control.import.echo',
            match: '(\\[)(#IMPORT)\\s+([^\\]]+)(\\])',
            captures: {
              '1': { name: 'punctuation.bracket.open.echo' },
              '2': { name: 'keyword.control.import.echo' },
              '3': { name: 'string.unquoted.path.echo' },
              '4': { name: 'punctuation.bracket.close.echo' },
            },
          },
          // [#INCLUDE name]
          {
            name: 'meta.control.include.echo',
            match: '(\\[)(#INCLUDE)\\s+([a-zA-Z_][a-zA-Z0-9_]*)(\\])',
            captures: {
              '1': { name: 'punctuation.bracket.open.echo' },
              '2': { name: 'keyword.control.include.echo' },
              '3': { name: 'entity.name.section.echo' },
              '4': { name: 'punctuation.bracket.close.echo' },
            },
          },
        ],
      },

      // Variables: {{name}} or {{name ?? "default"}}
      variables: {
        patterns: [
          {
            name: 'meta.variable.echo',
            begin: '(\\{\\{)',
            end: '(\\}\\})',
            beginCaptures: {
              '1': { name: 'punctuation.definition.variable.begin.echo' },
            },
            endCaptures: {
              '1': { name: 'punctuation.definition.variable.end.echo' },
            },
            patterns: [
              {
                name: 'keyword.operator.default.echo',
                match: '\\?\\?',
              },
              { include: '#strings' },
              {
                name: 'variable.other.echo',
                match: '[a-zA-Z_][a-zA-Z0-9_.\\[\\]]*',
              },
            ],
          },
        ],
      },

      // Operators: #equals, #contains, etc.
      operators: {
        patterns: [
          {
            name: 'keyword.operator.echo',
            match: `#(${operatorPattern})\\b`,
          },
          {
            name: 'punctuation.paren.open.echo',
            match: '\\(',
          },
          {
            name: 'punctuation.paren.close.echo',
            match: '\\)',
          },
        ],
      },

      // String literals
      strings: {
        patterns: [
          {
            name: 'string.quoted.double.echo',
            begin: '"',
            end: '"',
            patterns: [
              {
                name: 'constant.character.escape.echo',
                match: '\\\\.',
              },
            ],
          },
          {
            name: 'string.quoted.single.echo',
            begin: "'",
            end: "'",
            patterns: [
              {
                name: 'constant.character.escape.echo',
                match: '\\\\.',
              },
            ],
          },
        ],
      },

      // Numbers
      numbers: {
        patterns: [
          {
            name: 'constant.numeric.echo',
            match: '\\b\\d+(\\.\\d+)?\\b',
          },
        ],
      },
    },
  };

  return grammar;
}

// =============================================================================
// TYPESCRIPT DATA GENERATOR
// =============================================================================

function generateTypeScriptData(lang: LangDefinition): string {
  const keywords = ['IF', 'ELSE', 'ELSE IF', 'END IF', 'FOR', 'END FOR', 'IN', 'SECTION', 'END SECTION', 'IMPORT', 'INCLUDE'];

  const directives: Array<{
    name: string;
    pattern: string;
    description: string;
    autocomplete?: { trigger: string; snippet: string };
  }> = [];

  for (const [name, def] of Object.entries(lang.syntax)) {
    if (def.pattern) {
      directives.push({
        name,
        pattern: def.pattern,
        description: def.description,
        autocomplete: def.autocomplete,
      });
    }
  }

  const operators: Array<{
    name: string;
    type: string;
    description: string;
    example: string;
    autocomplete?: { trigger: string; snippet: string };
  }> = [];

  for (const [name, def] of Object.entries(lang.operators)) {
    operators.push({
      name,
      type: def.type,
      description: def.description,
      example: def.example,
      autocomplete: def.autocomplete,
    });
  }

  const snippets = [
    {
      name: 'IF block',
      trigger: '[#IF',
      snippet: '[#IF {{${1:variable}}} #${2|equals,contains,exists,gt,lt|}(${3:value})]\\n$0\\n[END IF]',
      description: 'Conditional block',
    },
    {
      name: 'FOR loop',
      trigger: '[#FOR',
      snippet: '[#FOR ${1:item} IN {{${2:collection}}}]\\n$0\\n[END FOR]',
      description: 'Loop over a collection',
    },
    {
      name: 'SECTION',
      trigger: '[#SECTION',
      snippet: '[#SECTION name="${1:name}"]\\n$0\\n[END SECTION]',
      description: 'Reusable section',
    },
    {
      name: 'Variable',
      trigger: '{{',
      snippet: '{{${1:variable}}}',
      description: 'Variable substitution',
    },
    {
      name: 'Variable with default',
      trigger: '{{?',
      snippet: '{{${1:variable} ?? "${2:default}"}}',
      description: 'Variable with default value',
    },
    {
      name: 'Comment',
      trigger: '[#--',
      snippet: '[#-- ${1:comment} --]',
      description: 'Comment block',
    },
  ];

  return `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 * Generated from echo.lang.yaml by scripts/generate-grammar.ts
 */

// =============================================================================
// KEYWORDS
// =============================================================================

export const KEYWORDS = ${JSON.stringify(keywords, null, 2)} as const;

export type Keyword = typeof KEYWORDS[number];

// =============================================================================
// DIRECTIVES
// =============================================================================

export interface DirectiveDefinition {
  name: string;
  pattern: string;
  description: string;
  autocomplete?: {
    trigger: string;
    snippet: string;
  };
}

export const DIRECTIVES: DirectiveDefinition[] = ${JSON.stringify(directives, null, 2)};

// =============================================================================
// OPERATORS
// =============================================================================

export interface OperatorDefinition {
  name: string;
  type: 'comparison' | 'unary' | 'ai';
  description: string;
  example: string;
  autocomplete?: {
    trigger: string;
    snippet: string;
  };
}

export const OPERATORS: OperatorDefinition[] = ${JSON.stringify(operators, null, 2)};

// =============================================================================
// SNIPPETS
// =============================================================================

export interface SnippetDefinition {
  name: string;
  trigger: string;
  snippet: string;
  description: string;
}

export const SNIPPETS: SnippetDefinition[] = ${JSON.stringify(snippets, null, 2)};

// =============================================================================
// ALL AUTOCOMPLETE ITEMS
// =============================================================================

export interface AutocompleteItem {
  label: string;
  kind: 'keyword' | 'operator' | 'directive' | 'snippet';
  snippet: string;
  description: string;
  trigger?: string;
}

export function getAllAutocompleteItems(): AutocompleteItem[] {
  const items: AutocompleteItem[] = [];

  // Add operators
  for (const op of OPERATORS) {
    if (op.autocomplete) {
      items.push({
        label: \`#\${op.name}\`,
        kind: 'operator',
        snippet: op.autocomplete.snippet,
        description: op.description,
        trigger: op.autocomplete.trigger,
      });
    }
  }

  // Add directives
  for (const dir of DIRECTIVES) {
    if (dir.autocomplete) {
      items.push({
        label: \`#\${dir.name}\`,
        kind: 'directive',
        snippet: dir.autocomplete.snippet,
        description: dir.description,
        trigger: dir.autocomplete.trigger,
      });
    }
  }

  // Add snippets
  for (const snip of SNIPPETS) {
    items.push({
      label: snip.name,
      kind: 'snippet',
      snippet: snip.snippet,
      description: snip.description,
      trigger: snip.trigger,
    });
  }

  return items;
}
`;
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  console.log('Generating grammar from echo.lang.yaml...');

  // Read the language definition
  const yamlPath = join(packageDir, 'echo.lang.yaml');
  const yamlContent = readFileSync(yamlPath, 'utf-8');
  const lang = parseYaml(yamlContent) as LangDefinition;

  // Generate TextMate grammar
  const grammar = generateTextMateGrammar(lang);
  const grammarPath = join(packageDir, 'echo.tmLanguage.json');
  writeFileSync(grammarPath, JSON.stringify(grammar, null, 2));
  console.log(`✓ Generated ${grammarPath}`);

  // Generate TypeScript data
  const tsData = generateTypeScriptData(lang);
  const generatedDir = join(packageDir, 'src', 'generated');
  mkdirSync(generatedDir, { recursive: true });
  const tsPath = join(generatedDir, 'grammar-data.ts');
  writeFileSync(tsPath, tsData);
  console.log(`✓ Generated ${tsPath}`);

  console.log('Done!');
}

main();
