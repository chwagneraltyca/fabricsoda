/**
 * Suite Service (OneLake JSON)
 *
 * CRUD operations for test suites.
 * Manages N:M relationship with testcases via testcase_ids array.
 *
 * Storage: Files/config/data/suites/{uuid}.json
 */

import { OneLakeStorageClientItemWrapper } from '../../../clients/OneLakeStorageClientItemWrapper';
import { Suite, SuiteInput, SuiteUpdate } from '../types';
import { validateSuite } from '../schemas';
import { OnelakeJsonService, generateEntityId } from './onelakeJsonService';

export class SuiteService {
  private jsonService: OnelakeJsonService<Suite>;

  constructor(storage: OneLakeStorageClientItemWrapper) {
    this.jsonService = new OnelakeJsonService<Suite>(storage, 'suites', 'suite_id');
  }

  /**
   * List all suites
   */
  async list(): Promise<Suite[]> {
    return this.jsonService.list();
  }

  /**
   * Get a suite by ID
   */
  async get(suiteId: string): Promise<Suite | null> {
    return this.jsonService.get(suiteId);
  }

  /**
   * Create a new suite
   */
  async create(input: SuiteInput): Promise<Suite> {
    const now = new Date().toISOString();

    const suite: Suite = {
      suite_id: generateEntityId('suite'),
      suite_name: input.suite_name,
      suite_code: input.suite_code,
      testcase_ids: input.testcase_ids ?? [],
      category: input.category ?? 'Standard',
      data_domain: input.data_domain ?? 'Other',
      description: input.description ?? null,
      execution_order: input.execution_order ?? 0,
      owner: input.owner ?? null,
      tags: input.tags ?? [],
      is_active: input.is_active ?? true,
      created_at: now,
      version: now,
    };

    // Validate with Zod
    const validation = validateSuite(suite);
    if (!validation.success) {
      throw new Error(`Invalid suite data: ${validation.errors?.join(', ')}`);
    }

    return this.jsonService.create(suite);
  }

  /**
   * Update an existing suite
   */
  async update(suiteId: string, updates: SuiteUpdate): Promise<Suite> {
    const existing = await this.get(suiteId);
    if (!existing) {
      throw new Error(`Suite not found: ${suiteId}`);
    }

    const updated: Suite = {
      ...existing,
      suite_name: updates.suite_name ?? existing.suite_name,
      suite_code: updates.suite_code ?? existing.suite_code,
      testcase_ids: updates.testcase_ids ?? existing.testcase_ids,
      category: updates.category ?? existing.category,
      data_domain: updates.data_domain ?? existing.data_domain,
      description: updates.description !== undefined ? (updates.description || null) : existing.description,
      execution_order: updates.execution_order ?? existing.execution_order,
      owner: updates.owner !== undefined ? (updates.owner || null) : existing.owner,
      tags: updates.tags ?? existing.tags,
      is_active: updates.is_active ?? existing.is_active,
      created_at: existing.created_at,
      version: new Date().toISOString(),
    };

    // Validate with Zod
    const validation = validateSuite(updated);
    if (!validation.success) {
      throw new Error(`Invalid suite data: ${validation.errors?.join(', ')}`);
    }

    return this.jsonService.update(suiteId, updated);
  }

  /**
   * Delete a suite
   */
  async delete(suiteId: string): Promise<void> {
    await this.jsonService.delete(suiteId);
  }

  /**
   * Get active suites only
   */
  async listActive(): Promise<Suite[]> {
    const all = await this.list();
    return all.filter((s) => s.is_active);
  }

  /**
   * Get suites by category
   */
  async listByCategory(category: Suite['category']): Promise<Suite[]> {
    const all = await this.list();
    return all.filter((s) => s.category === category);
  }

  /**
   * Get suites by data domain
   */
  async listByDomain(domain: Suite['data_domain']): Promise<Suite[]> {
    const all = await this.list();
    return all.filter((s) => s.data_domain === domain);
  }

  /**
   * Get suites ordered by execution_order
   */
  async listOrdered(): Promise<Suite[]> {
    const all = await this.list();
    return all.sort((a, b) => a.execution_order - b.execution_order);
  }

  // ==================== Testcase Reference Management ====================

  /**
   * Add a testcase to a suite
   */
  async addTestcase(suiteId: string, testcaseId: string): Promise<Suite> {
    const suite = await this.get(suiteId);
    if (!suite) {
      throw new Error(`Suite not found: ${suiteId}`);
    }

    if (suite.testcase_ids.includes(testcaseId)) {
      return suite; // Already exists
    }

    const updatedIds = [...suite.testcase_ids, testcaseId];
    return this.update(suiteId, { testcase_ids: updatedIds });
  }

  /**
   * Remove a testcase from a suite
   */
  async removeTestcase(suiteId: string, testcaseId: string): Promise<Suite> {
    const suite = await this.get(suiteId);
    if (!suite) {
      throw new Error(`Suite not found: ${suiteId}`);
    }

    const updatedIds = suite.testcase_ids.filter((id) => id !== testcaseId);
    return this.update(suiteId, { testcase_ids: updatedIds });
  }

  /**
   * Remove a testcase from all suites (used when deleting a testcase)
   */
  async removeTestcaseFromAll(testcaseId: string): Promise<void> {
    const suites = await this.list();

    for (const suite of suites) {
      if (suite.testcase_ids.includes(testcaseId)) {
        await this.removeTestcase(suite.suite_id, testcaseId);
      }
    }
  }

  /**
   * Get suites that contain a specific testcase
   */
  async getSuitesForTestcase(testcaseId: string): Promise<Suite[]> {
    const all = await this.list();
    return all.filter((s) => s.testcase_ids.includes(testcaseId));
  }

  /**
   * Reorder testcases within a suite
   */
  async reorderTestcases(suiteId: string, testcaseIds: string[]): Promise<Suite> {
    const suite = await this.get(suiteId);
    if (!suite) {
      throw new Error(`Suite not found: ${suiteId}`);
    }

    // Validate all provided IDs exist in the suite
    const existingIds = new Set(suite.testcase_ids);
    for (const id of testcaseIds) {
      if (!existingIds.has(id)) {
        throw new Error(`Testcase ${id} not in suite`);
      }
    }

    return this.update(suiteId, { testcase_ids: testcaseIds });
  }

  /**
   * Set multiple testcases at once (replace all)
   */
  async setTestcases(suiteId: string, testcaseIds: string[]): Promise<Suite> {
    return this.update(suiteId, { testcase_ids: testcaseIds });
  }

  /**
   * Count testcases in a suite
   */
  async countTestcases(suiteId: string): Promise<number> {
    const suite = await this.get(suiteId);
    return suite?.testcase_ids.length ?? 0;
  }
}
