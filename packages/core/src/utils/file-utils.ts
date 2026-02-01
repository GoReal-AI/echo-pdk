/**
 * @fileoverview File utilities for typed variable file handling
 *
 * Provides utilities for detecting and validating file types from data URLs
 * and MIME types. Used by the renderer to handle {{var:file}} variables.
 */

import type { FileVariableValue } from '../types.js';

// =============================================================================
// SUPPORTED FILE TYPES
// =============================================================================

/**
 * Supported image MIME types.
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
] as const;

/**
 * Supported document MIME types.
 */
export const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
] as const;

/**
 * Supported text MIME types.
 */
export const SUPPORTED_TEXT_TYPES = [
  'text/plain',
  'text/markdown',
  'text/md',
  'application/json',
  'text/yaml',
  'application/yaml',
  'text/xml',
  'application/xml',
] as const;

/**
 * All supported MIME types.
 */
export const SUPPORTED_MIME_TYPES = [
  ...SUPPORTED_IMAGE_TYPES,
  ...SUPPORTED_DOCUMENT_TYPES,
  ...SUPPORTED_TEXT_TYPES,
] as const;

export type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[number];

// =============================================================================
// MIME TYPE DETECTION
// =============================================================================

/**
 * Extract MIME type from a data URL.
 *
 * @param dataUrl - Data URL string (e.g., "data:image/png;base64,...")
 * @returns The MIME type or null if not found
 *
 * @example
 * ```typescript
 * detectMimeTypeFromDataUrl('data:image/png;base64,iVBOR...')
 * // Returns: 'image/png'
 * ```
 */
export function detectMimeTypeFromDataUrl(dataUrl: string): string | null {
  if (!dataUrl.startsWith('data:')) {
    return null;
  }

  const match = dataUrl.match(/^data:([^;,]+)/);
  return match?.[1] ?? null;
}

/**
 * Detect MIME type from file extension.
 *
 * @param filename - Filename with extension
 * @returns The MIME type or null if unknown
 */
export function detectMimeTypeFromFilename(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  const extensionMap: Record<string, string> = {
    // Images
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    // Documents
    pdf: 'application/pdf',
    // Text
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    yaml: 'application/yaml',
    yml: 'application/yaml',
    xml: 'application/xml',
  };

  return extensionMap[ext] ?? null;
}

// =============================================================================
// FILE TYPE VALIDATION
// =============================================================================

/**
 * Check if a MIME type is a supported file type.
 *
 * @param mimeType - MIME type to check
 * @returns true if supported
 */
export function isSupportedFileType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType);
}

/**
 * Check if a MIME type is an image type.
 *
 * @param mimeType - MIME type to check
 * @returns true if it's a supported image type
 */
export function isImageMimeType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(mimeType as typeof SUPPORTED_IMAGE_TYPES[number]);
}

/**
 * Check if a MIME type is a document type (PDF).
 *
 * @param mimeType - MIME type to check
 * @returns true if it's a document type
 */
export function isDocumentMimeType(mimeType: string): boolean {
  return SUPPORTED_DOCUMENT_TYPES.includes(mimeType as typeof SUPPORTED_DOCUMENT_TYPES[number]);
}

/**
 * Check if a MIME type is a text type.
 *
 * @param mimeType - MIME type to check
 * @returns true if it's a text type
 */
export function isTextMimeType(mimeType: string): boolean {
  return SUPPORTED_TEXT_TYPES.includes(mimeType as typeof SUPPORTED_TEXT_TYPES[number]);
}

// =============================================================================
// VALUE CONVERSION
// =============================================================================

/**
 * Normalize a file variable value.
 * Handles both string (data URL) and FileVariableValue object inputs.
 *
 * @param value - The raw value from context
 * @returns Normalized FileVariableValue or null if invalid
 */
export function normalizeFileValue(value: unknown): FileVariableValue | null {
  if (!value) return null;

  // If it's a string, treat as data URL
  if (typeof value === 'string') {
    const mimeType = detectMimeTypeFromDataUrl(value);
    if (!mimeType) return null;

    return {
      dataUrl: value,
      mimeType,
    };
  }

  // If it's an object with dataUrl and mimeType
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.dataUrl === 'string' && typeof obj.mimeType === 'string') {
      let dataUrl = obj.dataUrl;
      const mimeType = obj.mimeType;

      // Ensure dataUrl is properly formatted with data URL prefix
      // If it's raw base64 (doesn't start with "data:"), construct the full data URL
      if (!dataUrl.startsWith('data:')) {
        dataUrl = `data:${mimeType};base64,${dataUrl}`;
      }

      return {
        dataUrl,
        mimeType,
        filename: typeof obj.filename === 'string' ? obj.filename : undefined,
      };
    }
  }

  return null;
}

/**
 * Normalize a boolean variable value.
 * Accepts various truthy/falsy representations.
 *
 * @param value - The raw value from context
 * @returns Normalized boolean string ('true' or 'false')
 */
export function normalizeBooleanValue(value: unknown): string {
  if (value === true || value === 'true' || value === '1' || value === 'yes' || value === 1) {
    return 'true';
  }
  return 'false';
}

/**
 * Normalize a number variable value.
 *
 * @param value - The raw value from context
 * @returns Normalized number string or error message
 */
export function normalizeNumberValue(value: unknown): string {
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return String(num);
    }
  }
  return '[Invalid number]';
}

/**
 * Get human-readable file type category.
 *
 * @param mimeType - MIME type
 * @returns Category name (image, document, text, unknown)
 */
export function getFileTypeCategory(mimeType: string): 'image' | 'document' | 'text' | 'unknown' {
  if (isImageMimeType(mimeType)) return 'image';
  if (isDocumentMimeType(mimeType)) return 'document';
  if (isTextMimeType(mimeType)) return 'text';
  return 'unknown';
}
