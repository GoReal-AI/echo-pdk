/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 * Generated from echo.lang.yaml by scripts/generate-grammar.ts
 */

// =============================================================================
// KEYWORDS
// =============================================================================

export const KEYWORDS = [
  "IF",
  "ELSE",
  "ELSE IF",
  "END IF",
  "FOR",
  "END FOR",
  "IN",
  "SECTION",
  "END SECTION",
  "IMPORT",
  "INCLUDE"
] as const;

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

export const DIRECTIVES: DirectiveDefinition[] = [
  {
    "name": "variable",
    "pattern": "\\{\\{([^}]+)\\}\\}",
    "description": "Variable substitution"
  },
  {
    "name": "import",
    "pattern": "\\[#IMPORT\\s+([^\\]]+)\\]",
    "description": "Import another Echo template"
  },
  {
    "name": "include",
    "pattern": "\\[#INCLUDE\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\]",
    "description": "Include a defined section"
  },
  {
    "name": "context",
    "pattern": "#context\\(([^)]+)\\)",
    "description": "Reference a file or image from Context Store",
    "autocomplete": {
      "trigger": "#con",
      "snippet": "#context($1)"
    }
  }
];

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

export const OPERATORS: OperatorDefinition[] = [
  {
    "name": "equals",
    "type": "comparison",
    "description": "Exact equality check (case-insensitive for strings)",
    "example": "{{genre}} #equals(Horror)",
    "autocomplete": {
      "trigger": "#eq",
      "snippet": "#equals($1)"
    }
  },
  {
    "name": "contains",
    "type": "comparison",
    "description": "Check if string or array contains value",
    "example": "{{companions}} #contains(Shimon)",
    "autocomplete": {
      "trigger": "#con",
      "snippet": "#contains($1)"
    }
  },
  {
    "name": "matches",
    "type": "comparison",
    "description": "Regex pattern matching",
    "example": "{{email}} #matches(.*@.*\\.com)",
    "autocomplete": {
      "trigger": "#mat",
      "snippet": "#matches($1)"
    }
  },
  {
    "name": "in",
    "type": "comparison",
    "description": "Check if value is in a comma-separated list",
    "example": "{{status}} #in(active,pending,completed)",
    "autocomplete": {
      "trigger": "#in",
      "snippet": "#in($1)"
    }
  },
  {
    "name": "gt",
    "type": "comparison",
    "description": "Greater than comparison",
    "example": "{{age}} #gt(18)",
    "autocomplete": {
      "trigger": "#gt",
      "snippet": "#gt($1)"
    }
  },
  {
    "name": "gte",
    "type": "comparison",
    "description": "Greater than or equal comparison",
    "example": "{{score}} #gte(50)",
    "autocomplete": {
      "trigger": "#gte",
      "snippet": "#gte($1)"
    }
  },
  {
    "name": "lt",
    "type": "comparison",
    "description": "Less than comparison",
    "example": "{{count}} #lt(10)",
    "autocomplete": {
      "trigger": "#lt",
      "snippet": "#lt($1)"
    }
  },
  {
    "name": "lte",
    "type": "comparison",
    "description": "Less than or equal comparison",
    "example": "{{retries}} #lte(3)",
    "autocomplete": {
      "trigger": "#lte",
      "snippet": "#lte($1)"
    }
  },
  {
    "name": "exists",
    "type": "unary",
    "description": "Check if variable is defined and not empty",
    "example": "{{user.preferences}} #exists",
    "autocomplete": {
      "trigger": "#ex",
      "snippet": "#exists"
    }
  },
  {
    "name": "ai_judge",
    "type": "ai",
    "description": "LLM-evaluated boolean condition",
    "example": "{{content}} #ai_judge(Is this appropriate for children?)",
    "autocomplete": {
      "trigger": "#ai",
      "snippet": "#ai_judge($1)"
    }
  }
];

// =============================================================================
// SNIPPETS
// =============================================================================

export interface SnippetDefinition {
  name: string;
  trigger: string;
  snippet: string;
  description: string;
}

export const SNIPPETS: SnippetDefinition[] = [
  {
    "name": "IF block",
    "trigger": "[#IF",
    "snippet": "[#IF {{${1:variable}}} #${2|equals,contains,exists,gt,lt|}(${3:value})]\\n$0\\n[END IF]",
    "description": "Conditional block"
  },
  {
    "name": "FOR loop",
    "trigger": "[#FOR",
    "snippet": "[#FOR ${1:item} IN {{${2:collection}}}]\\n$0\\n[END FOR]",
    "description": "Loop over a collection"
  },
  {
    "name": "SECTION",
    "trigger": "[#SECTION",
    "snippet": "[#SECTION name=\"${1:name}\"]\\n$0\\n[END SECTION]",
    "description": "Reusable section"
  },
  {
    "name": "Variable",
    "trigger": "{{",
    "snippet": "{{${1:variable}}}",
    "description": "Variable substitution"
  },
  {
    "name": "Variable with default",
    "trigger": "{{?",
    "snippet": "{{${1:variable} ?? \"${2:default}\"}}",
    "description": "Variable with default value"
  },
  {
    "name": "Comment",
    "trigger": "[#--",
    "snippet": "[#-- ${1:comment} --]",
    "description": "Comment block"
  }
];

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
        label: `#${op.name}`,
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
        label: `#${dir.name}`,
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
