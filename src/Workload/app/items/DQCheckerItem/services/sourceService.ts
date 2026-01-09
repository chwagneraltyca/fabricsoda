/**
 * Source Service (OneLake JSON)
 *
 * CRUD operations for data source configurations.
 * Handles cascade delete of dependent testcases.
 *
 * Storage: Files/config/data/sources/{uuid}.json
 */

import { OneLakeStorageClientItemWrapper } from '../../../clients/OneLakeStorageClientItemWrapper';
import { Source, SourceInput, SourceUpdate } from '../types';
import { validateSource } from '../schemas';
import { OnelakeJsonService, generateEntityId } from './onelakeJsonService';

export class SourceService {
  private jsonService: OnelakeJsonService<Source>;

  constructor(storage: OneLakeStorageClientItemWrapper) {
    this.jsonService = new OnelakeJsonService<Source>(storage, 'sources', 'source_id');
  }

  /**
   * List all sources
   */
  async list(): Promise<Source[]> {
    return this.jsonService.list();
  }

  /**
   * Get a source by ID
   */
  async get(sourceId: string): Promise<Source | null> {
    return this.jsonService.get(sourceId);
  }

  /**
   * Create a new source
   */
  async create(input: SourceInput): Promise<Source> {
    const now = new Date().toISOString();

    const source: Source = {
      source_id: generateEntityId('src'),
      source_name: input.source_name,
      source_type: input.source_type,
      server_name: input.server_name,
      database_name: input.database_name,
      keyvault_uri: input.keyvault_uri ?? null,
      client_id: input.client_id ?? null,
      secret_name: input.secret_name ?? null,
      description: input.description ?? null,
      is_active: input.is_active ?? true,
      created_at: now,
      version: now,
    };

    // Validate with Zod
    const validation = validateSource(source);
    if (!validation.success) {
      throw new Error(`Invalid source data: ${validation.errors?.join(', ')}`);
    }

    return this.jsonService.create(source);
  }

  /**
   * Update an existing source
   */
  async update(sourceId: string, updates: SourceUpdate): Promise<Source> {
    const existing = await this.get(sourceId);
    if (!existing) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    // Apply updates
    const updated: Source = {
      ...existing,
      source_name: updates.source_name ?? existing.source_name,
      source_type: updates.source_type ?? existing.source_type,
      server_name: updates.server_name ?? existing.server_name,
      database_name: updates.database_name ?? existing.database_name,
      keyvault_uri: updates.keyvault_uri !== undefined ? (updates.keyvault_uri || null) : existing.keyvault_uri,
      client_id: updates.client_id !== undefined ? (updates.client_id || null) : existing.client_id,
      secret_name: updates.secret_name !== undefined ? (updates.secret_name || null) : existing.secret_name,
      description: updates.description !== undefined ? (updates.description || null) : existing.description,
      is_active: updates.is_active ?? existing.is_active,
      created_at: existing.created_at,
      version: new Date().toISOString(),
    };

    // Validate with Zod
    const validation = validateSource(updated);
    if (!validation.success) {
      throw new Error(`Invalid source data: ${validation.errors?.join(', ')}`);
    }

    return this.jsonService.update(sourceId, updated);
  }

  /**
   * Delete a source
   * Note: Cascade delete of testcases should be handled by the caller (DataContext)
   */
  async delete(sourceId: string): Promise<void> {
    await this.jsonService.delete(sourceId);
  }

  /**
   * Check if a source exists
   */
  async exists(sourceId: string): Promise<boolean> {
    return this.jsonService.exists(sourceId);
  }

  /**
   * Get active sources only
   */
  async listActive(): Promise<Source[]> {
    const all = await this.list();
    return all.filter((s) => s.is_active);
  }

  /**
   * Find source by name
   */
  async findByName(name: string): Promise<Source | null> {
    const all = await this.list();
    return all.find((s) => s.source_name === name) ?? null;
  }
}
