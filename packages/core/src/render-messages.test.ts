/**
 * Tests for echo.renderMessages() — the primary rendering method.
 *
 * Covers: messages, tools, meta, conditionals on all three,
 * variable substitution, edge cases, and error handling.
 */
import { describe, it, expect } from 'vitest';
import { createEcho } from './index.js';

function echo(config = {}) {
  return createEcho(config);
}

// ─── Messages ────────────────────────────────────────────────────────────────

describe('renderMessages', () => {
  describe('messages', () => {
    it('should render a single user message from plain text', async () => {
      const result = await echo().renderMessages('Hello world', {});
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content[0]).toEqual({ type: 'text', text: 'Hello world' });
    });

    it('should render system and user roles', async () => {
      const result = await echo().renderMessages(
        '[#ROLE system]\nYou are helpful.\n[END ROLE]\n\n[#ROLE user]\nHello\n[END ROLE]',
        {},
      );
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[1].role).toBe('user');
    });

    it('should render system, user, and assistant roles', async () => {
      const result = await echo().renderMessages(
        '[#ROLE system]\nSystem\n[END ROLE]\n[#ROLE user]\nUser\n[END ROLE]\n[#ROLE assistant]\nAssistant\n[END ROLE]',
        {},
      );
      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[1].role).toBe('user');
      expect(result.messages[2].role).toBe('assistant');
    });

    it('should substitute variables in messages', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHello {{name}}, topic is {{topic}}\n[END ROLE]',
        { name: 'Alice', topic: 'math' },
      );
      const text = result.messages[0].content[0];
      expect(text).toEqual({ type: 'text', text: expect.stringContaining('Hello Alice') });
      expect(text).toEqual({ type: 'text', text: expect.stringContaining('topic is math') });
    });

    it('should handle variable with default value', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHello {{name ?? "World"}}\n[END ROLE]',
        {},
      );
      expect(result.messages[0].content[0]).toEqual({
        type: 'text',
        text: expect.stringContaining('Hello World'),
      });
    });

    it('should evaluate conditionals in messages', async () => {
      const result = await echo().renderMessages(
        '[#ROLE system]\n[#IF {{mode}} #equals(formal)]\nBe formal.\n[ELSE]\nBe casual.\n[END IF]\n[END ROLE]',
        { mode: 'formal' },
      );
      const text = result.messages[0].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(text).toContain('Be formal.');
      expect(text).not.toContain('Be casual.');
    });

    it('should evaluate conditionals — else branch', async () => {
      const result = await echo().renderMessages(
        '[#ROLE system]\n[#IF {{mode}} #equals(formal)]\nBe formal.\n[ELSE]\nBe casual.\n[END IF]\n[END ROLE]',
        { mode: 'casual' },
      );
      const text = result.messages[0].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(text).toContain('Be casual.');
      expect(text).not.toContain('Be formal.');
    });

    it('should conditionally include entire role blocks', async () => {
      const result = await echo().renderMessages(
        '[#ROLE system]\nAlways here.\n[END ROLE]\n[#IF {{verbose}} #exists]\n[#ROLE user]\nExtra context.\n[END ROLE]\n[END IF]',
        { verbose: 'yes' },
      );
      expect(result.messages).toHaveLength(2);
    });

    it('should exclude conditional role blocks when condition is false', async () => {
      const result = await echo().renderMessages(
        '[#ROLE system]\nAlways here.\n[END ROLE]\n[#IF {{verbose}} #exists]\n[#ROLE user]\nExtra context.\n[END ROLE]\n[END IF]',
        {},
      );
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('system');
    });

    it('should handle #exists operator', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\n[#IF {{context}} #exists]\nContext: {{context}}\n[END IF]\nQuestion: {{q}}\n[END ROLE]',
        { q: 'What is 2+2?' },
      );
      const text = result.messages[0].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(text).toContain('What is 2+2?');
      expect(text).not.toContain('Context:');
    });

    it('should handle #contains operator', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\n[#IF {{tags}} #contains(urgent)]\nURGENT!\n[END IF]\n{{message}}\n[END ROLE]',
        { tags: 'urgent,important', message: 'Fix this' },
      );
      const text = result.messages[0].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(text).toContain('URGENT!');
    });

    it('should handle #gt operator', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\n[#IF {{count}} #gt(10)]\nMany items.\n[ELSE]\nFew items.\n[END IF]\n[END ROLE]',
        { count: 5 },
      );
      const text = result.messages[0].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(text).toContain('Few items.');
    });

    it('should handle nested conditionals', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\n[#IF {{a}} #exists]\n[#IF {{b}} #equals(yes)]\nBoth.\n[END IF]\n[END IF]\n[END ROLE]',
        { a: 'x', b: 'yes' },
      );
      const text = result.messages[0].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(text).toContain('Both.');
    });

    it('should handle ELSE IF chains', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\n[#IF {{lang}} #equals(en)]\nEnglish\n[ELSE IF {{lang}} #equals(es)]\nSpanish\n[ELSE]\nOther\n[END IF]\n[END ROLE]',
        { lang: 'es' },
      );
      const text = result.messages[0].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(text).toContain('Spanish');
      expect(text).not.toContain('English');
    });
  });

  // ─── Tools ──────────────────────────────────────────────────────────────────

  describe('tools', () => {
    it('should extract a simple tool definition', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHello\n[END ROLE]\n\n[#TOOL get_weather]\ndescription: Get current weather\nparameters:\n  city:\n    type: string\n    description: City name\n    required: true\n[END TOOL]',
        {},
      );
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].type).toBe('function');
      expect(result.tools[0].function.name).toBe('get_weather');
      expect(result.tools[0].function.description).toBe('Get current weather');
      expect(result.tools[0].function.parameters.properties).toHaveProperty('city');
    });

    it('should extract multiple tools', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHello\n[END ROLE]\n\n[#TOOL search]\ndescription: Search web\n[END TOOL]\n\n[#TOOL calculator]\ndescription: Do math\n[END TOOL]',
        {},
      );
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0].function.name).toBe('search');
      expect(result.tools[1].function.name).toBe('calculator');
    });

    it('should extract tool with multiple parameters', async () => {
      const result = await echo().renderMessages(
        '[#TOOL send_email]\ndescription: Send email\nparameters:\n  to:\n    type: string\n    description: Recipient\n    required: true\n  subject:\n    type: string\n    description: Email subject\n    required: true\n  body:\n    type: string\n    description: Email body\n[END TOOL]',
        {},
      );
      expect(result.tools).toHaveLength(1);
      const params = result.tools[0].function.parameters;
      expect(Object.keys(params.properties as object)).toEqual(['to', 'subject', 'body']);
      expect(params.required).toEqual(['to', 'subject']);
    });

    it('should conditionally include tools', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHello\n[END ROLE]\n\n[#IF {{use_tools}} #exists]\n[#TOOL search]\ndescription: Search\n[END TOOL]\n[END IF]',
        { use_tools: 'yes' },
      );
      expect(result.tools).toHaveLength(1);
    });

    it('should exclude conditional tools when condition is false', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHello\n[END ROLE]\n\n[#IF {{use_tools}} #exists]\n[#TOOL search]\ndescription: Search\n[END TOOL]\n[END IF]',
        {},
      );
      expect(result.tools).toHaveLength(0);
    });

    it('should handle mix of conditional and unconditional tools', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHello\n[END ROLE]\n\n[#TOOL always_available]\ndescription: Always here\n[END TOOL]\n\n[#IF {{premium}} #equals(true)]\n[#TOOL premium_tool]\ndescription: Premium only\n[END TOOL]\n[END IF]',
        { premium: 'false' },
      );
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].function.name).toBe('always_available');
    });

    it('should return empty tools array when no tools defined', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHello\n[END ROLE]',
        {},
      );
      expect(result.tools).toEqual([]);
    });

    it('should handle tool with enum parameter', async () => {
      const result = await echo().renderMessages(
        '[#TOOL set_mode]\ndescription: Set mode\nparameters:\n  mode:\n    type: string\n    enum: [fast, balanced, quality]\n    required: true\n[END TOOL]',
        {},
      );
      const modeParam = (result.tools[0].function.parameters.properties as Record<string, any>).mode;
      expect(modeParam.enum).toEqual(['fast', 'balanced', 'quality']);
    });
  });

  // ─── Meta ───────────────────────────────────────────────────────────────────

  describe('meta (metaTemplate)', () => {
    it('should resolve static meta template', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHello\n[END ROLE]',
        {},
        { metaTemplate: 'provider: openai\nmodel: gpt-4o\ntemperature: 0.7' },
      );
      expect(result.meta).toEqual({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
      });
    });

    it('should resolve meta with conditionals', async () => {
      const metaTemplate = `provider: openai
[#IF {{task}} #equals(creative)]
model: gpt-4o
temperature: 0.9
[ELSE]
model: gpt-4o-mini
temperature: 0.3
[END IF]`;

      const creative = await echo().renderMessages('[#ROLE user]\nHi\n[END ROLE]', { task: 'creative' }, { metaTemplate });
      expect(creative.meta.model).toBe('gpt-4o');
      expect(creative.meta.temperature).toBe(0.9);

      const factual = await echo().renderMessages('[#ROLE user]\nHi\n[END ROLE]', { task: 'factual' }, { metaTemplate });
      expect(factual.meta.model).toBe('gpt-4o-mini');
      expect(factual.meta.temperature).toBe(0.3);
    });

    it('should resolve meta with #exists', async () => {
      const metaTemplate = `provider: openai
model: gpt-4o-mini
[#IF {{max_tokens}} #exists]
maxTokens: {{max_tokens}}
[END IF]
temperature: 0.5`;

      const withMax = await echo().renderMessages('[#ROLE user]\nHi\n[END ROLE]', { max_tokens: 2000 }, { metaTemplate });
      expect(withMax.meta.maxTokens).toBe(2000);

      const withoutMax = await echo().renderMessages('[#ROLE user]\nHi\n[END ROLE]', {}, { metaTemplate });
      expect(withoutMax.meta).not.toHaveProperty('maxTokens');
    });

    it('should return empty meta when no metaTemplate provided', async () => {
      const result = await echo().renderMessages('[#ROLE user]\nHi\n[END ROLE]', {});
      expect(result.meta).toEqual({});
    });

    it('should parse boolean values in meta', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHi\n[END ROLE]',
        {},
        { metaTemplate: 'stream: true\njson_mode: false' },
      );
      expect(result.meta.stream).toBe(true);
      expect(result.meta.json_mode).toBe(false);
    });

    it('should parse numeric values in meta', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHi\n[END ROLE]',
        {},
        { metaTemplate: 'temperature: 0.7\nmaxTokens: 4096\ntopP: 0.95' },
      );
      expect(result.meta.temperature).toBe(0.7);
      expect(result.meta.maxTokens).toBe(4096);
      expect(result.meta.topP).toBe(0.95);
    });

    it('should parse string values in meta', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHi\n[END ROLE]',
        {},
        { metaTemplate: 'provider: anthropic\nmodel: claude-sonnet-4-20250514' },
      );
      expect(result.meta.provider).toBe('anthropic');
      expect(result.meta.model).toBe('claude-sonnet-4-20250514');
    });
  });

  // ─── Combined (Messages + Tools + Meta) ─────────────────────────────────────

  describe('combined rendering', () => {
    it('should return messages, tools, and meta together', async () => {
      const template = `[#ROLE system]
You are a helpful assistant.
[END ROLE]

[#ROLE user]
Tell me about {{topic}}
[END ROLE]

[#TOOL web_search]
description: Search the web
parameters:
  query:
    type: string
    description: Search query
    required: true
[END TOOL]`;

      const metaTemplate = 'provider: openai\nmodel: gpt-4o-mini\ntemperature: 0.7';

      const result = await echo().renderMessages(template, { topic: 'quantum physics' }, { metaTemplate });

      // Messages
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[1].role).toBe('user');
      const userText = result.messages[1].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(userText).toContain('quantum physics');

      // Tools
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].function.name).toBe('web_search');

      // Meta
      expect(result.meta.provider).toBe('openai');
      expect(result.meta.model).toBe('gpt-4o-mini');
      expect(result.meta.temperature).toBe(0.7);
    });

    it('should handle conditionals across messages, tools, and meta', async () => {
      const template = `[#ROLE system]
You are a {{role}} assistant.
[#IF {{verbose}} #exists]
Be very detailed.
[END IF]
[END ROLE]

[#ROLE user]
{{question}}
[END ROLE]

[#TOOL search]
description: Search knowledge base
[END TOOL]

[#IF {{enable_code}} #equals(true)]
[#TOOL run_code]
description: Execute code
parameters:
  code:
    type: string
    required: true
[END TOOL]
[END IF]`;

      const metaTemplate = `provider: openai
[#IF {{quality}} #equals(high)]
model: gpt-4o
temperature: 0.2
[ELSE]
model: gpt-4o-mini
temperature: 0.7
[END IF]`;

      const result = await echo().renderMessages(
        template,
        { role: 'coding', verbose: 'yes', question: 'Fix my code', enable_code: 'true', quality: 'high' },
        { metaTemplate },
      );

      // Messages — verbose included
      expect(result.messages).toHaveLength(2);
      const sysText = result.messages[0].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(sysText).toContain('coding assistant');
      expect(sysText).toContain('Be very detailed');

      // Tools — both included
      expect(result.tools).toHaveLength(2);
      expect(result.tools.map(t => t.function.name)).toEqual(['search', 'run_code']);

      // Meta — high quality
      expect(result.meta.model).toBe('gpt-4o');
      expect(result.meta.temperature).toBe(0.2);
    });

    it('should handle conditionals excluding tools and messages', async () => {
      const template = `[#ROLE system]
Base instructions.
[END ROLE]

[#IF {{verbose}} #exists]
[#ROLE user]
Extra context.
[END ROLE]
[END IF]

[#IF {{enable_tools}} #exists]
[#TOOL helper]
description: Helper tool
[END TOOL]
[END IF]`;

      const result = await echo().renderMessages(template, {});

      expect(result.messages).toHaveLength(1);
      expect(result.tools).toHaveLength(0);
    });
  });

  // ─── Schema ──────────────────────────────────────────────────────────────────

  describe('schema', () => {
    it('should parse a basic schema block', async () => {
      const template = `[#ROLE user]
Summarize this.
[END ROLE]

[#SCHEMA]
summary:
  type: string
  description: brief summary
  required: true
[END SCHEMA]`;

      const result = await echo().renderMessages(template, {});
      expect(result.schema).toBeDefined();
      expect(result.schema!.type).toBe('object');
      expect(result.schema!.properties).toHaveProperty('summary');
      expect(result.schema!.properties.summary.type).toBe('string');
      expect(result.schema!.properties.summary.description).toBe('brief summary');
      expect(result.schema!.required).toEqual(['summary']);
    });

    it('should parse schema with all property types (string, number, boolean, array, object)', async () => {
      const template = `[#SCHEMA]
name:
  type: string
age:
  type: number
active:
  type: boolean
tags:
  type: array
metadata:
  type: object
[END SCHEMA]`;

      const result = await echo().renderMessages(template, {});
      expect(result.schema).toBeDefined();
      expect(result.schema!.properties.name.type).toBe('string');
      expect(result.schema!.properties.age.type).toBe('number');
      expect(result.schema!.properties.active.type).toBe('boolean');
      expect(result.schema!.properties.tags.type).toBe('array');
      expect(result.schema!.properties.metadata.type).toBe('object');
    });

    it('should parse schema with enum, required, and description', async () => {
      const template = `[#SCHEMA]
summary:
  type: string
  description: brief summary
  required: true
sentiment:
  type: string
  enum: [positive, negative, neutral]
  required: true
confidence:
  type: number
[END SCHEMA]`;

      const result = await echo().renderMessages(template, {});
      expect(result.schema).toBeDefined();
      expect(result.schema!.properties.sentiment.enum).toEqual(['positive', 'negative', 'neutral']);
      expect(result.schema!.required).toEqual(['summary', 'sentiment']);
      expect(result.schema!.properties.confidence.type).toBe('number');
      expect(result.schema!.required).not.toContain('confidence');
    });

    it('should error when schema is inside a conditional', async () => {
      const template = `[#IF {{mode}} #exists]
[#SCHEMA]
result:
  type: string
[END SCHEMA]
[END IF]`;

      await expect(echo().renderMessages(template, { mode: 'yes' })).rejects.toThrow(
        /SCHEMA.*cannot be inside a conditional/i
      );
    });

    it('should error when multiple schemas are defined', async () => {
      const template = `[#SCHEMA]
a:
  type: string
[END SCHEMA]

[#SCHEMA]
b:
  type: number
[END SCHEMA]`;

      await expect(echo().renderMessages(template, {})).rejects.toThrow(
        /Only one.*SCHEMA.*allowed/i
      );
    });

    it('should return schema from renderMessages alongside messages and tools', async () => {
      const template = `[#ROLE system]
You are helpful.
[END ROLE]

[#ROLE user]
Analyze {{text}}
[END ROLE]

[#TOOL search]
description: Search the web
parameters:
  query:
    type: string
    required: true
[END TOOL]

[#SCHEMA]
summary:
  type: string
  required: true
sentiment:
  type: string
  enum: [positive, negative, neutral]
[END SCHEMA]`;

      const result = await echo().renderMessages(template, { text: 'hello world' });

      // Messages
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[1].role).toBe('user');

      // Tools
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].function.name).toBe('search');

      // Schema
      expect(result.schema).toBeDefined();
      expect(result.schema!.properties.summary.type).toBe('string');
      expect(result.schema!.properties.sentiment.enum).toEqual(['positive', 'negative', 'neutral']);
      expect(result.schema!.required).toEqual(['summary']);
    });

    it('should return no schema when none is defined', async () => {
      const result = await echo().renderMessages('[#ROLE user]\nHello\n[END ROLE]', {});
      expect(result.schema).toBeUndefined();
    });

    it('should not render schema content as text', async () => {
      const template = `Hello world
[#SCHEMA]
result:
  type: string
[END SCHEMA]`;

      const e = createEcho();
      const rendered = await e.render(template, {});
      expect(rendered).not.toContain('type: string');
      expect(rendered).toContain('Hello world');
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty template', async () => {
      const result = await echo().renderMessages('', {});
      expect(result.messages).toHaveLength(0);
      expect(result.tools).toEqual([]);
    });

    it('should handle template with only whitespace', async () => {
      const result = await echo().renderMessages('   \n\n   ', {});
      // Whitespace-only should result in no meaningful messages
      expect(result.messages.length).toBeLessThanOrEqual(1);
    });

    it('should handle template with only tools (no roles)', async () => {
      const result = await echo().renderMessages(
        '[#TOOL my_tool]\ndescription: A tool\n[END TOOL]',
        {},
      );
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].function.name).toBe('my_tool');
    });

    it('should handle undefined variables gracefully (lenient mode)', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\nHello {{undefined_var}}\n[END ROLE]',
        {},
      );
      // Should not throw, should render with empty string
      expect(result.messages).toHaveLength(1);
    });

    it('should throw on parse errors', async () => {
      await expect(
        echo().renderMessages('[#IF missing end', {}),
      ).rejects.toThrow();
    });

    it('should handle tool with no parameters', async () => {
      const result = await echo().renderMessages(
        '[#TOOL simple_tool]\ndescription: Does something\n[END TOOL]',
        {},
      );
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].function.name).toBe('simple_tool');
      expect(result.tools[0].function.description).toBe('Does something');
    });

    it('should handle multiple #equals conditions on same variable', async () => {
      const metaTemplate = `[#IF {{provider}} #equals(openai)]
model: gpt-4o
[END IF]
[#IF {{provider}} #equals(anthropic)]
model: claude-sonnet-4-20250514
[END IF]`;

      const openai = await echo().renderMessages('[#ROLE user]\nHi\n[END ROLE]', { provider: 'openai' }, { metaTemplate });
      expect(openai.meta.model).toBe('gpt-4o');

      const anthropic = await echo().renderMessages('[#ROLE user]\nHi\n[END ROLE]', { provider: 'anthropic' }, { metaTemplate });
      expect(anthropic.meta.model).toBe('claude-sonnet-4-20250514');
    });
  });

  // ─── Operators ──────────────────────────────────────────────────────────────

  describe('operators in context', () => {
    it('#one_of / #in', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\n[#IF {{lang}} #one_of(en,es,fr)]\nSupported.\n[ELSE]\nNot supported.\n[END IF]\n[END ROLE]',
        { lang: 'es' },
      );
      const text = result.messages[0].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(text).toContain('Supported.');
    });

    it('#matches (regex)', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\n[#IF {{email}} #matches(^[^@]+@[^@]+$)]\nValid email.\n[ELSE]\nInvalid.\n[END IF]\n[END ROLE]',
        { email: 'test@example.com' },
      );
      const text = result.messages[0].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(text).toContain('Valid email.');
    });

    it('#lt and #lte', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\n[#IF {{temp}} #lt(100)]\nCool.\n[END IF]\n[END ROLE]',
        { temp: 50 },
      );
      const text = result.messages[0].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(text).toContain('Cool.');
    });

    it('#gte', async () => {
      const result = await echo().renderMessages(
        '[#ROLE user]\n[#IF {{score}} #gte(90)]\nExcellent!\n[END IF]\n[END ROLE]',
        { score: 95 },
      );
      const text = result.messages[0].content.map(b => b.type === 'text' ? b.text : '').join('');
      expect(text).toContain('Excellent!');
    });
  });
});
