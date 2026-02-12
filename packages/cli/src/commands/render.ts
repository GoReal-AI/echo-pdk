/**
 * @fileoverview Render Command - Render an Echo template
 *
 * Usage:
 *   echopdk render template.echo --context '{"name": "Alice"}'
 *   echopdk render template.echo --context-file context.json
 *   echopdk render template.echo --context-file context.json --output result.txt
 *   echopdk render template.echo --context-dir ./assets  # For #context() resolution
 */

import { readFile, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import {
  createEcho,
  type ContextResolver,
  type ResolvedContextContent,
} from '@goreal-ai/echo-pdk';
import chalk from 'chalk';
import ora from 'ora';

// =============================================================================
// TYPES
// =============================================================================

interface RenderOptions {
  context?: string;
  contextFile?: string;
  contextDir?: string;
  output?: string;
  strict?: boolean;
  trim?: boolean;
}

// =============================================================================
// COMMAND IMPLEMENTATION
// =============================================================================

/**
 * Render command handler.
 */
export async function renderCommand(
  templatePath: string,
  options: RenderOptions
): Promise<void> {
  const spinner = ora('Rendering template...').start();

  try {
    // 1. Load template
    const template = await loadTemplate(templatePath);

    // 2. Load context
    const context = await loadContext(options);

    // 3. Create context resolver if --context-dir provided
    const contextResolver = options.contextDir
      ? createFileContextResolver(options.contextDir)
      : undefined;

    // 4. Create Echo instance
    const echo = createEcho({
      strict: options.strict,
      contextResolver,
    });

    // 5. Render
    spinner.text = 'Rendering...';
    const result = await echo.render(template, context);

    // 6. Apply post-processing
    let output = result;
    if (options.trim) {
      output = output.trim();
    }

    spinner.succeed('Template rendered successfully');

    // 7. Output result
    if (options.output) {
      await writeFile(options.output, output, 'utf-8');
      console.log(chalk.green(`Output written to: ${options.output}`));
    } else {
      console.log('\n' + chalk.bold('Output:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(output);
      console.log(chalk.gray('─'.repeat(40)));
    }
  } catch (error) {
    spinner.fail('Render failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Load template from file.
 */
async function loadTemplate(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to load template: ${path}`);
  }
}

/**
 * Load context from options.
 */
async function loadContext(options: RenderOptions): Promise<Record<string, unknown>> {
  // From --context JSON string
  if (options.context) {
    try {
      return JSON.parse(options.context) as Record<string, unknown>;
    } catch {
      throw new Error('Invalid JSON in --context option');
    }
  }

  // From --context-file
  if (options.contextFile) {
    try {
      const content = await readFile(options.contextFile, 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new Error(`Failed to load context file: ${options.contextFile}`);
    }
  }

  // No context provided
  return {};
}

/**
 * MIME type mapping for common file extensions.
 */
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.xml': 'application/xml',
};

/**
 * Check if MIME type is an image type.
 */
function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Create a context resolver that reads files from a directory.
 *
 * @param contextDir - Directory containing context files
 * @returns ContextResolver instance
 */
export function createFileContextResolver(contextDir: string): ContextResolver {
  return {
    async resolve(path: string) {
      // Check if it's a plp:// reference
      const isPlpRef = path.startsWith('plp://');

      // Skip plp:// references - those need to be resolved via API
      if (isPlpRef) {
        console.warn(
          chalk.yellow(`Warning: plp:// references (${path}) require API access. Skipping.`)
        );
        return { success: false, error: 'plp:// references require API access' };
      }

      // Resolve file path
      const filePath = join(contextDir, path);

      try {
        // Check file exists
        await stat(filePath);

        // Determine MIME type
        const ext = extname(filePath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

        // Read file content
        const fileContent = await readFile(filePath);

        let content: ResolvedContextContent;

        if (isImageMimeType(mimeType)) {
          // Return as base64 data URL for images
          const base64 = fileContent.toString('base64');
          content = {
            mimeType,
            dataUrl: `data:${mimeType};base64,${base64}`,
          };
        } else {
          // Return as text for text files
          content = {
            mimeType,
            text: fileContent.toString('utf-8'),
          };
        }

        return { success: true, content };
      } catch {
        console.warn(
          chalk.yellow(`Warning: Context file not found: ${filePath}`)
        );
        return { success: false, error: `Context file not found: ${filePath}` };
      }
    },
  };
}

// =============================================================================
// IMPLEMENTATION NOTES
// =============================================================================

/*
NEXT STEPS TO IMPLEMENT:

1. STREAMING OUTPUT
   For large templates, stream the output instead of buffering.

2. ENVIRONMENT VARIABLES
   Support reading context from environment:
   --env prefix=MY_VAR_

3. MULTIPLE TEMPLATES
   Support glob patterns for batch rendering:
   echopdk render "templates/*.echo" --context-file context.json --output-dir dist/

4. STDIN INPUT
   Support reading template from stdin:
   cat template.echo | echopdk render - --context '{"name": "Alice"}'

5. PROGRESS REPORTING
   For AI judge conditions, show progress:
   "Evaluating AI conditions... (3/5)"
*/
