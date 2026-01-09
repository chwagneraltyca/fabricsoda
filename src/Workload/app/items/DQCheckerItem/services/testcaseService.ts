/**
 * Testcase Service (OneLake JSON)
 *
 * CRUD operations for testcases with embedded checks.
 * Manages the composition of checks within testcases.
 *
 * Storage: Files/config/data/testcases/{uuid}.json
 */

import { OneLakeStorageClientItemWrapper } from '../../../clients/OneLakeStorageClientItemWrapper';
import { Testcase, TestcaseInput, TestcaseUpdate, Check, CheckInput, CheckUpdate } from '../types';
import { validateTestcase } from '../schemas';
import { OnelakeJsonService, generateEntityId } from './onelakeJsonService';

export class TestcaseService {
  private jsonService: OnelakeJsonService<Testcase>;

  constructor(storage: OneLakeStorageClientItemWrapper) {
    this.jsonService = new OnelakeJsonService<Testcase>(storage, 'testcases', 'testcase_id');
  }

  // ==================== Testcase Operations ====================

  /**
   * List all testcases
   */
  async list(): Promise<Testcase[]> {
    return this.jsonService.list();
  }

  /**
   * Get a testcase by ID
   */
  async get(testcaseId: string): Promise<Testcase | null> {
    return this.jsonService.get(testcaseId);
  }

  /**
   * Create a new testcase
   */
  async create(input: TestcaseInput): Promise<Testcase> {
    const now = new Date().toISOString();

    const testcase: Testcase = {
      testcase_id: generateEntityId('tc'),
      testcase_name: input.testcase_name,
      source_id: input.source_id,
      schema_name: input.schema_name,
      table_name: input.table_name,
      description: input.description ?? null,
      owner: input.owner ?? null,
      tags: input.tags ?? [],
      checks: input.checks?.map((c) => this.createCheckFromInput(c)) ?? [],
      is_active: input.is_active ?? true,
      created_at: now,
      version: now,
    };

    // Validate with Zod
    const validation = validateTestcase(testcase);
    if (!validation.success) {
      throw new Error(`Invalid testcase data: ${validation.errors?.join(', ')}`);
    }

    return this.jsonService.create(testcase);
  }

  /**
   * Update an existing testcase
   */
  async update(testcaseId: string, updates: TestcaseUpdate): Promise<Testcase> {
    const existing = await this.get(testcaseId);
    if (!existing) {
      throw new Error(`Testcase not found: ${testcaseId}`);
    }

    const updated: Testcase = {
      ...existing,
      testcase_name: updates.testcase_name ?? existing.testcase_name,
      source_id: updates.source_id ?? existing.source_id,
      schema_name: updates.schema_name ?? existing.schema_name,
      table_name: updates.table_name ?? existing.table_name,
      description: updates.description !== undefined ? (updates.description || null) : existing.description,
      owner: updates.owner !== undefined ? (updates.owner || null) : existing.owner,
      tags: updates.tags ?? existing.tags,
      checks: updates.checks ?? existing.checks,
      is_active: updates.is_active ?? existing.is_active,
      created_at: existing.created_at,
      version: new Date().toISOString(),
    };

    // Validate with Zod
    const validation = validateTestcase(updated);
    if (!validation.success) {
      throw new Error(`Invalid testcase data: ${validation.errors?.join(', ')}`);
    }

    return this.jsonService.update(testcaseId, updated);
  }

  /**
   * Delete a testcase
   * Note: Suite references should be cleaned by the caller (DataContext)
   */
  async delete(testcaseId: string): Promise<void> {
    await this.jsonService.delete(testcaseId);
  }

  /**
   * Get testcases by source ID
   */
  async listBySource(sourceId: string): Promise<Testcase[]> {
    const all = await this.list();
    return all.filter((t) => t.source_id === sourceId);
  }

  /**
   * Get active testcases only
   */
  async listActive(): Promise<Testcase[]> {
    const all = await this.list();
    return all.filter((t) => t.is_active);
  }

  // ==================== Check Operations (embedded) ====================

  /**
   * Add a check to a testcase
   */
  async addCheck(testcaseId: string, input: CheckInput): Promise<Testcase> {
    const testcase = await this.get(testcaseId);
    if (!testcase) {
      throw new Error(`Testcase not found: ${testcaseId}`);
    }

    const check = this.createCheckFromInput(input);
    const updatedChecks = [...testcase.checks, check];

    return this.update(testcaseId, { checks: updatedChecks });
  }

