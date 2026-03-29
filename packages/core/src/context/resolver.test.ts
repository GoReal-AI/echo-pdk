/**
 * @fileoverview Tests for Context Resolver
 */

import { describe, it, expect } from 'vitest';
import {
  validateContextPath,
  isPlpReference,
  extractAssetId,
  collectContextPaths,
  applyResolvedContext,
  MockContextResolver,
} from './resolver.js';
import { parse } from '../parser/parser.js';
import { createEcho } from '../index.js';

describe('validateContextPath', () => {
  describe('valid paths', () => {
    it('should accept simple context names', () => {
      expect(validateContextPath('product-image')).toEqual({ isValid: true });
      expect(validateContextPath('hero_image')).toEqual({ isValid: true });
      expect(validateContextPath('logo')).toEqual({ isValid: true });
      expect(validateContextPath('file1')).toEqual({ isValid: true });
    });

    it('should accept plp:// references', () => {
      expect(validateContextPath('plp://logo-v2')).toEqual({ isValid: true });
      expect(validateContextPath('plp://hero_image')).toEqual({ isValid: true });
      expect(validateContextPath('plp://company-logo')).toEqual({ isValid: true });
    });

    it('should accept filenames with dots', () => {
      expect(validateContextPath('image.png')).toEqual({ isValid: true });
      expect(validateContextPath('data.json')).toEqual({ isValid: true });
    });
  });

  describe('invalid paths', () => {
    it('should reject empty paths', () => {
      const result = validateContextPath('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject whitespace-only paths', () => {
      const result = validateContextPath('   ');
      expect(result.isValid).toBe(false);
    });

    it('should reject path traversal', () => {
      const result = validateContextPath('../etc/passwd');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('path traversal');
    });

    it('should reject external URLs', () => {
      const result = validateContextPath('https://evil.com/payload');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('plp://');
    });

    it('should reject http URLs', () => {
      const result = validateContextPath('http://evil.com/payload');
      expect(result.isValid).toBe(false);
    });

    it('should reject file:// URLs', () => {
      const result = validateContextPath('file:///etc/passwd');
      expect(result.isValid).toBe(false);
    });

    it('should reject encoded characters', () => {
      const result = validateContextPath('path%2Ftraversal');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('encoded');
    });

    it('should reject too-long asset IDs', () => {
      const longPath = 'plp://' + 'a'.repeat(100);
      const result = validateContextPath(longPath);
      expect(result.isValid).toBe(false);
    });
  });
});

describe('isPlpReference', () => {
  it('should return true for plp:// references', () => {
    expect(isPlpReference('plp://logo')).toBe(true);
    expect(isPlpReference('plp://company-asset')).toBe(true);
  });

  it('should return false for non-plp references', () => {
    expect(isPlpReference('logo')).toBe(false);
    expect(isPlpReference('product-image')).toBe(false);
    expect(isPlpReference('https://example.com')).toBe(false);
  });
});

describe('extractAssetId', () => {
  it('should extract asset ID from plp:// reference', () => {
    expect(extractAssetId('plp://logo')).toBe('logo');
    expect(extractAssetId('plp://company-logo-v2')).toBe('company-logo-v2');
  });

  it('should return path as-is for non-plp references', () => {
    expect(extractAssetId('product-image')).toBe('product-image');
    expect(extractAssetId('hero.png')).toBe('hero.png');
  });
});

describe('collectContextPaths', () => {
  it('should collect context paths from simple template', () => {
    const result = parse('Hello #context(product-image)');
    expect(result.success).toBe(true);
    if (result.ast) {
      const paths = collectContextPaths(result.ast);
      expect(paths).toEqual(['product-image']);
    }
  });

  it('should collect multiple context paths', () => {
    const result = parse('Image 1: #context(image1) Image 2: #context(image2)');
    expect(result.success).toBe(true);
    if (result.ast) {
      const paths = collectContextPaths(result.ast);
      expect(paths).toContain('image1');
      expect(paths).toContain('image2');
      expect(paths).toHaveLength(2);
    }
  });

  it('should deduplicate repeated context paths', () => {
    const result = parse('#context(logo) and again #context(logo)');
    expect(result.success).toBe(true);
    if (result.ast) {
      const paths = collectContextPaths(result.ast);
      expect(paths).toEqual(['logo']);
    }
  });

  it('should collect from nested conditionals', () => {
    const template = `
      [#IF {{show}} #exists]
        #context(hero-image)
      [ELSE]
        #context(fallback-image)
      [END IF]
    `;
    const result = parse(template);
    expect(result.success).toBe(true);
    if (result.ast) {
      const paths = collectContextPaths(result.ast);
      expect(paths).toContain('hero-image');
      expect(paths).toContain('fallback-image');
    }
  });
});

describe('applyResolvedContext', () => {
  it('should apply resolved content to context nodes', () => {
    const result = parse('Image: #context(logo)');
    expect(result.success).toBe(true);
    if (result.ast) {
      const resolved = new Map([
        ['logo', {
          success: true,
          content: {
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,abc123',
          },
        }],
      ]);

      applyResolvedContext(result.ast, resolved);

      // Find the context node and verify it has resolved content
      const contextNode = result.ast.find(n => n.type === 'context');
      expect(contextNode).toBeDefined();
      if (contextNode && contextNode.type === 'context') {
        expect(contextNode.resolvedContent).toBeDefined();
        expect(contextNode.resolvedContent?.mimeType).toBe('image/png');
        expect(contextNode.resolvedContent?.dataUrl).toBe('data:image/png;base64,abc123');
      }
    }
  });
});

describe('MockContextResolver', () => {
  it('should resolve mocked content', async () => {
    const resolver = new MockContextResolver({
      'logo': {
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,test123',
      },
    });

    const result = await resolver.resolve('logo');
    expect(result.success).toBe(true);
    expect(result.content?.mimeType).toBe('image/png');
    expect(result.content?.dataUrl).toBe('data:image/png;base64,test123');
  });

  it('should fail for unknown paths', async () => {
    const resolver = new MockContextResolver();

    const result = await resolver.resolve('unknown');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should validate paths before resolving', async () => {
    const resolver = new MockContextResolver({
      '../etc/passwd': { mimeType: 'text/plain', text: 'hacked' },
    });

    const result = await resolver.resolve('../etc/passwd');
    expect(result.success).toBe(false);
    expect(result.error).toContain('path traversal');
  });

  it('should allow adding mock data dynamically', async () => {
    const resolver = new MockContextResolver();

    resolver.addMock('dynamic', {
      mimeType: 'text/plain',
      text: 'Dynamic content',
    });

    const result = await resolver.resolve('dynamic');
    expect(result.success).toBe(true);
    expect(result.content?.text).toBe('Dynamic content');
  });

  it('should support batch resolution', async () => {
    const resolver = new MockContextResolver({
      'a': { mimeType: 'text/plain', text: 'A' },
      'b': { mimeType: 'text/plain', text: 'B' },
    });

    const results = await resolver.resolveBatch(['a', 'b', 'c']);

    expect(results.get('a')?.success).toBe(true);
    expect(results.get('b')?.success).toBe(true);
    expect(results.get('c')?.success).toBe(false);
  });
});

describe('context inside role blocks', () => {
  describe('collectContextPaths', () => {
    it('should find context nodes inside a role block', () => {
      const template = '[#ROLE user]\nDescribe this:\n#context(hero-image)\n[END ROLE]';
      const result = parse(template);
      expect(result.success).toBe(true);
      if (result.ast) {
        const paths = collectContextPaths(result.ast);
        expect(paths).toEqual(['hero-image']);
      }
    });

    it('should find context nodes across multiple role blocks', () => {
      const template =
        '[#ROLE system]\nContext: #context(system-doc)\n[END ROLE]\n' +
        '[#ROLE user]\nSee: #context(user-image)\n[END ROLE]';
      const result = parse(template);
      expect(result.success).toBe(true);
      if (result.ast) {
        const paths = collectContextPaths(result.ast);
        expect(paths).toContain('system-doc');
        expect(paths).toContain('user-image');
        expect(paths).toHaveLength(2);
      }
    });

    it('should find context nodes nested in conditionals inside role blocks', () => {
      const template =
        '[#ROLE user]\n' +
        '[#IF {{show}} #exists]\n#context(conditional-image)\n[END IF]\n' +
        '[END ROLE]';
      const result = parse(template);
      expect(result.success).toBe(true);
      if (result.ast) {
        const paths = collectContextPaths(result.ast);
        expect(paths).toEqual(['conditional-image']);
      }
    });
  });

  describe('applyResolvedContext', () => {
    it('should apply resolved content to context nodes inside role blocks', () => {
      const template = '[#ROLE user]\nImage: #context(logo)\n[END ROLE]';
      const result = parse(template);
      expect(result.success).toBe(true);
      if (result.ast) {
        const resolved = new Map([
          ['logo', {
            success: true,
            content: {
              mimeType: 'image/png',
              dataUrl: 'data:image/png;base64,abc123',
            },
          }],
        ]);

        applyResolvedContext(result.ast, resolved);

        // Find the context node inside the role block
        const roleNode = result.ast.find(n => n.type === 'role');
        expect(roleNode).toBeDefined();
        if (roleNode && roleNode.type === 'role') {
          const contextNode = roleNode.body.find(n => n.type === 'context');
          expect(contextNode).toBeDefined();
          if (contextNode && contextNode.type === 'context') {
            expect(contextNode.resolvedContent).toBeDefined();
            expect(contextNode.resolvedContent?.mimeType).toBe('image/png');
            expect(contextNode.resolvedContent?.dataUrl).toBe('data:image/png;base64,abc123');
          }
        }
      }
    });
  });

  describe('integration: renderMessages with context in role blocks', () => {
    it('should produce image_url content blocks for context inside role blocks', async () => {
      const resolver = new MockContextResolver({
        'plp://test-image': {
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        },
      });

      const echo = createEcho({ contextResolver: resolver });
      const result = await echo.renderMessages(
        '[#ROLE system]\nYou are helpful.\n[END ROLE]\n[#ROLE user]\nDescribe this image:\n#context(plp://test-image)\n[END ROLE]',
        {}
      );

      // Should have two messages: system and user
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[1].role).toBe('user');

      // The user message should contain an image_url block
      const userContent = result.messages[1].content;
      const imageBlock = userContent.find(b => b.type === 'image_url');
      expect(imageBlock).toBeDefined();
      if (imageBlock && imageBlock.type === 'image_url') {
        expect(imageBlock.image_url.url).toBe('data:image/png;base64,iVBORw0KGgo=');
      }
    });

    it('should produce text-only blocks when context has text content inside role blocks', async () => {
      const resolver = new MockContextResolver({
        'plp://readme': {
          mimeType: 'text/plain',
          text: 'This is the readme content.',
        },
      });

      const echo = createEcho({ contextResolver: resolver });
      const result = await echo.renderMessages(
        '[#ROLE user]\nRead this:\n#context(plp://readme)\n[END ROLE]',
        {}
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');

      // All blocks should be text
      const textBlocks = result.messages[0].content.filter(b => b.type === 'text');
      expect(textBlocks.length).toBeGreaterThan(0);

      // The text content should include the resolved text
      const fullText = textBlocks.map(b => b.type === 'text' ? b.text : '').join('');
      expect(fullText).toContain('This is the readme content.');
    });
  });
});
