/**
 * OneLake JSON Service
 *
 * Base service for JSON entity storage in OneLake.
 * Provides CRUD operations using OneLake DFS API.
 *
 * Storage: Files/config/data/{entityType}/{uuid}.json
 */

import { OneLakeStorageClientItemWrapper } from '../../../clients/OneLakeStorageClientItemWrapper';

// Base path for config data
const CONFIG_DATA_PATH = 'Files/config/data';

export interface JsonEntity {
  created_at: string;
  version: string;
}

/**
 * Generic JSON service for OneLake entity storage
 */
export class OnelakeJsonService<T extends JsonEntity> {
  private storage: OneLakeStorageClientItemWrapper;
  private entityType: string;
  private idField: string;

  constructor(
    storage: OneLakeStorageClientItemWrapper,
    entityType: string,
    idField: string
  ) {
    this.storage = storage;
    this.entityType = entityType;
    this.idField = idField;
  }

  /**
   * Get the folder path for this entity type
   */
  private getFolderPath(): string {
    return `${CONFIG_DATA_PATH}/${this.entityType}`;
  }

  /**
   * Get the file path for an entity
   */
  private getFilePath(id: string): string {
    return `${this.getFolderPath()}/${id}.json`;
  }

  /**
   * List all entities of this type
   */
  async list(): Promise<T[]> {
    const folderPath = this.getFolderPath();

    try {
      const metadata = await this.storage.getPathMetadata(folderPath, false, false);
      const entities: T[] = [];

      if (metadata.paths) {
        for (const path of metadata.paths) {
          // Skip directories and non-JSON files
          if (path.isDirectory || !path.name.endsWith('.json')) continue;
          // Skip placeholder files
          if (path.name.includes('.folder_placeholder')) continue;

          try {
            const content = await this.storage.readFileAsText(`${folderPath}/${path.name}`);
            if (content) {
              entities.push(JSON.parse(content) as T);
            }
          } catch (parseError) {
            console.warn(`Failed to parse ${path.name}:`, parseError);
          }
        }
      }

      return entities;
    } catch (error: unknown) {
      // Folder doesn't exist yet - return empty array
      if (error instanceof Error && error.message.includes('404')) {
        return [];
      }
      console.error(`Failed to list ${this.entityType}:`, error);
      throw error;
    }
  }

  /**
   * Get a single entity by ID
   */
  async get(id: string): Promise<T | null> {
    const filePath = this.getFilePath(id);

    try {
      const content = await this.storage.readFileAsText(filePath);
      if (!content) {
        return null;
      }
      return JSON.parse(content) as T;
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      console.error(`Failed to get ${this.entityType} ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new entity
   */
  async create(entity: T): Promise<T> {
    const id = (entity as unknown as Record<string, unknown>)[this.idField] as string;
    const filePath = this.getFilePath(id);

    // Ensure folder exists
    await this.ensureFolderExists();

    // Set timestamps
    const now = new Date().toISOString();
    const entityWithTimestamps = {
      ...entity,
      created_at: entity.created_at || now,
      version: now,
    };

    await this.storage.writeFileAsText(filePath, JSON.stringify(entityWithTimestamps, null, 2));
    console.log(`Created ${this.entityType}: ${id}`);

    return entityWithTimestamps;
  }

  /**
   * Update an existing entity
   */
  async update(id: string, updates: Partial<T>): Promise<T> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`${this.entityType} not found: ${id}`);
    }

    const filePath = this.getFilePath(id);
    const now = new Date().toISOString();

    const updated = {
      ...existing,
      ...updates,
      [this.idField]: id, // Ensure ID cannot be changed
      created_at: existing.created_at, // Preserve original created_at
      version: now, // Update version timestamp
    };

    await this.storage.writeFileAsText(filePath, JSON.stringify(updated, null, 2));
    console.log(`Updated ${this.entityType}: ${id}`);

    return updated;
  }

  /**
   * Delete an entity
   */
  async delete(id: string): Promise<void> {
    const filePath = this.getFilePath(id);

    try {
      await this.storage.deleteFile(filePath);
      console.log(`Deleted ${this.entityType}: ${id}`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('404')) {
        console.warn(`${this.entityType} already deleted: ${id}`);
        return;
      }
      throw error;
    }
  }

  /**
   * Check if an entity exists
   */
  async exists(id: string): Promise<boolean> {
    const filePath = this.getFilePath(id);
    return this.storage.checkIfFileExists(filePath);
  }

  /**
   * Ensure the entity folder exists
   */
  private async ensureFolderExists(): Promise<void> {
    const folderPath = this.getFolderPath();
    try {
      await this.storage.createFolder(folderPath);
    } catch {
      // Folder may already exist, ignore error
    }
  }

  /**
   * Get the storage client wrapper
   */
  getStorage(): OneLakeStorageClientItemWrapper {
    return this.storage;
  }
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate an entity-prefixed UUID
 */
export function generateEntityId(prefix: string): string {
  return `${prefix}-${generateUUID()}`;
}