  /**
   * Update a check within a testcase
   */
  async updateCheck(testcaseId: string, checkId: string, updates: CheckUpdate): Promise<Testcase> {
    const testcase = await this.get(testcaseId);
    if (!testcase) {
      throw new Error(`Testcase not found: ${testcaseId}`);
    }

    const checkIndex = testcase.checks.findIndex((c) => c.check_id === checkId);
    if (checkIndex === -1) {
      throw new Error(`Check not found: ${checkId}`);
    }

    const existingCheck = testcase.checks[checkIndex];
    const updatedCheck: Check = {
      ...existingCheck,
      check_name: updates.check_name ?? existingCheck.check_name,
      column_name: updates.column_name !== undefined ? updates.column_name : existingCheck.column_name,
      metric: updates.metric ?? existingCheck.metric,
      config: updates.config ?? existingCheck.config,
      fail_comparison: updates.fail_comparison !== undefined ? updates.fail_comparison : existingCheck.fail_comparison,
      fail_threshold: updates.fail_threshold !== undefined ? updates.fail_threshold : existingCheck.fail_threshold,
      warn_comparison: updates.warn_comparison !== undefined ? updates.warn_comparison : existingCheck.warn_comparison,
      warn_threshold: updates.warn_threshold !== undefined ? updates.warn_threshold : existingCheck.warn_threshold,
      filter_condition: updates.filter_condition !== undefined ? updates.filter_condition : existingCheck.filter_condition,
      dimension: updates.dimension ?? existingCheck.dimension,
      severity: updates.severity ?? existingCheck.severity,
      owner: updates.owner !== undefined ? updates.owner : existingCheck.owner,
      tags: updates.tags ?? existingCheck.tags,
      is_enabled: updates.is_enabled ?? existingCheck.is_enabled,
    };

    const updatedChecks = [...testcase.checks];
    updatedChecks[checkIndex] = updatedCheck;

    return this.update(testcaseId, { checks: updatedChecks });
  }

  /**
   * Remove a check from a testcase
   */
  async removeCheck(testcaseId: string, checkId: string): Promise<Testcase> {
    const testcase = await this.get(testcaseId);
    if (!testcase) {
      throw new Error(`Testcase not found: ${testcaseId}`);
    }

    const updatedChecks = testcase.checks.filter((c) => c.check_id !== checkId);
    return this.update(testcaseId, { checks: updatedChecks });
  }

  /**
   * Get a single check from a testcase
   */
  async getCheck(testcaseId: string, checkId: string): Promise<Check | null> {
    const testcase = await this.get(testcaseId);
    if (!testcase) {
      return null;
    }
    return testcase.checks.find((c) => c.check_id === checkId) ?? null;
  }

  /**
   * Reorder checks within a testcase
   */
  async reorderChecks(testcaseId: string, checkIds: string[]): Promise<Testcase> {
    const testcase = await this.get(testcaseId);
    if (!testcase) {
      throw new Error(`Testcase not found: ${testcaseId}`);
    }

    // Create a map for O(1) lookup
    const checkMap = new Map(testcase.checks.map((c) => [c.check_id, c]));

    // Validate all IDs exist
    for (const id of checkIds) {
      if (!checkMap.has(id)) {
        throw new Error(`Check not found: ${id}`);
      }
    }

    // Reorder based on provided IDs
    const reorderedChecks = checkIds.map((id) => checkMap.get(id)!);

    return this.update(testcaseId, { checks: reorderedChecks });
  }

  // ==================== Helper Methods ====================

  /**
   * Create a Check from CheckInput
   */
  private createCheckFromInput(input: CheckInput): Check {
    return {
      check_id: generateEntityId('chk'),
      check_name: input.check_name,
      column_name: input.column_name,
      metric: input.metric,
      config: input.config ?? {},
      fail_comparison: input.fail_comparison,
      fail_threshold: input.fail_threshold,
      warn_comparison: input.warn_comparison,
      warn_threshold: input.warn_threshold,
      filter_condition: input.filter_condition,
      dimension: input.dimension ?? 'completeness',
      severity: input.severity ?? 'medium',
      owner: input.owner,
      tags: input.tags,
      is_enabled: input.is_enabled ?? true,
    };
  }

  /**
   * Get all checks from all testcases (flattened)
   */
  async getAllChecks(): Promise<Array<Check & { testcase_id: string; source_id: string }>> {
    const testcases = await this.list();
    const checks: Array<Check & { testcase_id: string; source_id: string }> = [];

    for (const tc of testcases) {
      for (const check of tc.checks) {
        checks.push({
          ...check,
          testcase_id: tc.testcase_id,
          source_id: tc.source_id,
        });
      }
    }

    return checks;
  }

  /**
   * Count total checks across all testcases
   */
  async countChecks(): Promise<number> {
    const testcases = await this.list();
    return testcases.reduce((sum, tc) => sum + tc.checks.length, 0);
  }
}
