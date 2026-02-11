/**
 * @fileoverview Dataset operations for eval system
 *
 * Handles loading datasets from .dset files, resolving parameter sets,
 * and recording golden responses.
 */

import { writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { stringify as stringifyYaml } from 'yaml';
import { loadDatasetFile } from './loader.js';
import type { EvalDataset, LLMResponse } from './types.js';

// =============================================================================
// DATASET MANAGER
// =============================================================================

/**
 * Manages datasets within a prompt's eval/datasets/ directory.
 */
export class DatasetManager {
  private cache = new Map<string, EvalDataset>();

  constructor(
    /** Path to the prompt directory (contains eval/datasets/) */
    private promptDir: string
  ) {}

  /**
   * Load a dataset by name.
   * Looks for eval/datasets/{name}.dset
   */
  async load(name: string): Promise<EvalDataset> {
    const cached = this.cache.get(name);
    if (cached) return cached;

    const filePath = this.getDatasetPath(name);
    const dataset = await loadDatasetFile(filePath);
    this.cache.set(name, dataset);
    return dataset;
  }

  /**
   * Get a specific parameter set from a dataset.
   */
  async getParams(
    datasetName: string,
    paramsName: string
  ): Promise<Record<string, unknown>> {
    const dataset = await this.load(datasetName);
    const paramSet = dataset.parameters.find((p) => p.name === paramsName);

    if (!paramSet) {
      throw new Error(
        `Parameter set "${paramsName}" not found in dataset "${datasetName}". ` +
          `Available: ${dataset.parameters.map((p) => p.name).join(', ')}`
      );
    }

    // Return all fields except 'name' as the variable context
    const { name: _name, ...vars } = paramSet;
    return vars;
  }

  /**
   * Get the golden response from a dataset.
   */
  async getGolden(datasetName: string): Promise<string | undefined> {
    const dataset = await this.load(datasetName);
    return dataset.golden?.response;
  }

  /**
   * Record a golden response into a dataset.
   * Creates the dataset if it doesn't exist.
   */
  async recordGolden(
    datasetName: string,
    response: string,
    llmResponse: LLMResponse
  ): Promise<void> {
    let dataset: EvalDataset;

    try {
      dataset = await this.load(datasetName);
    } catch (_err) {
      // Dataset doesn't exist — create a minimal one
      dataset = {
        name: datasetName,
        parameters: [],
      };
    }

    // Update golden
    dataset.golden = {
      response,
      model: llmResponse.model,
      recorded_at: new Date().toISOString(),
      metadata: {
        tokens: llmResponse.tokens?.total,
        latency_ms: llmResponse.latencyMs,
      },
    };

    // Write back
    await this.save(datasetName, dataset);
    this.cache.set(datasetName, dataset);
  }

  /**
   * Save a dataset to disk.
   */
  async save(name: string, dataset: EvalDataset): Promise<void> {
    const filePath = this.getDatasetPath(name);
    const content = stringifyYaml(dataset, { lineWidth: 120 });
    await writeFile(filePath, content, 'utf-8');
  }

  private getDatasetPath(name: string): string {
    return resolve(join(this.promptDir, 'eval', 'datasets', `${name}.dset`));
  }
}
