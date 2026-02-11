/**
 * @fileoverview Integration tests for @goreal-ai/echo-pdk
 *
 * These tests verify the full end-to-end flow from template to rendered output.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEcho, definePlugin } from './index.js';

describe('createEcho', () => {
  describe('basic rendering', () => {
    it('should render plain text', async () => {
      const echo = createEcho();
      const result = await echo.render('Hello world', {});
      expect(result).toBe('Hello world');
    });

    it('should render variables', async () => {
      const echo = createEcho();
      const result = await echo.render('Hello {{name}}!', { name: 'Alice' });
      expect(result).toBe('Hello Alice!');
    });

    it('should render nested variables', async () => {
      const echo = createEcho();
      const result = await echo.render('Hello {{user.name}}!', {
        user: { name: 'Alice' },
      });
      expect(result).toBe('Hello Alice!');
    });

    it('should render array access', async () => {
      const echo = createEcho();
      const result = await echo.render('First: {{items[0]}}', {
        items: ['apple', 'banana'],
      });
      expect(result).toBe('First: apple');
    });

    it('should render variable with default value', async () => {
      const echo = createEcho();
      const result = await echo.render('Hello {{name ?? "Guest"}}!', {});
      expect(result).toBe('Hello Guest!');
    });
  });

  describe('conditionals', () => {
    it('should render #exists conditional (true)', async () => {
      const echo = createEcho();
      const template = '[#IF {{name}} #exists]Hello {{name}}[END IF]';
      const result = await echo.render(template, { name: 'Alice' });
      expect(result).toBe('Hello Alice');
    });

    it('should render #exists conditional (false)', async () => {
      const echo = createEcho();
      const template = '[#IF {{name}} #exists]Hello {{name}}[END IF]';
      const result = await echo.render(template, {});
      expect(result).toBe('');
    });

    it('should render #exists with ELSE branch', async () => {
      const echo = createEcho();
      const template = '[#IF {{name}} #exists]Hello {{name}}[ELSE]No name[END IF]';

      const result1 = await echo.render(template, { name: 'Alice' });
      expect(result1).toBe('Hello Alice');

      const result2 = await echo.render(template, {});
      expect(result2).toBe('No name');
    });

    it('should render #equals conditional', async () => {
      const echo = createEcho();
      const template = '[#IF {{tier}} #equals(premium)]VIP[ELSE]Regular[END IF]';

      const result1 = await echo.render(template, { tier: 'premium' });
      expect(result1).toBe('VIP');

      const result2 = await echo.render(template, { tier: 'free' });
      expect(result2).toBe('Regular');
    });

    it('should render #contains conditional', async () => {
      const echo = createEcho();
      const template = '[#IF {{text}} #contains(error)]Has error[END IF]';

      const result1 = await echo.render(template, { text: 'An error occurred' });
      expect(result1).toBe('Has error');

      const result2 = await echo.render(template, { text: 'All good' });
      expect(result2).toBe('');
    });

    it('should render #gt conditional', async () => {
      const echo = createEcho();
      const template = '[#IF {{age}} #gt(18)]Adult[ELSE]Minor[END IF]';

      const result1 = await echo.render(template, { age: 21 });
      expect(result1).toBe('Adult');

      const result2 = await echo.render(template, { age: 16 });
      expect(result2).toBe('Minor');
    });

    it('should render #in conditional', async () => {
      const echo = createEcho();
      const template = '[#IF {{status}} #in(active,pending)]Show[END IF]';

      const result1 = await echo.render(template, { status: 'active' });
      expect(result1).toBe('Show');

      const result2 = await echo.render(template, { status: 'deleted' });
      expect(result2).toBe('');
    });

    it('should render nested conditionals', async () => {
      const echo = createEcho();
      const template = `[#IF {{a}} #exists]A[#IF {{b}} #exists]B[END IF][END IF]`;

      const result1 = await echo.render(template, { a: true, b: true });
      expect(result1).toBe('AB');

      const result2 = await echo.render(template, { a: true });
      expect(result2).toBe('A');

      const result3 = await echo.render(template, {});
      expect(result3).toBe('');
    });

    it('should render ELSE IF chain', async () => {
      const echo = createEcho();
      const template = `[#IF {{x}} #equals(a)]A[ELSE IF {{x}} #equals(b)]B[ELSE]C[END IF]`;

      const resultA = await echo.render(template, { x: 'a' });
      expect(resultA).toBe('A');

      const resultB = await echo.render(template, { x: 'b' });
      expect(resultB).toBe('B');

      const resultC = await echo.render(template, { x: 'c' });
      expect(resultC).toBe('C');
    });
  });

  describe('sections and includes', () => {
    it('should render section via include', async () => {
      const echo = createEcho();
      const template = `[#SECTION name="greeting"]Hello![END SECTION][#INCLUDE greeting]`;
      const result = await echo.render(template, {});
      expect(result).toBe('Hello!');
    });

    it('should render section with variables', async () => {
      const echo = createEcho();
      const template = `[#SECTION name="greeting"]Hello {{name}}![END SECTION][#INCLUDE greeting]`;
      const result = await echo.render(template, { name: 'Alice' });
      expect(result).toBe('Hello Alice!');
    });

    it('should handle multiple includes of same section', async () => {
      const echo = createEcho();
      const template = `[#SECTION name="divider"]---[END SECTION]A[#INCLUDE divider]B[#INCLUDE divider]C`;
      const result = await echo.render(template, {});
      expect(result).toBe('A---B---C');
    });
  });

  describe('complex templates', () => {
    it('should render movie recommender example', async () => {
      const echo = createEcho();
      const template = `You are a movie recommendation assistant.
[#IF {{companions}} #exists]
The user is watching with: {{companions}}.
[END IF]
[#IF {{genre}} #equals("Horror")]
Suggest scary movies.
[ELSE IF {{genre}} #equals("Comedy")]
Suggest funny movies.
[ELSE]
Suggest popular movies.
[END IF]`;

      const result = await echo.render(template, {
        companions: 'friends',
        genre: 'Horror',
      });

      expect(result).toContain('You are a movie recommendation assistant.');
      expect(result).toContain('The user is watching with: friends.');
      expect(result).toContain('Suggest scary movies.');
    });

    it('should handle conditional sections', async () => {
      const echo = createEcho();
      const template = `[#SECTION name="premium"]Premium features here![END SECTION][#IF {{tier}} #equals(premium)][#INCLUDE premium][END IF]`;

      const result1 = await echo.render(template, { tier: 'premium' });
      expect(result1).toBe('Premium features here!');

      const result2 = await echo.render(template, { tier: 'free' });
      expect(result2).toBe('');
    });
  });

  describe('parsing', () => {
    it('should return AST from parse', () => {
      const echo = createEcho();
      const result = echo.parse('Hello {{name}}!');

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
      expect(result.ast?.length).toBe(3);
    });

    it('should report parse errors', () => {
      const echo = createEcho();
      const result = echo.parse('Hello {{name');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('should validate correct template', () => {
      const echo = createEcho();
      const result = echo.validate('Hello {{name}}!');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report syntax errors', () => {
      const echo = createEcho();
      const result = echo.validate('Hello {{name');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about unknown operators in lenient mode', () => {
      const echo = createEcho({ strict: false });
      const result = echo.validate('[#IF {{x}} #unknownOp]yes[END IF]');

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].code).toBe('UNKNOWN_OPERATOR');
    });

    it('should error on unknown operators in strict mode', () => {
      const echo = createEcho({ strict: true });
      const result = echo.validate('[#IF {{x}} #unknownOp]yes[END IF]');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'UNKNOWN_OPERATOR')).toBe(true);
    });

    it('should warn about unknown sections in lenient mode', () => {
      const echo = createEcho({ strict: false });
      const result = echo.validate('[#INCLUDE unknownSection]');

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'UNKNOWN_SECTION')).toBe(true);
    });

    it('should warn about imports', () => {
      const echo = createEcho();
      const result = echo.validate('[#IMPORT "./header.echo"]');

      expect(result.warnings.some((w) => w.code === 'IMPORT_NOT_RESOLVED')).toBe(true);
    });

    it('should recognize custom operators registered via registerOperator', () => {
      const echo = createEcho({ strict: true });

      // Register a custom operator
      echo.registerOperator('customOp', {
        type: 'unary',
        handler: () => true,
        description: 'Custom operator for testing',
      });

      // Validation should NOT warn about this operator
      const result = echo.validate('[#IF {{x}} #customOp]yes[END IF]');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.some((w) => w.code === 'UNKNOWN_OPERATOR')).toBe(false);
    });

    it('should recognize custom operators loaded via plugin', () => {
      const echo = createEcho({ strict: true });

      // Load a plugin with custom operator
      echo.loadPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        operators: {
          pluginOp: {
            type: 'unary',
            handler: () => true,
            description: 'Plugin operator for testing',
          },
        },
      });

      // Validation should NOT warn about this operator
      const result = echo.validate('[#IF {{x}} #pluginOp]yes[END IF]');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.some((w) => w.code === 'UNKNOWN_OPERATOR')).toBe(false);
    });
  });

  describe('custom operators', () => {
    it('should support registerOperator', async () => {
      const echo = createEcho();

      echo.registerOperator('isEmpty', {
        type: 'unary',
        handler: (value) => !value || value === '',
        description: 'Check if value is empty',
      });

      const template = '[#IF {{name}} #isEmpty]No name[ELSE]Has name[END IF]';

      const result1 = await echo.render(template, { name: '' });
      expect(result1).toBe('No name');

      const result2 = await echo.render(template, { name: 'Alice' });
      expect(result2).toBe('Has name');
    });

    it('should support custom operator with argument', async () => {
      const echo = createEcho();

      echo.registerOperator('startsWith', {
        type: 'comparison',
        handler: (value, arg) =>
          typeof value === 'string' &&
          typeof arg === 'string' &&
          value.toLowerCase().startsWith(arg.toLowerCase()),
        description: 'Check if string starts with prefix',
      });

      const template = '[#IF {{url}} #startsWith(https)]Secure[ELSE]Insecure[END IF]';

      const result1 = await echo.render(template, { url: 'https://example.com' });
      expect(result1).toBe('Secure');

      const result2 = await echo.render(template, { url: 'http://example.com' });
      expect(result2).toBe('Insecure');
    });
  });

  describe('plugins', () => {
    it('should load plugin with operators', async () => {
      const echo = createEcho();

      echo.loadPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        operators: {
          isEven: {
            type: 'unary',
            handler: (value) => typeof value === 'number' && value % 2 === 0,
            description: 'Check if number is even',
          },
        },
      });

      const template = '[#IF {{num}} #isEven]Even[ELSE]Odd[END IF]';

      const result1 = await echo.render(template, { num: 4 });
      expect(result1).toBe('Even');

      const result2 = await echo.render(template, { num: 3 });
      expect(result2).toBe('Odd');
    });

    it('should call onLoad hook', () => {
      const echo = createEcho();
      const onLoadMock = vi.fn();

      echo.loadPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        onLoad: onLoadMock,
      });

      expect(onLoadMock).toHaveBeenCalled();
    });

    it('should throw for invalid plugin', () => {
      const echo = createEcho();

      expect(() => echo.loadPlugin({} as any)).toThrow('Plugin must have a name');
      expect(() => echo.loadPlugin({ name: 'test' } as any)).toThrow(
        'Plugin must have a version'
      );
    });
  });

  describe('definePlugin helper', () => {
    it('should return the same plugin object', () => {
      const plugin = definePlugin({
        name: 'my-plugin',
        version: '1.0.0',
        operators: {
          test: {
            type: 'unary',
            handler: () => true,
            description: 'Test operator',
          },
        },
      });

      expect(plugin.name).toBe('my-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.operators?.test).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw on parse error during render', async () => {
      const echo = createEcho();
      await expect(echo.render('Hello {{name', {})).rejects.toThrow('Parse error');
    });

    it('should handle undefined variables in lenient mode', async () => {
      const echo = createEcho({ strict: false });
      const result = await echo.render('Hello {{name}}!', {});
      expect(result).toBe('Hello !');
    });

    it('should throw for undefined variables in strict mode', async () => {
      const echo = createEcho({ strict: true });
      await expect(echo.render('Hello {{name}}!', {})).rejects.toThrow(
        'Undefined variable'
      );
    });

    it('should throw for unknown operator in strict mode during render', async () => {
      const echo = createEcho({ strict: true });
      await expect(
        echo.render('[#IF {{x}} #unknownOp]yes[END IF]', { x: 'value' })
      ).rejects.toThrow('Unknown operator');
    });
  });

  describe('whitespace handling', () => {
    it('should collapse multiple newlines', async () => {
      const echo = createEcho();
      const template = `Line 1

[#IF {{show}} #exists]

[END IF]

Line 2`;

      const result = await echo.render(template, { show: '' });
      // Multiple consecutive newlines should be collapsed
      expect(result.match(/\n{3,}/)).toBeNull();
    });

    it('should preserve intentional whitespace', async () => {
      const echo = createEcho();
      const template = '  Hello  {{name}}  ';
      const result = await echo.render(template, { name: 'Alice' });
      expect(result).toBe('  Hello  Alice  ');
    });
  });
});

describe('AI gate operator (#ai_gate)', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be registered as a known operator even without API key', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ECHO_API_KEY;

    const echo = createEcho();

    const result = echo.validate('[#IF {{x}} #ai_gate("Is this good?")]yes[END IF]');

    expect(result.warnings.some((w) => w.code === 'UNKNOWN_OPERATOR')).toBe(false);
    expect(result.valid).toBe(true);
  });

  it('should throw at runtime without API key configured (strict mode)', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ECHO_API_KEY;

    const echo = createEcho({ strict: true });

    await expect(
      echo.render('[#IF {{x}} #ai_gate("Is this good?")]yes[END IF]', { x: 'test' })
    ).rejects.toThrow('AI gate not configured');
  });

  it('should treat ai_gate as false in lenient mode without API key', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ECHO_API_KEY;

    const echo = createEcho();

    const result = await echo.render(
      '[#IF {{x}} #ai_gate("Is this good?")]yes[ELSE]no[END IF]',
      { x: 'test' }
    );

    expect(result).toBe('no');
  });
});

describe('Deprecated #ai_judge backward compatibility', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should still register ai_judge as a known operator', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ECHO_API_KEY;

    const echo = createEcho();

    const result = echo.validate('[#IF {{x}} #ai_judge("Is this good?")]yes[END IF]');

    expect(result.warnings.some((w) => w.code === 'UNKNOWN_OPERATOR')).toBe(false);
    expect(result.valid).toBe(true);
  });

  it('should treat deprecated ai_judge as false in lenient mode without API key', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ECHO_API_KEY;

    const echo = createEcho();

    const result = await echo.render(
      '[#IF {{x}} #ai_judge("Is this good?")]yes[ELSE]no[END IF]',
      { x: 'test' }
    );

    expect(result).toBe('no');
  });
});
